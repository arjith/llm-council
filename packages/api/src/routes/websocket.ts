import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { 
  CouncilPipeline, 
  getPreset, 
  createNarrator, 
  createDynamicCouncilPipeline,
  type NarratorEvent,
} from '@llm-council/core';

// Active WebSocket connections by session ID
const connections = new Map<string, Set<WebSocket>>();

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket endpoint for real-time session updates
   */
  fastify.get('/session/:id', { websocket: true }, (socket, request) => {
    const sessionId = (request.params as { id: string }).id;

    // Add connection to session
    if (!connections.has(sessionId)) {
      connections.set(sessionId, new Set());
    }
    connections.get(sessionId)!.add(socket);

    socket.send(JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString(),
    }));

    socket.on('close', () => {
      connections.get(sessionId)?.delete(socket);
      if (connections.get(sessionId)?.size === 0) {
        connections.delete(sessionId);
      }
    });
  });

  /**
   * WebSocket endpoint for running a council session with real-time updates
   * Now includes LLM Narrator for human-friendly progress updates
   */
  fastify.get('/run', { websocket: true }, async (socket, request) => {
    const query = request.query as { 
      question?: string; 
      preset?: string;
      dynamic?: string;
      narrate?: string;
    };
    
    if (!query.question) {
      socket.send(JSON.stringify({ type: 'error', message: 'Question is required' }));
      socket.close();
      return;
    }

    const useDynamic = query.dynamic === 'true';
    const useNarration = query.narrate !== 'false'; // Default to true
    const presetName = (query.preset ?? 'standard') as keyof typeof import('@llm-council/core').COUNCIL_PRESETS;
    const preset = getPreset(presetName);

    // Create narrator for human-friendly progress
    const narrator = createNarrator({ debounceMs: 300, maxBatchSize: 3 });
    
    // Set up narration callback
    narrator.onNarrate((narration) => {
      if (useNarration && socket.readyState === 1) {
        socket.send(JSON.stringify({
          type: 'narration',
          text: narration,
          timestamp: new Date().toISOString(),
        }));
      }
    });

    // Choose pipeline based on dynamic flag
    if (useDynamic) {
      const dynamicPipeline = createDynamicCouncilPipeline();
      
      // Run with dynamic planning
      try {
        // First, analyze and send plan
        const config = await dynamicPipeline.analyze(query.question, { planningMode: 'hybrid' });
        
        socket.send(JSON.stringify({
          type: 'plan:ready',
          analysis: {
            complexity: config.meta?.complexity,
            domain: config.meta?.domain,
            reasoning: config.meta?.reasoning,
            councilSize: config.council.size,
            members: config.council.members.map((m) => ({
              model: m.model,
              role: m.role,
            })),
          },
          timestamp: new Date().toISOString(),
        }));

        // Queue narration for planning complete
        narrator.queueEvent({
          type: 'session_start',
          sessionId: 'dynamic',
          timestamp: new Date().toISOString(),
          data: { totalMembers: config.council.size },
        });

        const session = await dynamicPipeline.run(query.question, { config });
        
        socket.send(JSON.stringify({
          type: 'complete',
          session: {
            id: session.id,
            finalAnswer: session.finalAnswer,
            finalConfidence: session.finalConfidence,
            totalDurationMs: session.totalDurationMs,
            dynamicConfig: session.dynamicConfig,
          },
        }));
      } catch (error) {
        socket.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      } finally {
        socket.close();
      }
      return;
    }

    // Standard pipeline with narrator events
    const pipeline = new CouncilPipeline();

    // Send events to WebSocket
    pipeline.on('session:start', (session) => {
      socket.send(JSON.stringify({
        type: 'session:start',
        sessionId: session.id,
        question: session.question,
        memberCount: session.members.length,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'session_start',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        data: { totalMembers: session.members.length },
      });
    });

    pipeline.on('stage:start', (stage, session) => {
      socket.send(JSON.stringify({
        type: 'stage:start',
        sessionId: session.id,
        stage,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'stage_start',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        data: { stage },
      });
    });

    pipeline.on('stage:end', (stage, result, session) => {
      socket.send(JSON.stringify({
        type: 'stage:end',
        sessionId: session.id,
        stage,
        durationMs: result.durationMs,
        responseCount: result.responses.length,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'stage_end',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        data: { stage, durationMs: result.durationMs, responseCount: result.responses.length },
      });
    });

    pipeline.on('member:request', (member, _messages) => {
      socket.send(JSON.stringify({
        type: 'member:request',
        memberId: member.id,
        memberName: member.name,
        model: member.modelConfig.name,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'member_request',
        sessionId: 'current',
        timestamp: new Date().toISOString(),
        data: { memberName: member.name, memberId: member.id, model: member.modelConfig.name },
      });
    });

    pipeline.on('member:response', (member, content, latencyMs) => {
      socket.send(JSON.stringify({
        type: 'member:response',
        memberId: member.id,
        memberName: member.name,
        content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
        latencyMs,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'member_response',
        sessionId: 'current',
        timestamp: new Date().toISOString(),
        data: { memberName: member.name, memberId: member.id, latencyMs },
      });
    });

    pipeline.on('vote:cast', (vote) => {
      socket.send(JSON.stringify({
        type: 'vote:cast',
        memberId: vote.memberId,
        memberName: vote.memberName,
        position: vote.position.slice(0, 100),
        confidence: vote.confidence,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'vote_cast',
        sessionId: 'current',
        timestamp: new Date().toISOString(),
        data: { memberName: vote.memberName, memberId: vote.memberId, confidence: vote.confidence },
      });
    });

    pipeline.on('voting:complete', (result) => {
      socket.send(JSON.stringify({
        type: 'voting:complete',
        winner: result.winner,
        confidenceAvg: result.confidenceAvg,
        consensusReached: result.consensusReached,
        breakdown: result.breakdown,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'voting_complete',
        sessionId: 'current',
        timestamp: new Date().toISOString(),
        data: { 
          winner: result.winner, 
          confidence: result.confidenceAvg, 
          consensusReached: result.consensusReached,
          breakdown: result.breakdown,
        },
      });
    });

    pipeline.on('correction:triggered', (round, reason) => {
      socket.send(JSON.stringify({
        type: 'correction:triggered',
        round,
        reason,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'correction_triggered',
        sessionId: 'current',
        timestamp: new Date().toISOString(),
        data: { round, reason },
      });
    });

    pipeline.on('trace', (event) => {
      socket.send(JSON.stringify({
        type: 'trace',
        event,
      }));
    });

    pipeline.on('session:end', (session) => {
      socket.send(JSON.stringify({
        type: 'session:end',
        sessionId: session.id,
        status: session.status,
        finalAnswer: session.finalAnswer,
        finalConfidence: session.finalConfidence,
        totalTokens: session.totalTokens,
        totalDurationMs: session.totalDurationMs,
      }));

      // Queue narration
      narrator.queueEvent({
        type: 'session_end',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        data: { status: session.status },
      });

      // Flush any remaining narration
      narrator.flush();
    });

    try {
      const session = await pipeline.run(
        query.question,
        [...preset.members],
        { ...preset.config }
      );

      // Flush final narration
      await narrator.flush();

      socket.send(JSON.stringify({
        type: 'complete',
        session: {
          id: session.id,
          finalAnswer: session.finalAnswer,
          finalConfidence: session.finalConfidence,
          totalDurationMs: session.totalDurationMs,
        },
      }));
    } catch (error) {
      socket.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      socket.close();
    }
  });
};

/**
 * Broadcast message to all connections for a session
 */
export function broadcastToSession(sessionId: string, message: unknown): void {
  const sessionConnections = connections.get(sessionId);
  if (sessionConnections) {
    const data = JSON.stringify(message);
    for (const socket of sessionConnections) {
      if (socket.readyState === 1) { // OPEN
        socket.send(data);
      }
    }
  }
}

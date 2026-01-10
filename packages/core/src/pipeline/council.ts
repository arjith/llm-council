import { nanoid } from 'nanoid';
import type {
  Session,
  SessionConfig,
  CouncilMember,
  Message,
  StageResult,
  Vote,
  VotingResult,
  TraceEvent,
  PipelineStage,
} from '../types.js';
import { createAdapter, type ModelAdapter } from '../adapters/index.js';
import { createVotingStrategy } from '../voting/index.js';

/**
 * Events emitted by the council pipeline
 */
export interface CouncilEvents {
  'session:start': (session: Session) => void;
  'session:end': (session: Session) => void;
  'stage:start': (stage: PipelineStage, session: Session) => void;
  'stage:end': (stage: PipelineStage, result: StageResult, session: Session) => void;
  'member:request': (member: CouncilMember, messages: Message[]) => void;
  'member:response': (member: CouncilMember, content: string, latencyMs: number) => void;
  'vote:cast': (vote: Vote) => void;
  'voting:complete': (result: VotingResult) => void;
  'correction:triggered': (round: number, reason: string) => void;
  'trace': (event: TraceEvent) => void;
  'error': (error: Error, context: unknown) => void;
}

type EventHandler<T extends keyof CouncilEvents> = CouncilEvents[T];

/**
 * LLM Council Pipeline
 * Orchestrates multi-model consensus through debate, voting, and synthesis
 */
export class CouncilPipeline {
  private adapters: Map<string, ModelAdapter> = new Map();
  private eventHandlers: Map<keyof CouncilEvents, Set<Function>> = new Map();
  private traces: TraceEvent[] = [];

  constructor() {}

  /**
   * Register an event handler
   */
  on<T extends keyof CouncilEvents>(event: T, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   */
  off<T extends keyof CouncilEvents>(event: T, handler: EventHandler<T>): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event
   */
  private emit<T extends keyof CouncilEvents>(
    event: T,
    ...args: Parameters<CouncilEvents[T]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as Function)(...args);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Add a trace event
   */
  private trace(
    sessionId: string,
    type: TraceEvent['type'],
    data?: Partial<TraceEvent>
  ): TraceEvent {
    const event: TraceEvent = {
      id: nanoid(),
      sessionId,
      type,
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.traces.push(event);
    this.emit('trace', event);
    return event;
  }

  /**
   * Run the council pipeline on a question
   */
  async run(
    question: string,
    members: CouncilMember[],
    config: Partial<SessionConfig> = {}
  ): Promise<Session> {
    const sessionConfig: SessionConfig = {
      councilSize: config.councilSize ?? 5,
      votingMethod: config.votingMethod ?? 'majority',
      selfCorrectionEnabled: config.selfCorrectionEnabled ?? true,
      selfCorrectionThreshold: config.selfCorrectionThreshold ?? 0.6,
      maxCorrectionRounds: config.maxCorrectionRounds ?? 2,
      backupMembersCount: config.backupMembersCount ?? 2,
      parallelExecution: config.parallelExecution ?? true,
      timeoutMs: config.timeoutMs ?? 60000,
      debugMode: config.debugMode ?? false,
    };

    const session: Session = {
      id: nanoid(),
      question,
      config: sessionConfig,
      members,
      stages: [],
      finalAnswer: null,
      finalConfidence: null,
      status: 'pending',
      correctionRounds: 0,
      totalTokens: 0,
      totalCost: 0,
      totalDurationMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.trace(session.id, 'session-start', { data: { question, config: sessionConfig } });
    this.emit('session:start', session);

    const startTime = performance.now();

    try {
      session.status = 'running';

      // Initialize adapters for all members
      await this.initializeAdapters(members);

      // Separate active members and backups
      const activeMembers = members
        .filter(m => m.isActive && m.role !== 'backup')
        .slice(0, sessionConfig.councilSize);
      const backupMembers = members
        .filter(m => m.role === 'backup')
        .slice(0, sessionConfig.backupMembersCount);

      // Stage 1: Gather opinions
      const opinionsResult = await this.runOpinionsStage(session, activeMembers);
      session.stages.push(opinionsResult);

      // Stage 2: Review and critique
      const reviewResult = await this.runReviewStage(session, activeMembers, opinionsResult);
      session.stages.push(reviewResult);

      // Stage 3: Voting
      const votingResult = await this.runVotingStage(session, activeMembers, reviewResult);
      session.stages.push(votingResult);

      // Check if self-correction is needed
      let finalResult = votingResult;
      if (
        sessionConfig.selfCorrectionEnabled &&
        votingResult.votingResult &&
        votingResult.votingResult.confidenceAvg < sessionConfig.selfCorrectionThreshold
      ) {
        finalResult = await this.runSelfCorrection(
          session,
          activeMembers,
          backupMembers,
          votingResult
        );
      }

      // Stage 4: Synthesis
      const synthesisResult = await this.runSynthesisStage(
        session,
        members.filter(m => m.role === 'synthesizer'),
        finalResult
      );
      session.stages.push(synthesisResult);

      // Extract final answer
      const synthesizerResponse = synthesisResult.responses[0];
      session.finalAnswer = synthesizerResponse?.content ?? null;
      session.finalConfidence = finalResult.votingResult?.confidenceAvg ?? null;
      session.status = 'completed';
      session.completedAt = new Date().toISOString();

    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', error instanceof Error ? error : new Error(String(error)), session);
    } finally {
      const endTime = performance.now();
      session.totalDurationMs = endTime - startTime;
      session.updatedAt = new Date().toISOString();

      // Calculate totals
      for (const stage of session.stages) {
        for (const response of stage.responses) {
          session.totalTokens += response.tokenUsage?.totalTokens ?? 0;
        }
      }

      this.trace(session.id, 'session-end', { 
        data: { 
          status: session.status, 
          durationMs: session.totalDurationMs,
          totalTokens: session.totalTokens,
        } 
      });
      this.emit('session:end', session);

      // Cleanup adapters
      await this.disposeAdapters();
    }

    return session;
  }

  /**
   * Stage 1: Gather initial opinions from council members
   */
  private async runOpinionsStage(
    session: Session,
    members: CouncilMember[]
  ): Promise<StageResult> {
    const stage: PipelineStage = 'opinions';
    const startTime = new Date();
    
    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const opinionGivers = members.filter(
      m => m.role === 'opinion-giver' || m.role !== 'synthesizer'
    );

    const systemPrompt = `You are a member of an LLM council. Your task is to provide your honest, well-reasoned opinion on the question presented. Be thorough but concise. Consider multiple perspectives but commit to a position.`;

    const responses = await this.queryMembers(session.id, opinionGivers, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: session.question },
    ], session.config.parallelExecution);

    const endTime = new Date();
    const result: StageResult = {
      stage,
      responses,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    };

    this.trace(session.id, 'stage-end', { stage, durationMs: result.durationMs });
    this.emit('stage:end', stage, result, session);

    return result;
  }

  /**
   * Stage 2: Members review and critique each other's opinions
   */
  private async runReviewStage(
    session: Session,
    members: CouncilMember[],
    opinionsResult: StageResult
  ): Promise<StageResult> {
    const stage: PipelineStage = 'review';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const reviewers = members.filter(m => m.role === 'reviewer' || m.role === 'opinion-giver');

    // Format opinions for review
    const opinionsText = opinionsResult.responses
      .map((r, i) => `**Opinion ${i + 1} (${r.memberName}):**\n${r.content}`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are a reviewer on an LLM council. Your task is to critically evaluate the opinions provided, identify strengths, weaknesses, and potential biases. Consider which positions are most defensible and why.`;

    const responses = await this.queryMembers(session.id, reviewers, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${session.question}\n\n${opinionsText}\n\nProvide your critical review of these opinions.` },
    ], session.config.parallelExecution);

    const endTime = new Date();
    const result: StageResult = {
      stage,
      responses,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    };

    this.trace(session.id, 'stage-end', { stage, durationMs: result.durationMs });
    this.emit('stage:end', stage, result, session);

    return result;
  }

  /**
   * Stage 3: Voting on positions
   */
  private async runVotingStage(
    session: Session,
    members: CouncilMember[],
    _reviewResult: StageResult // Review context is captured in session.stages
  ): Promise<StageResult> {
    const stage: PipelineStage = 'voting';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const voters = members.filter(m => m.role !== 'synthesizer');

    // Format the debate context
    const previousStages = session.stages
      .map(s => s.responses.map(r => `**${r.memberName}:** ${r.content}`).join('\n\n'))
      .join('\n\n---\n\n');

    const systemPrompt = `You are voting on the LLM council. Based on the discussion, cast your vote by:
1. Stating your POSITION (your answer/stance)
2. Providing your CONFIDENCE (0.0 to 1.0)
3. Explaining your REASONING briefly

Format your response as:
POSITION: [your answer]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]`;

    const responses = await this.queryMembers(session.id, voters, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${session.question}\n\nDebate:\n${previousStages}\n\nCast your vote.` },
    ], session.config.parallelExecution);

    // Parse votes from responses
    const votes: Vote[] = responses.map(r => this.parseVote(r.memberId, r.memberName, r.content));

    // Apply voting strategy
    const votingStrategy = createVotingStrategy(
      session.config.votingMethod,
      { memberWeights: new Map(members.map(m => [m.id, m.weight])) }
    );
    const votingResult = votingStrategy.tally(votes);

    for (const vote of votes) {
      this.emit('vote:cast', vote);
    }
    this.emit('voting:complete', votingResult);

    const endTime = new Date();
    const result: StageResult = {
      stage,
      responses,
      votingResult,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    };

    this.trace(session.id, 'stage-end', { 
      stage, 
      durationMs: result.durationMs,
      data: { winner: votingResult.winner, confidenceAvg: votingResult.confidenceAvg },
    });
    this.emit('stage:end', stage, result, session);

    return result;
  }

  /**
   * Self-correction: Bring in backup members when confidence is low
   */
  private async runSelfCorrection(
    session: Session,
    activeMembers: CouncilMember[],
    backupMembers: CouncilMember[],
    previousResult: StageResult
  ): Promise<StageResult> {
    let currentResult = previousResult;
    let round = 0;

    while (
      round < session.config.maxCorrectionRounds &&
      currentResult.votingResult &&
      currentResult.votingResult.confidenceAvg < session.config.selfCorrectionThreshold &&
      backupMembers.length > round
    ) {
      round++;
      session.correctionRounds = round;

      const reason = `Confidence ${currentResult.votingResult.confidenceAvg.toFixed(2)} < threshold ${session.config.selfCorrectionThreshold}`;
      this.trace(session.id, 'correction-triggered', { data: { round, reason } });
      this.emit('correction:triggered', round, reason);

      // Activate backup member
      const backup = backupMembers[round - 1];
      if (!backup) break;

      this.trace(session.id, 'backup-activated', { 
        memberId: backup.id, 
        memberName: backup.name,
        data: { round },
      });

      // Re-run voting with additional member
      const augmentedMembers = [...activeMembers, backup];
      currentResult = await this.runVotingStage(session, augmentedMembers, currentResult);
      session.stages.push(currentResult);
    }

    return currentResult;
  }

  /**
   * Stage 4: Synthesize final answer
   */
  private async runSynthesisStage(
    session: Session,
    synthesizers: CouncilMember[],
    finalVotingResult: StageResult
  ): Promise<StageResult> {
    const stage: PipelineStage = 'synthesis';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    // If no designated synthesizer, use the first member
    const synthesizer = synthesizers[0] ?? session.members[0];
    if (!synthesizer) {
      throw new Error('No synthesizer available');
    }

    const debateHistory = session.stages
      .map(s => `## ${s.stage.toUpperCase()}\n${s.responses.map(r => `**${r.memberName}:** ${r.content}`).join('\n\n')}`)
      .join('\n\n---\n\n');

    const votingInfo = finalVotingResult.votingResult
      ? `\n\nVoting Result: ${finalVotingResult.votingResult.winner ?? 'No consensus'} (Confidence: ${finalVotingResult.votingResult.confidenceAvg.toFixed(2)})`
      : '';

    const systemPrompt = `You are the synthesizer for an LLM council. Your task is to:
1. Synthesize the council's discussion into a coherent final answer
2. Present the consensus view while acknowledging dissent
3. Be clear, comprehensive, and actionable
4. If there was no clear consensus, present the strongest position with caveats`;

    const responses = await this.queryMembers(session.id, [synthesizer], [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${session.question}\n\nCouncil Discussion:\n${debateHistory}${votingInfo}\n\nSynthesize the final answer.` },
    ], false);

    const endTime = new Date();
    const result: StageResult = {
      stage,
      responses,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    };

    this.trace(session.id, 'stage-end', { stage, durationMs: result.durationMs });
    this.emit('stage:end', stage, result, session);

    return result;
  }

  /**
   * Query multiple members (parallel or sequential)
   */
  private async queryMembers(
    sessionId: string,
    members: CouncilMember[],
    messages: Message[],
    parallel: boolean
  ): Promise<StageResult['responses']> {
    if (parallel) {
      const promises = members.map(m => this.queryMember(sessionId, m, messages));
      return Promise.all(promises);
    } else {
      const results: StageResult['responses'] = [];
      for (const member of members) {
        results.push(await this.queryMember(sessionId, member, messages));
      }
      return results;
    }
  }

  /**
   * Query a single member
   */
  private async queryMember(
    sessionId: string,
    member: CouncilMember,
    messages: Message[]
  ): Promise<StageResult['responses'][number]> {
    const adapter = this.adapters.get(member.id);
    if (!adapter) {
      throw new Error(`No adapter found for member: ${member.id}`);
    }

    // Prepend member's custom system prompt if present
    const finalMessages: Message[] = member.systemPrompt
      ? [{ role: 'system', content: member.systemPrompt }, ...messages]
      : messages;

    this.trace(sessionId, 'member-request', { 
      memberId: member.id, 
      memberName: member.name,
    });
    this.emit('member:request', member, finalMessages);

    const response = await adapter.complete(finalMessages, {
      maxTokens: member.modelConfig.maxTokens,
      temperature: member.modelConfig.temperature,
    });

    this.trace(sessionId, 'member-response', {
      memberId: member.id,
      memberName: member.name,
      durationMs: response.latencyMs,
      data: { tokens: response.tokenUsage?.totalTokens },
    });
    this.emit('member:response', member, response.content, response.latencyMs);

    return {
      memberId: member.id,
      memberName: member.name,
      modelId: member.modelConfig.id,
      content: response.content,
      tokenUsage: response.tokenUsage,
      latencyMs: response.latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse a vote from model response
   */
  private parseVote(memberId: string, memberName: string, content: string): Vote {
    const positionMatch = content.match(/POSITION:\s*(.+?)(?=\n|CONFIDENCE|$)/is);
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasoningMatch = content.match(/REASONING:\s*(.+?)$/is);

    return {
      memberId,
      memberName,
      position: positionMatch?.[1]?.trim() ?? content.slice(0, 100),
      confidence: parseFloat(confidenceMatch?.[1] ?? '0.7'),
      reasoning: reasoningMatch?.[1]?.trim() ?? '',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Initialize adapters for all members
   */
  private async initializeAdapters(members: CouncilMember[]): Promise<void> {
    for (const member of members) {
      if (!this.adapters.has(member.id)) {
        const adapter = createAdapter(member.modelConfig);
        await adapter.initialize();
        this.adapters.set(member.id, adapter);
      }
    }
  }

  /**
   * Clean up all adapters
   */
  private async disposeAdapters(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();
  }

  /**
   * Get all traces for a session
   */
  getTraces(sessionId?: string): TraceEvent[] {
    if (sessionId) {
      return this.traces.filter(t => t.sessionId === sessionId);
    }
    return [...this.traces];
  }

  /**
   * Clear traces
   */
  clearTraces(): void {
    this.traces = [];
  }
}

import type { FastifyPluginAsync } from 'fastify';
import { sessionRepository } from '../services/repository.js';
// import type { Session } from '@llm-council/core'; // Unused

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * List all sessions
   */
  fastify.get('/', async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? '20', 10);
    const offset = parseInt(query.offset ?? '0', 10);

    const allSessions = await sessionRepository.list();

    const paginated = allSessions.slice(offset, offset + limit);

    return {
      sessions: paginated.map(s => ({
        id: s.id,
        question: s.question.slice(0, 100) + (s.question.length > 100 ? '...' : ''),
        status: s.status,
        finalConfidence: s.finalConfidence,
        totalDurationMs: s.totalDurationMs,
        createdAt: s.createdAt,
      })),
      total: allSessions.length,
      limit,
      offset,
    };
  });

  /**
   * Get session by ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const session = await sessionRepository.get(request.params.id);
    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }
    return session;
  });

  /**
   * Delete session
   */
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    await sessionRepository.delete(request.params.id);
    return { success: true };
  });

  /**
   * Export session
   */
  fastify.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/:id/export',
    async (request, reply) => {
      const session = await sessionRepository.get(request.params.id);
      if (!session) {
        reply.code(404);
        return { error: 'Session not found' };
      }

      const format = request.query.format ?? 'json';

      if (format === 'json') {
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="session-${session.id}.json"`);
        return session;
      }

      if (format === 'markdown') {
        reply.header('Content-Type', 'text/markdown');
        reply.header('Content-Disposition', `attachment; filename="session-${session.id}.md"`);
        return formatSessionAsMarkdown(session);
      }

      reply.code(400);
      return { error: 'Unsupported format. Use json or markdown.' };
    }
  );
};

/**
 * Format session as markdown
 */
function formatSessionAsMarkdown(session: any): string {
  const lines: string[] = [
    `# LLM Council Session`,
    ``,
    `**ID:** ${session.id}`,
    `**Created:** ${session.createdAt}`,
    `**Status:** ${session.status}`,
    `**Duration:** ${session.totalDurationMs}ms`,
    `**Total Tokens:** ${session.totalTokens}`,
    ``,
    `## Question`,
    ``,
    session.question,
    ``,
    `## Final Answer`,
    ``,
    session.finalAnswer ?? '_No answer generated_',
    ``,
    `**Confidence:** ${session.finalConfidence?.toFixed(2) ?? 'N/A'}`,
    ``,
    `## Stages`,
    ``,
  ];

  for (const stage of session.stages) {
    lines.push(`### ${stage.stage.toUpperCase()}`);
    lines.push(`_Duration: ${stage.durationMs}ms_`);
    lines.push(``);

    for (const response of stage.responses) {
      lines.push(`#### ${response.memberName}`);
      lines.push(`_Model: ${response.modelId} | Latency: ${response.latencyMs}ms | Tokens: ${response.tokenUsage?.totalTokens ?? 'N/A'}_`);
      lines.push(``);
      lines.push(response.content);
      lines.push(``);
    }

    if (stage.votingResult) {
      lines.push(`#### Voting Result`);
      lines.push(`- **Winner:** ${stage.votingResult.winner ?? 'No consensus'}`);
      lines.push(`- **Method:** ${stage.votingResult.method}`);
      lines.push(`- **Confidence:** ${stage.votingResult.confidenceAvg.toFixed(2)}`);
      lines.push(`- **Consensus Reached:** ${stage.votingResult.consensusReached}`);
      lines.push(``);
    }
  }

  lines.push(`## Council Members`);
  lines.push(``);

  for (const member of session.members) {
    lines.push(`- **${member.name}** (${member.modelConfig.name}) - ${member.role}`);
  }

  return lines.join('\n');
}

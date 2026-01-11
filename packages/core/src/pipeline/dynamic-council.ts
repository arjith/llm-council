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
  IterationConfig,
  MemoryConfig,
  MetaCouncilConfig,
  MetaCouncilConfigInput,
} from '../types.js';
import { createAdapter, type ModelAdapter } from '../adapters/index.js';
import { createVotingStrategy } from '../voting/index.js';
import { MetaCouncil, createMetaCouncil, type DynamicCouncilConfigOutput } from '../meta-council.js';
import { IterationController, createIterationController } from '../iteration-controller.js';
import { MemoryManager, createMemoryManager } from '../memory-manager.js';
import { buildSystemPrompt, ROLE_PROMPTS } from '../prompts.js';
import { AZURE_MODELS, createMember } from '../presets.js';

/**
 * Events emitted by the dynamic council pipeline
 */
export interface DynamicCouncilEvents {
  'session:start': (session: Session) => void;
  'session:end': (session: Session) => void;
  'planning:start': (question: string) => void;
  'planning:end': (config: DynamicCouncilConfigOutput) => void;
  'iteration:start': (iteration: number, maxIterations: number) => void;
  'iteration:end': (iteration: number, confidence: number) => void;
  'stage:start': (stage: PipelineStage, session: Session) => void;
  'stage:end': (stage: PipelineStage, result: StageResult, session: Session) => void;
  'member:request': (member: CouncilMember, messages: Message[]) => void;
  'member:response': (member: CouncilMember, content: string, latencyMs: number) => void;
  'vote:cast': (vote: Vote) => void;
  'voting:complete': (result: VotingResult) => void;
  'correction:triggered': (round: number, reason: string) => void;
  'memory:compressed': (tokensBefore: number, tokensAfter: number) => void;
  'trace': (event: TraceEvent) => void;
  'error': (error: Error, context: unknown) => void;
}

type EventHandler<T extends keyof DynamicCouncilEvents> = DynamicCouncilEvents[T];

/**
 * Extended Session with Dynamic Council Info
 */
export interface DynamicSession extends Session {
  dynamicConfig?: DynamicCouncilConfigOutput;
  iterations: {
    number: number;
    confidence: number;
    tokensUsed: number;
    durationMs: number;
  }[];
}

/**
 * Options for running a dynamic council
 */
export interface DynamicCouncilOptions {
  // Use pre-configured council
  config?: DynamicCouncilConfigOutput;
  
  // Or use meta-council planning
  metaConfig?: MetaCouncilConfigInput;
  
  // Override iteration settings
  iterationConfig?: Partial<IterationConfig>;
  
  // Override memory settings
  memoryConfig?: Partial<MemoryConfig>;
  
  // Standard session config overrides
  sessionConfig?: Partial<SessionConfig>;
  
  // Skip meta-council planning
  skipPlanning?: boolean;
}

/**
 * Dynamic LLM Council Pipeline
 * Enhanced pipeline with meta-council planning, iteration control, and memory
 */
export class DynamicCouncilPipeline {
  private adapters: Map<string, ModelAdapter> = new Map();
  private eventHandlers: Map<keyof DynamicCouncilEvents, Set<Function>> = new Map();
  private traces: TraceEvent[] = [];
  
  private metaCouncil?: MetaCouncil;
  private iterationController?: IterationController;
  private memoryManager?: MemoryManager;

  constructor() {}

  /**
   * Register an event handler
   */
  on<T extends keyof DynamicCouncilEvents>(event: T, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   */
  off<T extends keyof DynamicCouncilEvents>(event: T, handler: EventHandler<T>): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event
   */
  private emit<T extends keyof DynamicCouncilEvents>(
    event: T,
    ...args: Parameters<DynamicCouncilEvents[T]>
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
   * Run the dynamic council pipeline
   */
  async run(
    question: string,
    options: DynamicCouncilOptions = {}
  ): Promise<DynamicSession> {
    const sessionId = nanoid();
    const startTime = performance.now();

    // Step 1: Plan the council configuration
    let dynamicConfig: DynamicCouncilConfigOutput;
    
    if (options.config && options.skipPlanning) {
      // Use provided config directly
      dynamicConfig = options.config;
    } else {
      // Use meta-council to plan
      this.emit('planning:start', question);
      dynamicConfig = await this.planCouncil(question, options.metaConfig);
      this.emit('planning:end', dynamicConfig);
    }

    // Apply any overrides
    if (options.iterationConfig) {
      dynamicConfig.iteration = { ...dynamicConfig.iteration, ...options.iterationConfig };
    }
    if (options.memoryConfig) {
      dynamicConfig.memory = { ...dynamicConfig.memory, ...options.memoryConfig };
    }

    // Step 2: Create council members from config
    const members = this.createMembersFromConfig(dynamicConfig);

    // Step 3: Initialize components
    await this.initializeAdapters(members);
    
    this.iterationController = createIterationController(dynamicConfig.iteration);
    this.iterationController.setQuestion(question);
    
    // Get an adapter for memory manager (use first member's adapter if available)
    const firstMember = members[0];
    const memoryAdapter = firstMember ? this.adapters.get(firstMember.id) : undefined;
    
    this.memoryManager = createMemoryManager(
      dynamicConfig.memory,
      memoryAdapter
    );
    this.memoryManager.setQuestion(question);

    // Step 4: Build session
    const sessionConfig: SessionConfig = {
      councilSize: dynamicConfig.council.size,
      votingMethod: dynamicConfig.council.voting?.method ?? 'majority',
      selfCorrectionEnabled: true,
      selfCorrectionThreshold: 0.6,
      maxCorrectionRounds: 2,
      backupMembersCount: 2,
      parallelExecution: true,
      timeoutMs: dynamicConfig.iteration?.maxDurationMs ?? 120000,
      debugMode: options.sessionConfig?.debugMode ?? false,
      ...options.sessionConfig,
    };

    const session: DynamicSession = {
      id: sessionId,
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
      dynamicConfig,
      iterations: [],
    };

    this.trace(session.id, 'session-start', { 
      data: { 
        question, 
        config: sessionConfig,
        dynamicConfig,
      } 
    });
    this.emit('session:start', session);

    try {
      session.status = 'running';

      // Step 5: Run iterations
      await this.runIterativeCouncil(session, members);

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
          iterations: session.iterations.length,
        } 
      });
      this.emit('session:end', session);

      // Cleanup
      await this.disposeAdapters();
    }

    return session;
  }

  /**
   * Plan council configuration using meta-council
   */
  private async planCouncil(
    question: string,
    metaConfig?: MetaCouncilConfigInput
  ): Promise<DynamicCouncilConfigOutput> {
    // Create planner adapter for LLM-based planning
    let plannerAdapter: ModelAdapter | undefined;
    
    if (metaConfig?.planningMode !== 'static') {
      try {
        const plannerModel = metaConfig?.plannerModel ?? 'gpt-5-mini';
        const modelConfig = AZURE_MODELS[plannerModel as keyof typeof AZURE_MODELS];
        if (modelConfig) {
          plannerAdapter = createAdapter(modelConfig);
          await plannerAdapter.initialize();
        }
      } catch (error) {
        console.warn('Failed to create planner adapter:', error);
      }
    }

    this.metaCouncil = createMetaCouncil(metaConfig, plannerAdapter);
    const config = await this.metaCouncil.plan(question);

    // Cleanup planner adapter
    if (plannerAdapter) {
      await plannerAdapter.dispose();
    }

    return config;
  }

  /**
   * Create council members from dynamic config
   */
  private createMembersFromConfig(config: DynamicCouncilConfigOutput): CouncilMember[] {
    const members: CouncilMember[] = [];

    for (let i = 0; i < config.council.members.length; i++) {
      const memberConfig = config.council.members[i];
      if (!memberConfig) continue;
      
      const modelKey = memberConfig.model as keyof typeof AZURE_MODELS;
      const modelConfig = AZURE_MODELS[modelKey];

      if (!modelConfig) {
        console.warn(`Unknown model: ${memberConfig.model}, skipping`);
        continue;
      }

      // Build system prompt from role and persona
      const systemPrompt = buildSystemPrompt(
        memberConfig.role,
        memberConfig.persona,
        memberConfig.systemPrompt
      );

      const member = createMember(modelKey, {
        role: memberConfig.role,
        weight: memberConfig.weight ?? 1,
      });

      // Override with dynamic config
      members.push({
        ...member,
        id: `${memberConfig.role}-${i}-${nanoid(6)}`,
        name: memberConfig.persona ?? `${memberConfig.role} (${memberConfig.model})`,
        systemPrompt,
        persona: memberConfig.persona,
        temperature: memberConfig.temperature,
      });
    }

    return members;
  }

  /**
   * Run iterative council process
   */
  private async runIterativeCouncil(
    session: DynamicSession,
    members: CouncilMember[]
  ): Promise<void> {
    const maxIterations = session.dynamicConfig?.iteration?.maxIterations ?? 1;
    let iterationNumber = 0;

    while (true) {
      iterationNumber++;
      const iterationStart = performance.now();

      this.emit('iteration:start', iterationNumber, maxIterations);

      // Check if we should continue
      const continueCheck = this.iterationController!.shouldContinue();
      if (!continueCheck.continue && iterationNumber > 1) {
        console.log(`Stopping: ${continueCheck.reason}`);
        break;
      }

      // Get context for this iteration
      const iterationContext = this.iterationController!.getContext();
      const contextPrompt = iterationNumber > 1 
        ? this.iterationController!.getContextPrompt()
        : '';

      // Run the council stages
      const activeMembers = members.filter(m => m.isActive && m.role !== 'backup');
      const backupMembers = members.filter(m => m.role === 'backup');

      // Stage 1: Opinions
      const opinionsResult = await this.runOpinionsStage(
        session, 
        activeMembers,
        contextPrompt
      );
      session.stages.push(opinionsResult);

      // Stage 2: Review
      const reviewResult = await this.runReviewStage(
        session,
        activeMembers,
        opinionsResult,
        contextPrompt
      );
      session.stages.push(reviewResult);

      // Stage 3: Voting
      const votingResult = await this.runVotingStage(
        session,
        activeMembers,
        reviewResult
      );
      session.stages.push(votingResult);

      // Self-correction if needed
      let finalResult = votingResult;
      if (
        session.config.selfCorrectionEnabled &&
        votingResult.votingResult &&
        votingResult.votingResult.confidenceAvg < session.config.selfCorrectionThreshold
      ) {
        finalResult = await this.runSelfCorrection(
          session,
          activeMembers,
          backupMembers,
          votingResult
        );
      }

      // Update iteration tracking
      const iterationEnd = performance.now();
      const tokensThisIteration = session.stages
        .slice(-3)
        .reduce((sum, s) => sum + s.responses.reduce((t, r) => t + (r.tokenUsage?.totalTokens ?? 0), 0), 0);

      session.iterations.push({
        number: iterationNumber,
        confidence: finalResult.votingResult?.confidenceAvg ?? 0,
        tokensUsed: tokensThisIteration,
        durationMs: iterationEnd - iterationStart,
      });

      // Record iteration in controller
      this.iterationController!.recordIteration(finalResult, tokensThisIteration);

      // Update memory
      this.memoryManager!.updateFromStageResult(finalResult, iterationNumber);

      // Compress memory if needed
      if (this.memoryManager!.isOverLimit()) {
        const statsBefore = this.memoryManager!.getStats();
        await this.memoryManager!.compress();
        const statsAfter = this.memoryManager!.getStats();
        this.emit('memory:compressed', statsBefore.estimatedTokens, statsAfter.estimatedTokens);
      }

      this.emit('iteration:end', iterationNumber, finalResult.votingResult?.confidenceAvg ?? 0);

      // Check limits again
      const shouldStop = this.iterationController!.shouldContinue();
      if (!shouldStop.continue) {
        console.log(`Completed: ${shouldStop.reason}`);
        break;
      }

      // Continue only if iterations are enabled
      if (!session.dynamicConfig?.iteration?.enabled) {
        break;
      }
    }

    // Final synthesis
    const synthesizers = members.filter(m => m.role === 'synthesizer');
    const lastVotingStage = session.stages
      .filter(s => s.stage === 'voting')
      .at(-1);

    if (lastVotingStage) {
      const synthesisResult = await this.runSynthesisStage(
        session,
        synthesizers,
        lastVotingStage
      );
      session.stages.push(synthesisResult);

      // Extract final answer
      const synthesizerResponse = synthesisResult.responses[0];
      session.finalAnswer = synthesizerResponse?.content ?? null;
      session.finalConfidence = lastVotingStage.votingResult?.confidenceAvg ?? null;
    }
  }

  /**
   * Stage 1: Gather opinions with context
   */
  private async runOpinionsStage(
    session: DynamicSession,
    members: CouncilMember[],
    contextPrompt: string = ''
  ): Promise<StageResult> {
    const stage: PipelineStage = 'opinions';
    const startTime = new Date();
    
    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const opinionGivers = members.filter(
      m => m.role === 'opinion-giver' || 
           m.role === 'devil-advocate' ||
           m.role === 'creative' ||
           m.role === 'domain-expert' ||
           m.role === 'skeptic'
    );

    const userPrompt = contextPrompt
      ? `${contextPrompt}\n\n---\n\nQuestion: ${session.question}`
      : session.question;

    const responses = await this.queryMembers(session.id, opinionGivers, [
      { role: 'user', content: userPrompt },
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
   * Stage 2: Review with context
   */
  private async runReviewStage(
    session: DynamicSession,
    members: CouncilMember[],
    opinionsResult: StageResult,
    contextPrompt: string = ''
  ): Promise<StageResult> {
    const stage: PipelineStage = 'review';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const reviewers = members.filter(
      m => m.role === 'reviewer' || 
           m.role === 'fact-checker' ||
           m.role === 'critic'
    );

    // Format opinions for review
    const opinionsText = opinionsResult.responses
      .map((r, i) => `**Opinion ${i + 1} (${r.memberName}):**\n${r.content}`)
      .join('\n\n---\n\n');

    const userPrompt = contextPrompt
      ? `${contextPrompt}\n\n---\n\nQuestion: ${session.question}\n\n${opinionsText}\n\nProvide your critical review.`
      : `Question: ${session.question}\n\n${opinionsText}\n\nProvide your critical review of these opinions.`;

    const responses = await this.queryMembers(session.id, reviewers, [
      { role: 'user', content: userPrompt },
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
   * Stage 3: Voting
   */
  private async runVotingStage(
    session: DynamicSession,
    members: CouncilMember[],
    _reviewResult: StageResult
  ): Promise<StageResult> {
    const stage: PipelineStage = 'voting';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const voters = members.filter(m => m.role !== 'synthesizer' && m.role !== 'moderator');

    // Format debate context
    const recentStages = session.stages.slice(-4);
    const previousStages = recentStages
      .map(s => s.responses.map(r => `**${r.memberName}:** ${r.content.slice(0, 500)}...`).join('\n\n'))
      .join('\n\n---\n\n');

    const systemPrompt = `Cast your vote based on the discussion:
1. POSITION: Your answer/stance
2. CONFIDENCE: 0.0 to 1.0
3. REASONING: Brief explanation

Format:
POSITION: [your answer]
CONFIDENCE: [0.0-1.0]
REASONING: [brief explanation]`;

    const responses = await this.queryMembers(session.id, voters, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${session.question}\n\nDebate:\n${previousStages}\n\nCast your vote.` },
    ], session.config.parallelExecution);

    // Parse votes
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
   * Self-correction with backup members
   */
  private async runSelfCorrection(
    session: DynamicSession,
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

      const backup = backupMembers[round - 1];
      if (!backup) break;

      this.trace(session.id, 'backup-activated', { 
        memberId: backup.id, 
        memberName: backup.name,
      });

      const augmentedMembers = [...activeMembers, backup];
      currentResult = await this.runVotingStage(session, augmentedMembers, currentResult);
      session.stages.push(currentResult);
    }

    return currentResult;
  }

  /**
   * Final synthesis
   */
  private async runSynthesisStage(
    session: DynamicSession,
    synthesizers: CouncilMember[],
    finalVotingResult: StageResult
  ): Promise<StageResult> {
    const stage: PipelineStage = 'synthesis';
    const startTime = new Date();

    this.trace(session.id, 'stage-start', { stage });
    this.emit('stage:start', stage, session);

    const synthesizer = synthesizers[0] ?? session.members[0];
    if (!synthesizer) {
      throw new Error('No synthesizer available');
    }

    // Build debate history
    const debateHistory = session.stages
      .slice(-6)
      .map(s => `## ${s.stage.toUpperCase()}\n${s.responses.map(r => `**${r.memberName}:** ${r.content.slice(0, 300)}...`).join('\n\n')}`)
      .join('\n\n---\n\n');

    const votingInfo = finalVotingResult.votingResult
      ? `\n\nVoting Result: ${finalVotingResult.votingResult.winner ?? 'No consensus'} (Confidence: ${finalVotingResult.votingResult.confidenceAvg.toFixed(2)})`
      : '';

    // Add iteration info
    const iterationInfo = session.iterations.length > 1
      ? `\n\nIterations completed: ${session.iterations.length}, Confidence trend: ${session.iterations.map(i => i.confidence.toFixed(2)).join(' → ')}`
      : '';

    const responses = await this.queryMembers(session.id, [synthesizer], [
      { role: 'user', content: `Question: ${session.question}\n\nCouncil Discussion:\n${debateHistory}${votingInfo}${iterationInfo}\n\nSynthesize the final answer.` },
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
   * Query multiple members
   */
  private async queryMembers(
    sessionId: string,
    members: CouncilMember[],
    messages: Message[],
    parallel: boolean
  ): Promise<StageResult['responses']> {
    if (parallel) {
      return Promise.all(members.map(m => this.queryMember(sessionId, m, messages)));
    }
    
    const results: StageResult['responses'] = [];
    for (const member of members) {
      results.push(await this.queryMember(sessionId, member, messages));
    }
    return results;
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

    // Build final messages with system prompt
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
      temperature: member.temperature ?? member.modelConfig.temperature,
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
   * Parse vote from response
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
   * Initialize adapters
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
   * Cleanup adapters
   */
  private async disposeAdapters(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();
  }

  /**
   * Analyze a question without running (for preview)
   */
  async analyze(question: string, metaConfig?: MetaCouncilConfigInput): Promise<DynamicCouncilConfigOutput> {
    return this.planCouncil(question, metaConfig);
  }

  /**
   * Get traces
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

/**
 * Factory function
 */
export function createDynamicCouncilPipeline(): DynamicCouncilPipeline {
  return new DynamicCouncilPipeline();
}

export default DynamicCouncilPipeline;

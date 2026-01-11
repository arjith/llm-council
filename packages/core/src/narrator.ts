import type { ModelAdapter } from './adapters/base.js';
import type { CouncilMember, PipelineStage, Vote, VotingResult, TraceEvent } from './types.js';

/**
 * Events that can trigger narration
 */
export interface NarratorEvent {
  type: 'session_start' | 'stage_start' | 'stage_end' | 'member_request' | 'member_response' | 
        'vote_cast' | 'voting_complete' | 'correction_triggered' | 'synthesis_start' | 'session_end';
  sessionId: string;
  timestamp: string;
  data: {
    stage?: PipelineStage;
    memberName?: string;
    memberId?: string;
    model?: string;
    latencyMs?: number;
    responseCount?: number;
    durationMs?: number;
    confidence?: number;
    winner?: string | null;
    consensusReached?: boolean;
    breakdown?: Record<string, number>;
    round?: number;
    reason?: string;
    status?: string;
    totalMembers?: number;
    completedMembers?: number;
  };
}

/**
 * Narrator configuration
 */
export interface NarratorConfig {
  /** Model to use for narration (default: gpt-4o-mini equivalent) */
  model: string;
  /** Enable streaming narration */
  streaming: boolean;
  /** Debounce time for batching events (ms) */
  debounceMs: number;
  /** Max events to batch before forcing narration */
  maxBatchSize: number;
  /** Temperature for narrative generation */
  temperature: number;
  /** Max tokens for each narration */
  maxTokens: number;
}

const DEFAULT_NARRATOR_CONFIG: NarratorConfig = {
  model: 'gpt-5-mini', // Fast and cheap
  streaming: false,
  debounceMs: 500,
  maxBatchSize: 5,
  temperature: 0.7,
  maxTokens: 150,
};

const NARRATOR_SYSTEM_PROMPT = `You are a friendly progress narrator for an AI Council system. Generate brief, engaging 1-2 sentence updates about what the AI council is doing.

Guidelines:
- Be specific about which AI models are active (use their names: GPT-5, o4-mini, o3-mini, etc.)
- Use present progressive tense ("is analyzing", "are voting")
- Be conversational but professional
- Mention the stage (opinions, review, voting, synthesis) naturally
- Include relevant context (confidence levels, consensus status) when provided
- Keep updates varied - don't repeat the same phrases
- Add personality - be slightly witty but not over the top
- Never use technical jargon like "tokens" or "latency" or "API"

Example outputs:
- "GPT-5 is diving deep into the question, examining all angles..."
- "o4-mini weighs in with lightning speed! Now waiting on the others..."
- "All five council members have shared their perspectives. Let the debate begin!"
- "The vote is heating up - slight edge for Option A, but it's close..."
- "Final synthesis in progress - weaving together the council's collective wisdom..."`;

/**
 * LLM Narrator - Generates human-friendly progress updates during council sessions
 */
export class LLMNarrator {
  private config: NarratorConfig;
  private adapter?: ModelAdapter;
  private eventBuffer: NarratorEvent[] = [];
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private narrateCallback?: (narration: string) => void;

  constructor(config: Partial<NarratorConfig> = {}, adapter?: ModelAdapter) {
    this.config = { ...DEFAULT_NARRATOR_CONFIG, ...config };
    this.adapter = adapter;
  }

  /**
   * Set the adapter for LLM narration
   */
  setAdapter(adapter: ModelAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Set callback for narration output
   */
  onNarrate(callback: (narration: string) => void): void {
    this.narrateCallback = callback;
  }

  /**
   * Queue an event for narration (with debouncing)
   */
  queueEvent(event: NarratorEvent): void {
    this.eventBuffer.push(event);

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Force narration if buffer is full
    if (this.eventBuffer.length >= this.config.maxBatchSize) {
      this.flush();
      return;
    }

    // Set debounce timer
    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.config.debounceMs);
  }

  /**
   * Immediately narrate buffered events
   */
  async flush(): Promise<string | null> {
    if (this.eventBuffer.length === 0) {
      return null;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    const narration = await this.narrate(events);
    
    if (narration && this.narrateCallback) {
      this.narrateCallback(narration);
    }

    return narration;
  }

  /**
   * Generate narration for events using LLM
   */
  async narrate(events: NarratorEvent[]): Promise<string> {
    // If no adapter, use template-based narration
    if (!this.adapter) {
      return this.templateNarrate(events);
    }

    try {
      const context = this.buildNarrationContext(events);
      
      const response = await this.adapter.complete(
        [
          { role: 'system', content: NARRATOR_SYSTEM_PROMPT },
          { role: 'user', content: context },
        ],
        {
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        }
      );

      return response.content.trim();
    } catch (error) {
      // Fallback to template narration on error
      console.warn('LLM narration failed, using template:', error);
      return this.templateNarrate(events);
    }
  }

  /**
   * Build context string for LLM narration
   */
  private buildNarrationContext(events: NarratorEvent[]): string {
    const eventDescriptions = events.map(e => this.describeEvent(e)).join('\n');
    
    return `The following events just occurred in the AI council session. Generate a brief, friendly update (1-2 sentences max):

${eventDescriptions}

Remember: Be specific about model names and what's happening. Keep it natural and engaging.`;
  }

  /**
   * Describe a single event for context
   */
  private describeEvent(event: NarratorEvent): string {
    const { type, data } = event;

    switch (type) {
      case 'session_start':
        return `Session started with ${data.totalMembers ?? 'several'} council members`;
      
      case 'stage_start':
        return `Stage '${data.stage}' has begun`;
      
      case 'stage_end':
        return `Stage '${data.stage}' completed with ${data.responseCount ?? 0} responses in ${data.durationMs ?? 0}ms`;
      
      case 'member_request':
        return `${data.memberName ?? 'A member'} (${data.model ?? 'unknown model'}) started processing`;
      
      case 'member_response':
        return `${data.memberName ?? 'A member'} responded in ${data.latencyMs ?? 0}ms`;
      
      case 'vote_cast':
        return `${data.memberName ?? 'A member'} cast their vote with ${((data.confidence ?? 0) * 100).toFixed(0)}% confidence`;
      
      case 'voting_complete':
        return `Voting complete. ${data.consensusReached ? 'Consensus reached!' : 'No clear consensus.'} Winner: "${data.winner ?? 'undecided'}" with average confidence ${((data.confidence ?? 0) * 100).toFixed(0)}%`;
      
      case 'correction_triggered':
        return `Self-correction round ${data.round ?? 0} triggered: ${data.reason ?? 'low confidence'}`;
      
      case 'synthesis_start':
        return `Synthesis stage beginning - combining all perspectives`;
      
      case 'session_end':
        return `Session ended with status: ${data.status ?? 'unknown'}`;
      
      default:
        return `Event: ${type}`;
    }
  }

  /**
   * Template-based fallback narration (no LLM required)
   */
  private templateNarrate(events: NarratorEvent[]): string {
    if (events.length === 0) return '';

    // Use the most significant event
    const event = this.getMostSignificantEvent(events);
    const { type, data } = event;

    const templates: Record<string, string[]> = {
      session_start: [
        `The council is assembling... ${data.totalMembers ?? 'several'} members ready to deliberate.`,
        `Council session initiated! ${data.totalMembers ?? 'Multiple'} AI minds are coming together.`,
      ],
      stage_start: {
        opinions: [
          'Time to hear from the council members. Each will share their perspective...',
          'The opinion-gathering phase has begun. Let\'s see what everyone thinks!',
        ],
        review: [
          'Now for the critical review phase. The council will examine each opinion...',
          'Review time! Members are now critiquing each other\'s positions.',
        ],
        voting: [
          'The votes are being cast! Each member commits to their position...',
          'Voting has commenced. The council is ready to declare their stances.',
        ],
        synthesis: [
          'Time to weave it all together. The final synthesis is underway...',
          'Synthesis in progress - combining the council\'s collective wisdom.',
        ],
      }[data.stage as string] ?? ['Processing...'],
      stage_end: [
        `${data.stage} phase complete. ${data.responseCount ?? 'All'} responses gathered.`,
      ],
      member_request: [
        `${data.memberName ?? 'A council member'} is now analyzing the question...`,
        `${data.memberName ?? 'One of the AI'} is formulating their response...`,
      ],
      member_response: [
        `${data.memberName ?? 'A member'} has spoken! Moving on...`,
        `Got ${data.memberName ?? 'a response'}! ${data.latencyMs ? `(${(data.latencyMs / 1000).toFixed(1)}s)` : ''}`,
      ],
      vote_cast: [
        `${data.memberName ?? 'A member'} casts their vote with ${((data.confidence ?? 0.7) * 100).toFixed(0)}% confidence.`,
      ],
      voting_complete: data.consensusReached
        ? [`The council has reached consensus! "${data.winner ?? 'Decision'}" wins.`]
        : [`Votes are in. "${data.winner ?? 'Leading option'}" is ahead, but opinions vary.`],
      correction_triggered: [
        `Hmm, confidence is low. Bringing in backup members for round ${data.round ?? 1}...`,
        `Self-correction engaged! The council seeks more clarity.`,
      ],
      session_end: [
        `The council has spoken! Session ${data.status === 'completed' ? 'complete' : 'ended'}.`,
      ],
    };

    const templateList = templates[type];
    const template = Array.isArray(templateList) 
      ? templateList[Math.floor(Math.random() * templateList.length)]
      : 'Processing...';

    return template ?? 'The council is working...';
  }

  /**
   * Get the most significant event from a batch
   */
  private getMostSignificantEvent(events: NarratorEvent[]): NarratorEvent {
    // Priority order (highest to lowest significance)
    const priority: NarratorEvent['type'][] = [
      'session_end',
      'voting_complete',
      'correction_triggered',
      'stage_start',
      'stage_end',
      'vote_cast',
      'member_response',
      'member_request',
      'session_start',
    ];

    const sorted = [...events].sort((a, b) => {
      const aIndex = priority.indexOf(a.type);
      const bIndex = priority.indexOf(b.type);
      return aIndex - bIndex;
    });

    return sorted[0]!;
  }

  /**
   * Create a simple progress message without LLM
   */
  static simpleProgress(stage: PipelineStage, memberName?: string, status?: 'start' | 'complete'): string {
    const stageNames: Record<PipelineStage, string> = {
      opinions: 'gathering opinions',
      review: 'reviewing perspectives',
      voting: 'casting votes',
      synthesis: 'synthesizing answer',
      correction: 'performing self-correction',
    };

    if (memberName && status === 'start') {
      return `${memberName} is ${stageNames[stage] || 'processing'}...`;
    }

    if (memberName && status === 'complete') {
      return `${memberName} has finished ${stageNames[stage] || 'their task'}.`;
    }

    return `Council is ${stageNames[stage] || 'working'}...`;
  }
}

/**
 * Create a new LLM Narrator instance
 */
export function createNarrator(config?: Partial<NarratorConfig>, adapter?: ModelAdapter): LLMNarrator {
  return new LLMNarrator(config, adapter);
}

export default LLMNarrator;

# LLM Narrator Research: Real-Time Progress Updates for AI Operations

## Executive Summary

This document outlines patterns and best practices for implementing an "LLM Narrator" - a system that provides human-friendly, real-time progress updates during long-running AI operations. Based on research from Claude Code, Cursor, Vercel AI SDK, and Azure OpenAI patterns.

---

## 1. Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LLM Narrator Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   React UI   │◀───│   Event Stream   │◀───│     Council Pipeline       │ │
│  │  Components  │    │  (WebSocket/SSE) │    │   (Fastify Backend)        │ │
│  └──────────────┘    └──────────────────┘    └────────────────────────────┘ │
│         │                    │                           │                   │
│         ▼                    ▼                           ▼                   │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   Progress   │    │   Raw Events     │    │     Technical Events       │ │
│  │   Display    │    │   + Narration    │    │  (member:start, vote:cast) │ │
│  │  Components  │    │                  │    │                            │ │
│  └──────────────┘    └──────────────────┘    └────────────────────────────┘ │
│                               │                           │                  │
│                               ▼                           │                  │
│                      ┌──────────────────┐                 │                  │
│                      │   LLM Narrator   │◀────────────────┘                  │
│                      │  (gpt-4o-mini)   │                                    │
│                      │  Fast + Cheap    │                                    │
│                      └──────────────────┘                                    │
│                               │                                              │
│                               ▼                                              │
│                      ┌──────────────────┐                                    │
│                      │ Human-Friendly   │                                    │
│                      │    Messages      │                                    │
│                      │ "GPT-5 is now    │                                    │
│                      │  reviewing..."   │                                    │
│                      └──────────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Event Emitter** (Pipeline): Emits raw technical events
2. **Event Aggregator**: Batches events for narration (debouncing)
3. **LLM Narrator**: Converts technical events to friendly messages
4. **Stream Transport**: WebSocket or SSE to frontend
5. **UI Components**: Progress bars, status cards, narrative text

---

## 2. Streaming Transport Options

### Option A: WebSocket (Recommended for LLM Council)

**Already implemented in your codebase!** See [websocket.ts](../packages/api/src/routes/websocket.ts)

```typescript
// Your existing WebSocket implementation already emits these events:
pipeline.on('stage:start', (stage, session) => {
  socket.send(JSON.stringify({
    type: 'stage:start',
    sessionId: session.id,
    stage,
  }));
});

pipeline.on('member:response', (member, content, latencyMs) => {
  socket.send(JSON.stringify({
    type: 'member:response',
    memberId: member.id,
    memberName: member.name,
    content: content.slice(0, 500),
    latencyMs,
  }));
});
```

**Pros**: Bidirectional, real-time, already implemented  
**Cons**: Connection management overhead

### Option B: Server-Sent Events (SSE)

```typescript
// Fastify SSE endpoint
fastify.get('/api/council/stream/:sessionId', async (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const pipeline = new CouncilPipeline();
  
  pipeline.on('progress', (data) => {
    reply.raw.write(`event: progress\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  pipeline.on('narrative', (message) => {
    reply.raw.write(`event: narrative\n`);
    reply.raw.write(`data: ${JSON.stringify({ message })}\n\n`);
  });

  // Run pipeline
  await pipeline.run(question, members, config);
  
  reply.raw.write(`event: complete\n`);
  reply.raw.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
  reply.raw.end();
});
```

**Pros**: Simple, browser-native, auto-reconnect  
**Cons**: Unidirectional only

### Option C: Vercel AI SDK Data Stream Protocol

The Vercel AI SDK uses a structured data stream protocol with SSE:

```typescript
// Message parts in the stream
data: {"type":"start","messageId":"..."}
data: {"type":"text-delta","id":"...","delta":"Hello"}
data: {"type":"tool-input-start","toolCallId":"...","toolName":"..."}
data: {"type":"tool-output-available","toolCallId":"...","output":{...}}
data: {"type":"finish"}
data: [DONE]
```

This pattern can be adapted for progress updates:

```typescript
// Custom progress stream events
data: {"type":"stage-start","stage":"opinions","memberCount":5}
data: {"type":"member-progress","memberId":"gpt-5","status":"querying"}
data: {"type":"narrative","text":"GPT-5 is analyzing the ethical dimensions..."}
data: {"type":"stage-complete","stage":"opinions","progress":40}
```

---

## 3. LLM Narrator Implementation

### System Prompt for Narrator

```typescript
const NARRATOR_SYSTEM_PROMPT = `You are a friendly progress narrator for an AI Council system. 
Generate brief, engaging 1-2 sentence updates about what the AI council is doing.

Guidelines:
- Be specific about which AI models are active (use their names: GPT-5, o4-mini, etc.)
- Use present progressive tense ("is analyzing", "are voting")
- Be conversational but professional
- Mention the stage (opinions, review, voting, synthesis) naturally
- Include relevant context (confidence levels, consensus status)
- Keep updates varied - don't repeat the same phrases

Example outputs:
- "GPT-5 is diving deep into the ethical implications while o4-mini crunches the numbers..."
- "The council has gathered 4 perspectives. Now entering the review phase where models will critique each other's reasoning."
- "Voting is heating up! 3 votes for Option A, 2 for Option B. Confidence is averaging 78%."
- "Final synthesis in progress - weaving together the council's collective wisdom..."`;
```

### Narrator Service Implementation

```typescript
// packages/core/src/narrator.ts
import { AzureOpenAI } from 'openai';

export interface NarratorEvent {
  type: string;
  stage?: string;
  memberName?: string;
  memberCount?: number;
  completedCount?: number;
  confidence?: number;
  consensusReached?: boolean;
  voteBreakdown?: Record<string, number>;
}

export interface NarratorConfig {
  model: string;        // 'gpt-4o-mini' recommended
  maxTokens: number;    // 60-80 for brief updates
  batchSize: number;    // How many events to batch before narrating
  debounceMs: number;   // Wait time before generating narration
}

export class LLMNarrator {
  private client: AzureOpenAI;
  private config: NarratorConfig;
  private eventBuffer: NarratorEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastNarration: string = '';

  constructor(client: AzureOpenAI, config: Partial<NarratorConfig> = {}) {
    this.client = client;
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      maxTokens: config.maxTokens ?? 60,
      batchSize: config.batchSize ?? 3,
      debounceMs: config.debounceMs ?? 500,
    };
  }

  /**
   * Queue an event for narration
   */
  addEvent(event: NarratorEvent): void {
    this.eventBuffer.push(event);
    
    // If we have enough events, generate immediately
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flushBuffer();
    } else {
      // Otherwise, debounce
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.flushBuffer(), this.config.debounceMs);
  }

  private async flushBuffer(): Promise<string | null> {
    if (this.eventBuffer.length === 0) return null;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const narration = await this.generateNarration(events);
    this.lastNarration = narration;
    return narration;
  }

  /**
   * Generate human-friendly narration from events
   */
  async generateNarration(events: NarratorEvent[]): Promise<string> {
    const eventSummary = events.map(e => {
      switch (e.type) {
        case 'stage:start':
          return `Stage "${e.stage}" started with ${e.memberCount} members`;
        case 'member:request':
          return `${e.memberName} started processing`;
        case 'member:response':
          return `${e.memberName} completed (${e.completedCount}/${e.memberCount})`;
        case 'vote:cast':
          return `${e.memberName} voted with ${(e.confidence! * 100).toFixed(0)}% confidence`;
        case 'voting:complete':
          return `Voting complete: consensus=${e.consensusReached}, avg confidence=${(e.confidence! * 100).toFixed(0)}%`;
        case 'correction:triggered':
          return `Self-correction triggered for round refinement`;
        default:
          return `${e.type} event occurred`;
      }
    }).join('; ');

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: NARRATOR_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Previous update: "${this.lastNarration}"\n\nNew events: ${eventSummary}\n\nGenerate a brief progress update:` 
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.7, // Some creativity for variety
      });

      return response.choices[0]?.message?.content ?? 'Processing...';
    } catch (error) {
      console.error('Narrator error:', error);
      return this.generateFallbackNarration(events);
    }
  }

  /**
   * Fallback for when LLM call fails
   */
  private generateFallbackNarration(events: NarratorEvent[]): string {
    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case 'stage:start':
        return `Starting ${lastEvent.stage} phase...`;
      case 'member:response':
        return `${lastEvent.memberName} completed. ${lastEvent.completedCount}/${lastEvent.memberCount} done.`;
      case 'voting:complete':
        return `Voting complete. ${lastEvent.consensusReached ? 'Consensus reached!' : 'Proceeding to synthesis.'}`;
      default:
        return 'Processing...';
    }
  }
}

const NARRATOR_SYSTEM_PROMPT = `You are a friendly progress narrator for an AI Council system...`; // (full prompt above)
```

### Integration with Pipeline

```typescript
// packages/core/src/pipeline/council.ts
import { LLMNarrator } from '../narrator.js';

export class CouncilPipeline extends EventEmitter<CouncilEvents> {
  private narrator?: LLMNarrator;

  constructor(config?: { enableNarration?: boolean }) {
    super();
    
    if (config?.enableNarration) {
      const client = new AzureOpenAI({ /* ... */ });
      this.narrator = new LLMNarrator(client, {
        model: 'gpt-4o-mini', // Fast and cheap
        maxTokens: 60,
        batchSize: 2,
        debounceMs: 300,
      });

      // Wire up events to narrator
      this.setupNarration();
    }
  }

  private setupNarration(): void {
    const narratorEvents = ['stage:start', 'member:request', 'member:response', 'vote:cast', 'voting:complete'];
    
    narratorEvents.forEach(eventType => {
      this.on(eventType as keyof CouncilEvents, async (...args) => {
        const narratorEvent = this.convertToNarratorEvent(eventType, args);
        this.narrator!.addEvent(narratorEvent);
        
        // Check if narration is ready
        const narration = await this.narrator!.flushBuffer();
        if (narration) {
          this.emit('narration', narration);
        }
      });
    });
  }
}
```

---

## 4. React Frontend Components

### Progress Hook

```typescript
// packages/web/src/hooks/useCouncilProgress.ts
import { useState, useEffect, useCallback } from 'react';

interface ProgressState {
  stage: 'waiting' | 'opinions' | 'review' | 'voting' | 'synthesis' | 'complete';
  stageProgress: number;      // 0-100 within current stage
  overallProgress: number;    // 0-100 overall
  members: MemberProgress[];
  narrative: string;
  narrativeHistory: string[];
}

interface MemberProgress {
  id: string;
  name: string;
  model: string;
  status: 'waiting' | 'querying' | 'complete' | 'error';
  latencyMs?: number;
  contentPreview?: string;
}

export function useCouncilProgress(sessionId: string | null) {
  const [progress, setProgress] = useState<ProgressState>({
    stage: 'waiting',
    stageProgress: 0,
    overallProgress: 0,
    members: [],
    narrative: '',
    narrativeHistory: [],
  });

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`ws://localhost:3001/api/ws/session/${sessionId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      setProgress(prev => {
        switch (data.type) {
          case 'session:start':
            return {
              ...prev,
              stage: 'opinions',
              members: data.members.map((m: any) => ({
                id: m.id,
                name: m.name,
                model: m.modelConfig.name,
                status: 'waiting',
              })),
            };

          case 'stage:start':
            return {
              ...prev,
              stage: data.stage,
              stageProgress: 0,
            };

          case 'member:request':
            return {
              ...prev,
              members: prev.members.map(m =>
                m.id === data.memberId
                  ? { ...m, status: 'querying' }
                  : m
              ),
            };

          case 'member:response':
            const completedCount = prev.members.filter(m => m.status === 'complete').length + 1;
            const stageProgress = (completedCount / prev.members.length) * 100;
            
            return {
              ...prev,
              stageProgress,
              overallProgress: calculateOverallProgress(prev.stage, stageProgress),
              members: prev.members.map(m =>
                m.id === data.memberId
                  ? { 
                      ...m, 
                      status: 'complete',
                      latencyMs: data.latencyMs,
                      contentPreview: data.content?.slice(0, 100),
                    }
                  : m
              ),
            };

          case 'narration':
            return {
              ...prev,
              narrative: data.message,
              narrativeHistory: [...prev.narrativeHistory, data.message].slice(-5),
            };

          case 'session:end':
            return {
              ...prev,
              stage: 'complete',
              overallProgress: 100,
            };

          default:
            return prev;
        }
      });
    };

    return () => ws.close();
  }, [sessionId]);

  return progress;
}

function calculateOverallProgress(stage: string, stageProgress: number): number {
  const stageWeights: Record<string, { start: number; weight: number }> = {
    opinions: { start: 0, weight: 40 },
    review: { start: 40, weight: 20 },
    voting: { start: 60, weight: 20 },
    synthesis: { start: 80, weight: 20 },
  };

  const stageInfo = stageWeights[stage];
  if (!stageInfo) return 0;

  return stageInfo.start + (stageProgress / 100) * stageInfo.weight;
}
```

### Progress Components

```tsx
// packages/web/src/components/CouncilProgress.tsx
import React from 'react';
import { cn } from '../lib/utils';

interface CouncilProgressProps {
  stage: string;
  stageProgress: number;
  overallProgress: number;
  members: MemberProgress[];
  narrative: string;
}

export function CouncilProgress({
  stage,
  stageProgress,
  overallProgress,
  members,
  narrative,
}: CouncilProgressProps) {
  return (
    <div className="space-y-6 p-6 bg-gray-900/50 rounded-xl border border-gray-800">
      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Overall Progress</span>
          <span className="text-white font-medium">{Math.round(overallProgress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stage Indicator */}
      <StageIndicator currentStage={stage} progress={stageProgress} />

      {/* Member Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {members.map(member => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {/* Narrative Text */}
      {narrative && (
        <div className="p-4 bg-gray-800/50 rounded-lg border-l-4 border-purple-500">
          <p className="text-gray-300 italic animate-in fade-in duration-500">
            "{narrative}"
          </p>
        </div>
      )}
    </div>
  );
}

function StageIndicator({ currentStage, progress }: { currentStage: string; progress: number }) {
  const stages = ['opinions', 'review', 'voting', 'synthesis'];
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, idx) => {
        const isActive = idx === currentIndex;
        const isComplete = idx < currentIndex;

        return (
          <React.Fragment key={stage}>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all',
              isActive && 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50',
              isComplete && 'bg-green-500/20 text-green-300',
              !isActive && !isComplete && 'bg-gray-800 text-gray-500'
            )}>
              {isComplete && <span>✓</span>}
              {isActive && <span className="animate-pulse">●</span>}
              <span className="capitalize">{stage}</span>
              {isActive && <span className="text-xs opacity-75">({Math.round(progress)}%)</span>}
            </div>
            {idx < stages.length - 1 && (
              <div className={cn(
                'flex-1 h-px max-w-[20px]',
                isComplete ? 'bg-green-500/50' : 'bg-gray-700'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MemberCard({ member }: { member: MemberProgress }) {
  const statusColors = {
    waiting: 'bg-gray-700 text-gray-400',
    querying: 'bg-yellow-500/20 text-yellow-300 animate-pulse',
    complete: 'bg-green-500/20 text-green-300',
    error: 'bg-red-500/20 text-red-300',
  };

  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all duration-300',
      member.status === 'querying' && 'border-yellow-500/50 bg-yellow-500/5',
      member.status === 'complete' && 'border-green-500/30 bg-green-500/5',
      member.status === 'waiting' && 'border-gray-700 bg-gray-800/30',
      member.status === 'error' && 'border-red-500/50 bg-red-500/5'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white text-sm">{member.name}</span>
        <span className={cn('px-2 py-0.5 rounded text-xs', statusColors[member.status])}>
          {member.status === 'querying' && '⏳'}
          {member.status === 'complete' && '✓'}
          {member.status === 'waiting' && '○'}
          {member.status}
        </span>
      </div>
      <div className="text-xs text-gray-500">{member.model}</div>
      {member.latencyMs && (
        <div className="text-xs text-gray-400 mt-1">
          {(member.latencyMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}
```

### Streaming Narrative Display

```tsx
// packages/web/src/components/NarrativeStream.tsx
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface NarrativeStreamProps {
  messages: string[];
  className?: string;
}

export function NarrativeStream({ messages, className }: NarrativeStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to latest message
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        'space-y-2 max-h-32 overflow-y-auto scrollbar-thin',
        className
      )}
    >
      {messages.map((message, idx) => (
        <div 
          key={idx}
          className={cn(
            'text-sm transition-all duration-300',
            idx === messages.length - 1 
              ? 'text-purple-300 font-medium' 
              : 'text-gray-500'
          )}
        >
          <span className="text-gray-600 mr-2">›</span>
          {message}
        </div>
      ))}
    </div>
  );
}
```

---

## 5. Azure OpenAI Model Recommendations

### For Narration (Fast + Cheap)

| Model | Latency | Cost | Best For |
|-------|---------|------|----------|
| **gpt-4o-mini** ⭐ | ~200ms | $0.15/1M in, $0.60/1M out | Primary narrator - best balance |
| gpt-4.1-nano | ~150ms | $0.10/1M in, $0.40/1M out | Ultra-fast, short messages |
| gpt-35-turbo | ~150ms | $0.50/1M in, $2/1M out | Legacy, still fast |

### Recommendation: **gpt-4o-mini**

```typescript
const narratorConfig = {
  model: 'gpt-4o-mini',
  maxTokens: 60,          // Short narrations only
  temperature: 0.7,       // Some creativity
  // With debouncing, expect ~1 narration per 2-3 seconds
  // Cost per session: ~$0.001-0.005 (negligible)
};
```

### Cost Analysis

For a typical council session (5 members, 4 stages, ~15 narrations):
- Input: ~500 tokens × 15 = 7,500 tokens = $0.001125
- Output: ~50 tokens × 15 = 750 tokens = $0.00045
- **Total per session: ~$0.0016 (< 1 cent)**

---

## 6. Example Prompts for Different Stages

### Stage-Specific Narration Prompts

```typescript
const STAGE_PROMPTS = {
  opinions: `The council members are formulating their initial perspectives. 
             Describe their analysis style (e.g., "GPT-5 is taking a philosophical approach while o4-mini focuses on logical reasoning")`,
  
  review: `Council members are now reviewing and critiquing each other's opinions.
           Highlight any interesting disagreements or synergies.`,
  
  voting: `The council is voting on the best approach. 
           Mention confidence levels and any emerging consensus.`,
  
  synthesis: `The final synthesis is being crafted.
              Describe how the diverse perspectives are being woven together.`,
};

// Dynamic prompt based on current state
function buildNarrationPrompt(stage: string, events: NarratorEvent[]): string {
  return `${NARRATOR_SYSTEM_PROMPT}

Current stage: ${stage}
Stage context: ${STAGE_PROMPTS[stage]}

Recent events: ${JSON.stringify(events)}

Generate a brief, engaging update (1-2 sentences max):`;
}
```

### Example Narration Outputs

```
OPINIONS STAGE:
"GPT-5 is diving deep into the ethical implications while o4-mini takes a more analytical approach. 3 of 5 perspectives gathered so far."

REVIEW STAGE:  
"Interesting! Claude-3 is challenging GPT-5's assumptions about user privacy. The debate is heating up..."

VOTING STAGE:
"Votes are coming in - there's a strong lean toward Option B with an average confidence of 82%. Just waiting on o4-mini..."

SYNTHESIS STAGE:
"Weaving together the council's collective wisdom. The final answer incorporates GPT-5's ethical framework with o4-mini's practical constraints."

SELF-CORRECTION:
"Hold on - confidence dropped below threshold. The council is reconvening for another round of deliberation..."
```

---

## 7. npm Packages

### Recommended Packages

```json
{
  "dependencies": {
    // Azure OpenAI (already using)
    "openai": "^4.x",
    "@azure/identity": "^4.x",
    
    // Streaming utilities
    "eventsource-parser": "^3.0.0",  // Parse SSE streams
    
    // React hooks for streaming
    "@ai-sdk/react": "^1.0.0",  // Vercel AI SDK React hooks (optional)
    
    // WebSocket (already using)
    "@fastify/websocket": "^10.x",
    
    // Event handling
    "eventemitter3": "^5.0.0",  // Typed event emitter
    
    // Debouncing
    "lodash.debounce": "^4.0.8"
  }
}
```

### Optional: Vercel AI SDK for Streaming

If you want to adopt the Vercel AI SDK patterns:

```bash
pnpm add ai @ai-sdk/react @ai-sdk/azure
```

```typescript
// Using Vercel AI SDK streaming
import { streamText } from 'ai';
import { azure } from '@ai-sdk/azure';

const result = await streamText({
  model: azure('gpt-4o-mini'),
  messages: [...],
});

// Returns a ReadableStream compatible with Response
return result.toTextStreamResponse();
```

---

## 8. Implementation Roadmap

### Phase 1: Basic Progress Events (1-2 days)
- [x] Existing WebSocket events (already done!)
- [ ] Add progress percentage calculation
- [ ] Create `useCouncilProgress` hook
- [ ] Build `CouncilProgress` component

### Phase 2: LLM Narrator Service (2-3 days)
- [ ] Create `LLMNarrator` class
- [ ] Implement event batching/debouncing
- [ ] Add 'narration' event to pipeline
- [ ] Wire up WebSocket to emit narrations

### Phase 3: UI Polish (1-2 days)
- [ ] Stage indicator component
- [ ] Member status cards with animations
- [ ] Narrative stream display
- [ ] Loading skeletons

### Phase 4: Optimization (1 day)
- [ ] Tune debounce timing
- [ ] Add fallback narrations
- [ ] Error handling for narrator
- [ ] Performance profiling

---

## 9. Comparison with Industry Tools

### Claude Code
- Uses terminal-based progress indicators
- Shows real-time file operations
- Displays thinking/reasoning steps
- No LLM narrator (template-based messages)

### Cursor
- Shows "Agent is thinking..." type messages
- Displays file diffs as they're generated
- Uses streaming for code completions
- Premium plans may have more detailed updates

### Vercel AI SDK
- Comprehensive streaming protocol
- Supports tool calls, reasoning, and data parts
- React hooks for state management
- Well-documented data stream format

### GitHub Copilot Workspace
- Shows step-by-step plan execution
- Real-time file creation/modification
- Uses structured progress indicators
- Template-based status messages

---

## 10. References

- [Vercel AI SDK Stream Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol)
- [Azure OpenAI Streaming](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/streaming)
- [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Your Existing NEXT_STEPS_RESEARCH.md](./NEXT_STEPS_RESEARCH.md)

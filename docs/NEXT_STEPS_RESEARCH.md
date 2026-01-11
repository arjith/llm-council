# LLM Council - Next Steps Research & Architecture Improvements

> **Document Version**: 1.3  
> **Last Updated**: June 2025  
> **Purpose**: Comprehensive research for future enhancements to the LLM Council framework  
> **Test Status**: ✅ 109/109 tests passing (including E2E council flow)

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [LLM Narrator Progress System](#llm-narrator-progress-system) ⭐ **PRIORITY**
3. [Markdown Response Rendering](#markdown-response-rendering) ✅ **IMPLEMENTED**
4. [Persistent Storage with Cosmos DB](#persistent-storage-with-cosmos-db)
5. [Azure Queue Storage for Async Processing](#azure-queue-storage-for-async-processing)
6. [RAG Integration with Azure AI Search](#rag-integration-with-azure-ai-search)
7. [Tool/Function Calling for Council Members](#toolfunction-calling-for-council-members)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Reference Links](#reference-links)

---

## Current Architecture Overview

### Data Flow (Current - Synchronous)

```
Frontend (React) → POST /api/council/run → Fastify API → CouncilPipeline
                                                              ↓
                                               Stage 1: Opinions (Parallel LLMs)
                                                              ↓
                                               Stage 2: Review
                                                              ↓
                                               Stage 3: Voting
                                                              ↓
                                               Stage 4: Synthesis
                                                              ↓
                                               InMemorySessionRepository
                                                              ↓
                                               ← Response (30-120s blocking)
```

### Key Bottlenecks

| Issue | Impact | Current State |
|-------|--------|---------------|
| **Synchronous blocking** | API hangs 30-120s during council | `packages/api/src/routes/council.ts` |
| **No job queue** | Can't scale horizontally | No queue implementation |
| **In-memory storage** | Data lost on restart | `packages/core/src/repository/memory.ts` |
| **No rate limiting** | Could overwhelm Azure quotas | No implementation |

### Existing Strengths

- ✅ Event-driven internal pipeline with `CouncilEvents`
- ✅ WebSocket support exists (underutilized)
- ✅ Parallel LLM calls within stages
- ✅ Iteration controller for multi-round refinement

---

## LLM Narrator Progress System

### The Problem

The current "Convening Council..." spinner provides **no feedback** for 30-120+ seconds:

```
User clicks "Ask Council"
       ↓
[Spinning loader for 120s with no updates]
       ↓
Results appear suddenly
```

This creates anxiety and uncertainty. Users don't know:
- Is it working?
- Which model is responding?
- How much longer will it take?

### Solution: LLM-Powered Progress Narrator

Inspired by **Claude Code's** agentic progress updates, we use a lightweight LLM (gpt-4o-mini) to generate human-friendly progress summaries in real-time.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CouncilPipeline                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │ Stage 1  │──▶│ Stage 2  │──▶│ Stage 3  │──▶│ Stage 4  │         │
│  │ Opinions │   │ Review   │   │ Voting   │   │ Synthesis│         │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘         │
│       │              │              │              │                │
│       ▼              ▼              ▼              ▼                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Event Aggregator                          │   │
│  │   member:start | member:complete | stage:complete | vote     │   │
│  └────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    LLM Narrator       │
                    │    (gpt-4o-mini)      │
                    │  - Debounces events   │
                    │  - Batches updates    │
                    │  - Generates text     │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │     WebSocket /       │
                    │     SSE Stream        │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   React Frontend      │
                    │  useCouncilProgress   │
                    │  <CouncilProgress />  │
                    └───────────────────────┘
```

### Recommended Model: gpt-4o-mini

| Model | Latency | Cost/1K tokens | Use Case |
|-------|---------|----------------|----------|
| **gpt-4o-mini** | ~200ms | $0.00015 | ✅ Best for narration |
| gpt-4o | ~500ms | $0.0025 | Too slow/expensive |
| o4-mini | ~1s | $0.001 | Overkill for simple text |

**Cost estimate**: ~$0.0016 per council session (10-15 narration calls)

### LLM Narrator Implementation

```typescript
import { AzureOpenAI } from 'openai';
import { debounce } from 'lodash';

interface ProgressEvent {
  type: 'member_start' | 'member_complete' | 'stage_complete' | 'voting' | 'synthesis';
  member?: string;
  model?: string;
  stage?: string;
  duration?: number;
  confidence?: number;
  preview?: string;
  timestamp: number;
}

export class LLMNarrator {
  private client: AzureOpenAI;
  private eventBuffer: ProgressEvent[] = [];
  private lastNarration: string = '';
  
  constructor(client: AzureOpenAI) {
    this.client = client;
    this.generateNarration = debounce(this.generateNarration.bind(this), 500);
  }

  addEvent(event: ProgressEvent): void {
    this.eventBuffer.push(event);
    this.generateNarration();
  }

  private async generateNarration(): Promise<string> {
    if (this.eventBuffer.length === 0) return this.lastNarration;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly progress narrator for an AI council deliberation.
Generate a brief, engaging 1-2 sentence update about what's happening.
Be specific about member names and actions. Use present tense.
Add personality - be slightly witty but professional.
Never use technical jargon like "tokens" or "latency".`
        },
        {
          role: 'user',
          content: `Recent events:\n${JSON.stringify(events, null, 2)}\n\nGenerate a progress update:`
        }
      ],
      max_tokens: 60,
      temperature: 0.7
    });

    this.lastNarration = response.choices[0].message.content || '';
    return this.lastNarration;
  }
}
```

### Example Narrations

| Event | Generated Narration |
|-------|---------------------|
| `member_start: GPT-5` | *"GPT-5 is diving into the question, examining all angles..."* |
| `member_complete: o4-mini (1.2s)` | *"o4-mini weighs in with lightning speed! Now waiting on the others..."* |
| `stage_complete: opinions (5/5)` | *"All five council members have shared their perspectives. Let the debate begin!"* |
| `voting: 3 for A, 2 for B` | *"The vote is heating up - slight edge for Option A, but it's close..."* |
| `synthesis: starting` | *"Time to weave the threads together. The synthesizer is crafting the final answer..."* |

### React Hook: useCouncilProgress

```typescript
import { useState, useEffect, useCallback } from 'react';

interface ProgressState {
  stage: 'opinions' | 'review' | 'voting' | 'synthesis' | 'complete';
  overallProgress: number;
  members: MemberStatus[];
  narrative: string;
  isComplete: boolean;
}

interface MemberStatus {
  name: string;
  model: string;
  status: 'waiting' | 'querying' | 'complete' | 'error';
  duration?: number;
}

export function useCouncilProgress(sessionId: string | null) {
  const [progress, setProgress] = useState<ProgressState>({
    stage: 'opinions',
    overallProgress: 0,
    members: [],
    narrative: 'Preparing the council...',
    isComplete: false
  });

  useEffect(() => {
    if (!sessionId) return;

    // Option 1: WebSocket (bidirectional, already in codebase)
    const ws = new WebSocket(`ws://localhost:3001/api/council/progress/${sessionId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({
        ...prev,
        ...data,
        overallProgress: calculateProgress(data)
      }));
    };

    // Option 2: SSE (simpler, unidirectional)
    // const eventSource = new EventSource(`/api/council/progress/${sessionId}`);
    // eventSource.onmessage = (event) => { ... };

    return () => ws.close();
  }, [sessionId]);

  return progress;
}

function calculateProgress(state: Partial<ProgressState>): number {
  const weights = { opinions: 40, review: 20, voting: 20, synthesis: 20 };
  // ... calculation logic
}
```

### React Component: CouncilProgress

```tsx
interface CouncilProgressProps {
  sessionId: string;
  onComplete: (session: Session) => void;
}

export function CouncilProgress({ sessionId, onComplete }: CouncilProgressProps) {
  const progress = useCouncilProgress(sessionId);

  useEffect(() => {
    if (progress.isComplete) {
      // Fetch final session and trigger callback
      fetch(`/api/sessions/${sessionId}`).then(r => r.json()).then(onComplete);
    }
  }, [progress.isComplete]);

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      {/* Progress Bar */}
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="absolute h-full bg-gradient-to-r from-council-primary to-council-secondary transition-all duration-500"
          style={{ width: `${progress.overallProgress}%` }}
        />
      </div>

      {/* Stage Indicator */}
      <div className="flex items-center gap-2">
        <span className="text-lg">
          {progress.stage === 'opinions' && '🔵'}
          {progress.stage === 'review' && '🟣'}
          {progress.stage === 'voting' && '🗳️'}
          {progress.stage === 'synthesis' && '✨'}
        </span>
        <span className="text-white font-medium capitalize">
          Stage: {progress.stage}
        </span>
        <span className="text-gray-400 text-sm">
          ({progress.overallProgress}%)
        </span>
      </div>

      {/* Member Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {progress.members.map(member => (
          <div 
            key={member.name}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
              member.status === 'complete' && 'bg-green-500/10 text-green-400',
              member.status === 'querying' && 'bg-blue-500/10 text-blue-400 animate-pulse',
              member.status === 'waiting' && 'bg-gray-700/50 text-gray-500',
              member.status === 'error' && 'bg-red-500/10 text-red-400'
            )}
          >
            <span>
              {member.status === 'complete' && '✅'}
              {member.status === 'querying' && '🔄'}
              {member.status === 'waiting' && '⏳'}
              {member.status === 'error' && '❌'}
            </span>
            <span className="truncate">{member.name}</span>
            {member.duration && (
              <span className="text-xs opacity-70">
                {(member.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>

      {/* LLM-Generated Narrative */}
      <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
        <span className="text-2xl">💬</span>
        <p className="text-gray-300 italic animate-in fade-in duration-300">
          "{progress.narrative}"
        </p>
      </div>
    </div>
  );
}
```

### Implementation Phases

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1** | 1-2 days | Progress calculation + UI components (leverage existing WebSocket) |
| **Phase 2** | 2-3 days | LLM Narrator service with debouncing + API integration |
| **Phase 3** | 1-2 days | UI polish: animations, transitions, error states |
| **Phase 4** | 1 day | Testing, optimization, edge cases |

### npm Packages

```bash
# Already using
pnpm add openai

# Optional helpers
pnpm add lodash.debounce    # Event batching
pnpm add eventsource-parser # SSE parsing (if using SSE)
```

---

## Markdown Response Rendering

### Status: ✅ IMPLEMENTED

We've added rich markdown rendering for LLM responses with syntax highlighting.

### Packages Added

```bash
pnpm add react-markdown react-syntax-highlighter remark-gfm
pnpm add -D @types/react-syntax-highlighter
```

### Component: MarkdownRenderer

Located at `packages/web/src/components/MarkdownRenderer.tsx`

**Features:**
- GitHub Flavored Markdown (tables, strikethrough, task lists)
- Syntax highlighting for 30+ languages (using Prism)
- Copy button for code blocks
- Responsive styling matching app theme
- Safe rendering (no dangerouslySetInnerHTML)

### Usage

```tsx
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

// In SessionPage - Final Answer
<MarkdownRenderer content={session.finalAnswer} />

// In DebateCard - Member Responses
<MarkdownRenderer content={response.content} />
```

---

## Azure Queue Storage for Async Processing

### Why Use Queues?

The current architecture blocks the HTTP request for 30-120 seconds. Azure Queue Storage enables:

- ✅ **Immediate response** with job ID
- ✅ **Horizontal scaling** of workers
- ✅ **Retry logic** for failed operations
- ✅ **Decoupled frontend/backend**

### Proposed Architecture

```
┌────────────┐      ┌──────────────┐      ┌────────────────────┐
│   Frontend │─────▶│  Fastify API │─────▶│  Azure Queue       │
│   (React)  │      │  POST /run   │      │  (council-jobs)    │
└────────────┘      └──────────────┘      └────────┬───────────┘
       │                   │                        │
       │                   │                        ▼
       │            Return job_id            ┌────────────────┐
       │                   │                 │  Worker        │
       │                   ▼                 │  (Azure Func)  │
       │            ┌──────────────┐         └────────┬───────┘
       │            │  Status API  │                  │
       ◀────────────│  GET /status │◀─────────────────┘
   Poll for results │              │     Update Cosmos DB
                    └──────────────┘
```

### SDK & Package

```bash
npm install @azure/storage-queue @azure/identity
```

### Code Example: Send Message to Queue

```typescript
import { QueueServiceClient } from "@azure/storage-queue";
import { DefaultAzureCredential } from "@azure/identity";

const account = process.env.AZURE_STORAGE_ACCOUNT;
const queueServiceClient = new QueueServiceClient(
  `https://${account}.queue.core.windows.net`,
  new DefaultAzureCredential()
);

const queueClient = queueServiceClient.getQueueClient("council-jobs");

// Create job and enqueue
const job = {
  id: nanoid(),
  question: body.question,
  members: body.members,
  config: body.config,
  createdAt: new Date().toISOString()
};

await queueClient.sendMessage(
  Buffer.from(JSON.stringify(job)).toString('base64')
);

return { jobId: job.id, status: 'queued' };
```

### Code Example: Receive and Process

```typescript
const response = await queueClient.receiveMessages({ numberOfMessages: 1 });
if (response.receivedMessageItems.length > 0) {
  const message = response.receivedMessageItems[0];
  const job = JSON.parse(
    Buffer.from(message.messageText, 'base64').toString()
  );
  
  // Process the council session
  const session = await pipeline.run(job.question, job.members, job.config);
  
  // Save to Cosmos DB
  await cosmosRepository.create(session);
  
  // Delete from queue
  await queueClient.deleteMessage(message.messageId, message.popReceipt);
}
```

### Azure Functions Integration

For automatic scaling, use Azure Functions with Queue trigger:

```typescript
import { app, output, InvocationContext } from '@azure/functions';

const sendToQueue = output.storageQueue({
  queueName: 'council-jobs',
  connection: 'AzureWebJobsStorage',
});

app.http('EnqueueCouncilJob', {
  methods: ['POST'],
  authLevel: 'anonymous',
  extraOutputs: [sendToQueue],
  handler: async (request, context) => {
    const job = await request.json();
    context.extraOutputs.set(sendToQueue, [JSON.stringify(job)]);
    return { body: JSON.stringify({ jobId: job.id }) };
  },
});
```

### Documentation Links

- [Azure Queue Storage Quickstart (Node.js)](https://learn.microsoft.com/en-us/azure/storage/queues/storage-quickstart-queues-nodejs)
- [Async Request-Reply Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply)
- [Azure Functions Queue Bindings](https://learn.microsoft.com/en-us/azure/azure-functions/functions-add-output-binding-storage-queue-cli)

---

## Persistent Storage with Cosmos DB

### Why Cosmos DB?

Per project instructions, Cosmos DB is recommended for:
- ✅ Chat history and conversation logging
- ✅ Session data with hierarchical partitioning
- ✅ Low-latency reads for session retrieval
- ✅ Multi-region replication for global apps

### SDK & Package

```bash
npm install @azure/cosmos @azure/identity
```

### Code Example: Cosmos Repository

```typescript
import { CosmosClient, Database, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

export class CosmosSessionRepository implements SessionRepository {
  private container: Container;

  constructor(endpoint: string, databaseId: string, containerId: string) {
    const client = new CosmosClient({
      endpoint,
      aadCredentials: new DefaultAzureCredential()
    });
    const database = client.database(databaseId);
    this.container = database.container(containerId);
  }

  async create(session: Session): Promise<void> {
    await this.container.items.create({
      id: session.id,
      partitionKey: session.id, // Or use userId for multi-tenant
      ...session
    });
  }

  async get(id: string): Promise<Session | null> {
    try {
      const { resource } = await this.container.item(id, id).read();
      return resource as Session;
    } catch {
      return null;
    }
  }

  async list(limit = 20): Promise<Session[]> {
    const { resources } = await this.container.items
      .query({
        query: "SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit",
        parameters: [{ name: "@limit", value: limit }]
      })
      .fetchAll();
    return resources;
  }
}
```

### Data Model for Sessions

```typescript
interface CosmosSession {
  id: string;                    // Unique session ID
  partitionKey: string;          // Session ID or tenant/user ID
  question: string;
  config: SessionConfig;
  members: CouncilMember[];
  stages: StageResult[];
  finalAnswer: string | null;
  finalConfidence: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalTokens: number;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
  ttl?: number;                  // Optional auto-expiration
}
```

### Hierarchical Partition Keys

For multi-tenant scenarios:

```typescript
const container = database.container("sessions", {
  partitionKey: {
    paths: ["/tenantId", "/userId", "/sessionId"],
    version: 2 // Hierarchical partition key
  }
});
```

### Documentation Links

- [Cosmos DB JavaScript SDK Quickstart](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-javascript-get-started)
- [Cosmos DB Data Modeling](https://learn.microsoft.com/en-us/azure/cosmos-db/modeling-data)
- [Hierarchical Partition Keys](https://learn.microsoft.com/en-us/azure/cosmos-db/hierarchical-partition-keys)

---

## RAG Integration with Azure AI Search

### What is RAG?

**Retrieval-Augmented Generation (RAG)** enhances LLM responses by:
1. **Retrieving** relevant documents from a knowledge base
2. **Augmenting** the prompt with retrieved context
3. **Generating** grounded, factual responses

### How RAG Benefits LLM Council

- Council members can access **company knowledge bases**
- Responses are **grounded in source documents**
- **Citations** can be provided with answers
- Reduces **hallucinations** on domain-specific topics

### Architecture Options

#### Option 1: Direct SDK Integration

```typescript
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

const searchClient = new SearchClient(
  process.env.AZURE_SEARCH_ENDPOINT,
  "council-knowledge",
  new AzureKeyCredential(process.env.AZURE_SEARCH_KEY)
);

// In pipeline, before generating opinions
async function retrieveContext(question: string): Promise<string[]> {
  const searchResults = await searchClient.search(question, {
    top: 5,
    queryType: "semantic",
    semanticConfiguration: "default"
  });
  
  const contexts: string[] = [];
  for await (const result of searchResults.results) {
    contexts.push(result.document.content);
  }
  return contexts;
}
```

#### Option 2: Azure OpenAI "On Your Data"

```typescript
const searchDataSource = {
  type: 'azure_search',
  parameters: {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT,
    index_name: 'council-knowledge',
    authentication: {
      type: 'system_assigned_managed_identity'
    },
    query_type: 'vector_semantic_hybrid',
    semantic_configuration: 'default-semantic-config',
    embedding_dependency: {
      type: 'deployment_name',
      deployment_name: 'text-embedding-ada-002'
    }
  }
};

// Use data_sources in chat completion
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  data_sources: [searchDataSource]
});
```

### Vector Search Setup

1. Create embeddings for documents
2. Index with vector field
3. Query with hybrid search (keyword + vector + semantic ranking)

### Documentation Links

- [RAG Overview in Azure AI Search](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)
- [Azure AI Search JavaScript SDK](https://learn.microsoft.com/en-us/azure/search/samples-javascript)
- [Build RAG App with Express.js Tutorial](https://learn.microsoft.com/en-us/azure/app-service/tutorial-ai-openai-search-nodejs)
- [Azure OpenAI On Your Data](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/use-your-data)

---

## Tool/Function Calling for Council Members

### What is Function Calling?

Azure OpenAI models can:
1. **Detect** when a function should be called
2. **Return** function name and arguments as JSON
3. **Accept** function results to continue reasoning

### Use Cases for LLM Council

- **Calculator**: Mathematical computations
- **Code Execution**: Run Python/JavaScript snippets
- **Database Query**: Fetch real-time data
- **API Calls**: External service integration
- **File Operations**: Read/write documents

### Implementation Pattern

```typescript
// Define tools for council members
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search internal knowledge base for relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', enum: ['policy', 'technical', 'general'] }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate' }
        },
        required: ['expression']
      }
    }
  }
];

// Make API call with tools
const response = await openai.chat.completions.create({
  model: 'gpt-5',
  messages: [...],
  tools,
  tool_choice: 'auto'
});

// Handle tool calls
if (response.choices[0].message.tool_calls) {
  const toolCalls = response.choices[0].message.tool_calls;
  
  for (const toolCall of toolCalls) {
    const args = JSON.parse(toolCall.function.arguments);
    let result: string;
    
    switch (toolCall.function.name) {
      case 'search_knowledge_base':
        result = await searchKnowledgeBase(args.query, args.category);
        break;
      case 'calculate':
        result = evaluateMath(args.expression);
        break;
    }
    
    // Add result to messages and continue
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: result
    });
  }
}
```

### Integrating with CouncilPipeline

Modify `queryMember` to support tools:

```typescript
private async queryMember(
  sessionId: string,
  member: CouncilMember,
  messages: Message[],
  tools?: ToolDefinition[]
): Promise<MemberResponse> {
  const response = await this.adapter.chat({
    model: member.model,
    messages,
    tools,
    temperature: member.temperature
  });
  
  // Handle tool calls if present
  if (response.toolCalls) {
    const toolResults = await this.executeTools(response.toolCalls);
    // Recursive call with tool results
    return this.queryMemberWithTools(sessionId, member, messages, response, toolResults);
  }
  
  return response;
}
```

### Documentation Links

- [Function Calling Guide](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/function-calling)
- [Azure OpenAI Assistants with Function Calling](https://learn.microsoft.com/en-us/azure/developer/javascript/ai/get-started-app-chat-assistants-function-calling)
- [Agents Function Calling (JavaScript)](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools-classic/function-calling)

---

## Implementation Roadmap

### Phase 0: LLM Narrator Progress System (Week 1) ⭐ **PRIORITY**

| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| Create `LLMNarrator` service class | High | Medium | 🔲 |
| Add WebSocket progress endpoint | High | Medium | 🔲 |
| Create `useCouncilProgress` hook | High | Low | 🔲 |
| Create `CouncilProgress` component | High | Medium | 🔲 |
| Add progress calculation logic | Medium | Low | 🔲 |
| Test and polish UI animations | Low | Low | 🔲 |

### Phase 1: Markdown Rendering ✅ **COMPLETE**

| Task | Priority | Complexity | Status |
|------|----------|------------|--------|
| Install react-markdown + syntax highlighter | High | Low | ✅ |
| Create `MarkdownRenderer` component | High | Medium | ✅ |
| Integrate in SessionPage (Final Answer) | High | Low | ✅ |
| Integrate in DebateCard (Member Responses) | High | Low | ✅ |

### Phase 2: Persistent Storage (Week 2-3)

| Task | Priority | Complexity |
|------|----------|------------|
| Set up Cosmos DB account | High | Low |
| Create `CosmosSessionRepository` | High | Medium |
| Add migration from in-memory | Medium | Low |
| Update env vars and configuration | High | Low |

### Phase 3: Async Queue Processing (Week 4-5)

| Task | Priority | Complexity |
|------|----------|------------|
| Set up Azure Storage Account | High | Low |
| Create queue submission endpoint | High | Medium |
| Implement worker (Azure Function) | High | High |
| Add status polling endpoint | High | Medium |
| Update frontend for async flow | Medium | Medium |

### Phase 4: Tool Calling & RAG (Week 6+)

| Task | Priority | Complexity |
|------|----------|------------|
| Define tool schemas | High | Medium |
| Implement tool executor | High | High |
| Set up Azure AI Search | Medium | Medium |
| Implement RAG retrieval | Medium | High |

---

## Reference Links

### Azure SDKs

| Package | npm | Docs |
|---------|-----|------|
| `@azure/cosmos` | [npm](https://www.npmjs.com/package/@azure/cosmos) | [Docs](https://learn.microsoft.com/en-us/javascript/api/@azure/cosmos) |
| `@azure/storage-queue` | [npm](https://www.npmjs.com/package/@azure/storage-queue) | [Docs](https://learn.microsoft.com/en-us/javascript/api/@azure/storage-queue) |
| `@azure/search-documents` | [npm](https://www.npmjs.com/package/@azure/search-documents) | [Docs](https://learn.microsoft.com/en-us/javascript/api/@azure/search-documents) |
| `@azure/ai-agents` | [npm](https://www.npmjs.com/package/@azure/ai-agents) | [Docs](https://learn.microsoft.com/en-us/javascript/api/@azure/ai-agents) |
| `@azure/identity` | [npm](https://www.npmjs.com/package/@azure/identity) | [Docs](https://learn.microsoft.com/en-us/javascript/api/@azure/identity) |
| `openai` | [npm](https://www.npmjs.com/package/openai) | [Docs](https://platform.openai.com/docs/api-reference) |

### Architecture Patterns

- [Async Request-Reply Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/async-request-reply)
- [RAG Pattern Overview](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)
- [Background Jobs Best Practices](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/background-jobs)

### GitHub Samples

- [azure-search-openai-demo](https://github.com/Azure-Samples/azure-search-openai-demo) - Enterprise RAG
- [azure-openai-assistant-javascript](https://github.com/Azure-Samples/azure-openai-assistant-javascript) - Assistants with Function Calling
- [azure-search-vector-samples](https://github.com/Azure/azure-search-vector-samples) - Vector Search Examples

### Tutorials

- [Build RAG App with Express.js](https://learn.microsoft.com/en-us/azure/app-service/tutorial-ai-openai-search-nodejs)
- [Connect Azure Functions to Storage Queue](https://learn.microsoft.com/en-us/azure/azure-functions/functions-add-output-binding-storage-queue-cli)
- [Azure OpenAI Assistants with JavaScript](https://learn.microsoft.com/en-us/azure/developer/javascript/ai/get-started-app-chat-assistants-function-calling)

---

## Quick Decision Matrix

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| **Markdown Rendering** | Low | Medium | ✅ Done | **IMPLEMENTED** - react-markdown + syntax highlighting |
| **LLM Narrator Progress** | Medium | High | 🔴 Critical | **Next up - vastly improves UX** |
| Cosmos DB Storage | Low | High | 🔴 Critical | Prevents data loss |
| Queue Processing | Medium | High | 🟡 High | Enables scaling and better UX |
| Tool Calling | High | Medium | 🟢 Medium | Adds powerful capabilities |
| RAG with AI Search | High | High | 🟡 High | Domain-specific accuracy |

---

*Last updated: June 2025. Document evolves as features are implemented.*

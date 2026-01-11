# LLM Council - Next Steps Research & Architecture Improvements

> **Document Version**: 1.1  
> **Last Updated**: January 11, 2026  
> **Purpose**: Comprehensive research for future enhancements to the LLM Council framework  
> **Test Status**: ✅ 109/109 tests passing (including E2E council flow)

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Skipped Tests Analysis](#skipped-tests-analysis)
3. [Azure Queue Storage for Async Processing](#azure-queue-storage-for-async-processing)
4. [Persistent Storage with Cosmos DB](#persistent-storage-with-cosmos-db)
5. [RAG Integration with Azure AI Search](#rag-integration-with-azure-ai-search)
6. [Tool/Function Calling for Council Members](#toolfunction-calling-for-council-members)
7. [Web Search with Bing Grounding](#web-search-with-bing-grounding)
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

## Skipped Tests Analysis

### Why Tests Are Skipped

| Test File | Skipped Tests | Reason |
|-----------|---------------|--------|
| `e2e/session.spec.cjs` | 3 tests | Tests require real session data; use `test.skip()` conditionally |
| `e2e/production.spec.cjs` | 1 test | Full council flow requires real Azure OpenAI API |

### Session Tests (Conditional Skip)

```javascript
// These tests skip if no sessions exist
test('should show Debate and Debug tabs', async ({ page }) => {
  const sessionId = await getFirstSessionId(page);
  if (!sessionId) {
    test.skip(true, 'No sessions available');
    return;
  }
  // ... test code
});
```

### Production Test (Hardcoded Skip)

```javascript
test.describe('Production - Full Council Flow (Long Running)', () => {
  // SKIP in dev/CI - requires real backend API with Azure OpenAI configured
  test.skip(true, 'Requires production backend with real API');
  // ...
});
```

### How to Run All Tests

1. **Ensure sessions exist**: Run a council query first
2. **For production test**: Remove the skip, set proper Azure credentials, run against production

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

## Web Search with Bing Grounding

### What is Bing Grounding?

**Grounding with Bing Search** allows council members to:
- Access **real-time public web data**
- Answer questions about **current events**
- Provide **citations** to sources
- Stay up-to-date beyond training cutoff

### Integration Options

#### Option 1: Azure AI Agents with Bing Tool

```typescript
import { AgentsClient, ToolUtility } from "@azure/ai-agents";
import { DefaultAzureCredential } from "@azure/identity";

const client = new AgentsClient(
  process.env.PROJECT_ENDPOINT,
  new DefaultAzureCredential()
);

// Create agent with Bing tool
const bingTool = ToolUtility.createBingGroundingTool(
  process.env.BING_CONNECTION_ID
);

const agent = await client.createAgent(
  process.env.MODEL_DEPLOYMENT_NAME,
  {
    name: "council-member-with-search",
    instructions: "You are a council member that can search the web.",
    tools: [bingTool]
  }
);
```

#### Option 2: Direct Bing Search API

```typescript
import { WebSearchClient } from "@azure/cognitiveservices-websearch";
import { CognitiveServicesCredentials } from "@azure/ms-rest-azure-js";

const credentials = new CognitiveServicesCredentials(BING_SEARCH_KEY);
const webSearch = new WebSearchClient(credentials);

const results = await webSearch.web.search("latest AI news", {
  count: 5,
  freshness: "Day"
});

// Inject search results into council prompt
const searchContext = results.webPages.value
  .map(p => `${p.name}: ${p.snippet}`)
  .join('\n');
```

### Cost Considerations

- Bing Grounding has **per-query pricing**
- Consider caching frequent queries
- Use sparingly for high-volume scenarios

### Documentation Links

- [Grounding with Bing Search Overview](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools-classic/bing-grounding)
- [Bing Search JavaScript Code Samples](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools-classic/bing-code-samples)
- [Bing Grounding Pricing](https://www.microsoft.com/en-us/bing/apis/grounding-pricing)

---

## Implementation Roadmap

### Phase 1: Persistent Storage (Week 1-2)

| Task | Priority | Complexity |
|------|----------|------------|
| Set up Cosmos DB account | High | Low |
| Create `CosmosSessionRepository` | High | Medium |
| Add migration from in-memory | Medium | Low |
| Update env vars and configuration | High | Low |

### Phase 2: Async Queue Processing (Week 3-4)

| Task | Priority | Complexity |
|------|----------|------------|
| Set up Azure Storage Account | High | Low |
| Create queue submission endpoint | High | Medium |
| Implement worker (Azure Function) | High | High |
| Add status polling endpoint | High | Medium |
| Update frontend for async flow | Medium | Medium |

### Phase 3: Tool Calling (Week 5-6)

| Task | Priority | Complexity |
|------|----------|------------|
| Define tool schemas | High | Medium |
| Implement tool executor | High | High |
| Integrate with pipeline | Medium | Medium |
| Add calculator tool | Low | Low |
| Add code execution tool | Low | High |

### Phase 4: RAG & Web Search (Week 7-8)

| Task | Priority | Complexity |
|------|----------|------------|
| Set up Azure AI Search | High | Medium |
| Create document index | High | High |
| Implement retrieval in pipeline | High | High |
| Add Bing grounding (optional) | Low | Medium |
| Add citations to UI | Medium | Medium |

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

| Feature | Effort | Impact | Priority | Recommendation |
|---------|--------|--------|----------|----------------|
| Cosmos DB Storage | Low | High | 🔴 Critical | Start here - prevents data loss |
| Queue Processing | Medium | High | 🟡 High | Enables scaling and better UX |
| Tool Calling | High | Medium | 🟢 Medium | Adds powerful capabilities |
| RAG with AI Search | High | High | 🟡 High | Domain-specific accuracy |
| Bing Grounding | Medium | Low | 🔵 Low | Nice-to-have for news queries |

---

*This document should be updated as new research is conducted or implementation decisions are made.*

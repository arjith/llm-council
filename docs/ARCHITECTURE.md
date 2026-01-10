# LLM Council Architecture

> **Purpose:** Technical architecture for the LLM Council framework  
> **Last Updated:** January 10, 2026

---

## Table of Contents
- [1. System Overview](#1-system-overview)
- [2. Core Components](#2-core-components)
- [3. Debug & Visualization System](#3-debug--visualization-system)
- [4. File Structure & Export Format](#4-file-structure--export-format)
- [5. Data Models](#5-data-models)
- [6. API Design](#6-api-design)
- [7. Technology Stack](#7-technology-stack)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LLM Council Framework                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐          │
│  │   Web Client   │     │   Debug View   │     │  Admin Panel   │          │
│  │  (React/Vue)   │     │   (Timeline)   │     │ (Role Config)  │          │
│  └───────┬────────┘     └───────┬────────┘     └───────┬────────┘          │
│          │                      │                      │                    │
│          └──────────────────────┼──────────────────────┘                    │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        API Gateway Layer                              │  │
│  │  • Authentication (JWT/Entra ID)                                     │  │
│  │  • Rate Limiting                                                      │  │
│  │  • Request Routing                                                    │  │
│  │  • WebSocket/SSE Management                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Council Orchestrator                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Router    │  │  Executor   │  │  Reviewer   │  │ Synthesizer │  │  │
│  │  │(Model Select)│ │ (Parallel)  │  │(Cross-Eval) │  │ (Chairman)  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                           │
│          ┌──────────────────────┼──────────────────────┐                    │
│          ▼                      ▼                      ▼                    │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐             │
│  │   Model     │        │   Voting    │        │   Trace     │             │
│  │  Registry   │        │   Engine    │        │  Collector  │             │
│  └─────────────┘        └─────────────┘        └─────────────┘             │
│          │                      │                      │                    │
│          ▼                      ▼                      ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Provider Layer                                 │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │  │
│  │  │ OpenAI │ │Anthropic│ │ Google │ │ Ollama │ │OpenRouter│            │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Data Layer                                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │  │
│  │  │  Sessions  │  │   Traces   │  │Checkpoints │  │   Votes    │      │  │
│  │  │ (Cosmos)   │  │ (Cosmos)   │  │ (Cosmos)   │  │ (Cosmos)   │      │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Model Agnostic** — Same interface for all LLM providers
2. **Observable** — Every action traced for debugging
3. **Pluggable** — Swap voting methods, discussion protocols
4. **Scalable** — Handle parallel model calls efficiently
5. **Resumable** — Checkpoint and restore any session

---

## 2. Core Components

### 2.1 Model Registry

Manages available models, their capabilities, and configurations.

```typescript
interface ModelConfig {
  id: string;                    // Unique identifier
  provider: Provider;            // openai | anthropic | google | ollama | openrouter
  name: string;                  // Human-readable name
  modelId: string;               // Provider-specific model ID
  endpoint?: string;             // Custom endpoint URL
  capabilities: {
    vision: boolean;
    functionCalling: boolean;
    streaming: boolean;
    maxContextTokens: number;
  };
  pricing: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
  defaultParams: {
    temperature: number;
    maxTokens: number;
    topP?: number;
  };
}
```

### 2.2 Council Orchestrator

Coordinates the multi-stage council process.

```
┌─────────────────────────────────────────────────────────────┐
│                    Council Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: DISPATCH                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User Query → Model Router → Select Council Members  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  Stage 2: FIRST OPINIONS (Parallel)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐       │   │
│  │  │GPT-5│  │Claude│  │ o3  │  │Gemini│  │Llama│       │   │
│  │  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘       │   │
│  │     │        │        │        │        │           │   │
│  │     └────────┴────────┴────────┴────────┘           │   │
│  │                       │                              │   │
│  │              Response Collector                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  Stage 3: REVIEW (Each reviews others)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Anonymize responses → Each model ranks others       │   │
│  │  GPT-5: [C, A, D, B]  Claude: [A, C, B, D]  ...     │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  Stage 4: CONSENSUS                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Voting Engine → Aggregate rankings → Determine winner│  │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  Stage 5: SYNTHESIS                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Chairman Model → Final synthesized response         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Voting Engine

Pluggable voting protocols for consensus.

```typescript
enum VotingMethod {
  MAJORITY = 'majority',           // Simple majority wins
  RANKED_CHOICE = 'ranked_choice', // Instant runoff
  CONSENSUS = 'consensus',         // Require threshold agreement
  WEIGHTED = 'weighted',           // Weight by confidence
  BORDA_COUNT = 'borda_count',     // Points-based ranking
  VETO = 'veto',                   // Any model can veto
}

interface VotingResult {
  method: VotingMethod;
  winner: string;                  // Winning response ID
  scores: Record<string, number>;  // Score per response
  rounds?: VotingRound[];          // For multi-round voting
  dissenting: string[];            // Models that disagreed
  confidence: number;              // Overall consensus strength
}
```

### 2.4 Self-Correction & Backup System

Extra council members serve specialized roles.

```
┌────────────────────────────────────────────────────────────────┐
│                    Council Composition                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PRIMARY COUNCIL (Active Voters)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │  Agent 1 │ │  Agent 2 │ │  Agent 3 │                       │
│  │  (GPT-5) │ │ (Claude) │ │   (o3)   │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
│                                                                │
│  BACKUP & SUPPORT ROLES                                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐     │
│  │   VERIFIER     │ │  TIE-BREAKER   │ │  HOT STANDBY   │     │
│  │ Validates      │ │ Resolves split │ │ Takes over on  │     │
│  │ final output   │ │ votes          │ │ primary failure│     │
│  │ (DeepSeek)     │ │ (Gemini)       │ │ (GPT-4o)       │     │
│  └────────────────┘ └────────────────┘ └────────────────┘     │
│                                                                │
│  ┌────────────────┐ ┌────────────────┐                        │
│  │ DEVIL'S        │ │  SUB-AGENT     │                        │
│  │ ADVOCATE       │ │ COORDINATOR    │                        │
│  │ Challenges     │ │ Delegates      │                        │
│  │ consensus      │ │ sub-tasks      │                        │
│  │ (Llama)        │ │ (Mistral)      │                        │
│  └────────────────┘ └────────────────┘                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.5 Agent Role Configuration

```typescript
interface AgentRole {
  id: string;
  name: string;
  type: 'primary' | 'backup' | 'support';
  role: 'voter' | 'verifier' | 'tie_breaker' | 'devil_advocate' | 'sub_agent' | 'chairman';
  model: ModelConfig;
  systemPrompt: string;
  activationCondition?: {
    trigger: 'always' | 'on_failure' | 'on_tie' | 'on_low_confidence' | 'on_request';
    threshold?: number;
  };
  voting: {
    weight: number;           // 0-1, voting power
    canVeto: boolean;
    mustAgree: boolean;       // Required for consensus
  };
}
```

---

## 3. Debug & Visualization System

### 3.1 Debug View Components

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          DEBUG DASHBOARD                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        TIMELINE VIEW                                 │  │
│  │  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐          │  │
│  │  │User│───►│GPT5│───►│Clau│───►│Vote│───►│Synth│───►│Out │          │  │
│  │  │Qry │    │Resp│    │Resp│    │    │    │    │    │put │          │  │
│  │  └────┘    └────┘    └────┘    └────┘    └────┘    └────┘          │  │
│  │  t=0ms     t=450ms   t=380ms   t=100ms   t=500ms   t=1430ms        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        AGENT CONVERSATION                            │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │ GPT-5 (Primary Voter)                              t=450ms    │  │  │
│  │  │ ─────────────────────────────────────────────────────────────│  │  │
│  │  │ Response: "Based on my analysis, I recommend option A..."     │  │  │
│  │  │                                                               │  │  │
│  │  │ Tokens: 245 in / 189 out | Cost: $0.0023 | Confidence: 0.87  │  │  │
│  │  │ Reasoning: [Expand ▼]                                        │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │ Claude (Primary Voter)                             t=380ms    │  │  │
│  │  │ ─────────────────────────────────────────────────────────────│  │  │
│  │  │ Response: "I believe option B is more appropriate..."         │  │  │
│  │  │                                                               │  │  │
│  │  │ Tokens: 230 in / 210 out | Cost: $0.0031 | Confidence: 0.72  │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────┐  ┌──────────────────────────┐              │
│  │     VOTING BREAKDOWN     │  │      COST SUMMARY        │              │
│  │  ─────────────────────── │  │  ───────────────────────│              │
│  │  Option A: ████████ 65%  │  │  Total Tokens: 1,245    │              │
│  │  Option B: ████░░░░ 35%  │  │  Total Cost: $0.0124    │              │
│  │  ────────────────────    │  │  Latency: 1,430ms       │              │
│  │  Winner: Option A        │  │  Models Used: 4         │              │
│  │  Method: Ranked Choice   │  │                         │              │
│  └──────────────────────────┘  └──────────────────────────┘              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Role Configuration Panel

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        ROLE CONFIGURATION                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Council Configuration: "Research Council v2"                              │
│  ───────────────────────────────────────────                              │
│                                                                            │
│  PRIMARY VOTERS                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ● GPT-5 (Reasoning Lead)                          [Edit] [Remove]   │  │
│  │   Model: gpt-5 | Weight: 1.0 | Veto: No | Required: Yes             │  │
│  │   System Prompt: "You are a research analyst..."                     │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ● Claude (Alternative View)                       [Edit] [Remove]   │  │
│  │   Model: claude-3.5-sonnet | Weight: 1.0 | Veto: No                 │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ ● o3-mini (Deep Reasoning)                        [Edit] [Remove]   │  │
│  │   Model: o3-mini | Weight: 0.8 | Veto: No                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                           [+ Add Primary Voter]            │
│                                                                            │
│  BACKUP AGENTS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ○ Verifier (DeepSeek-R1)               Trigger: Always              │  │
│  │ ○ Tie-Breaker (Gemini)                 Trigger: On Tie              │  │
│  │ ○ Hot Standby (GPT-4o)                 Trigger: On Failure          │  │
│  │ ○ Devil's Advocate (Llama)             Trigger: On Low Confidence   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                           [+ Add Backup Agent]             │
│                                                                            │
│  VOTING CONFIGURATION                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Method: [Ranked Choice ▼]  Threshold: [0.6    ]  Rounds: [3    ]   │  │
│  │  ☑ Allow tie-breaker   ☑ Enable veto   ☐ Require unanimity          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  [Save Configuration]  [Export YAML]  [Import]  [Test Council]            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Conversation Replay

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        SESSION REPLAY                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Session: abc123 | Date: 2026-01-10 | Duration: 45 min | Turns: 23        │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  ◄◄  ◄  ▶  ►►  │▬▬▬▬▬▬▬▬▬●▬▬▬▬▬▬▬▬▬▬▬▬▬│  Turn 15/23                    │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ TURN 15: Council Response                                           │  │
│  │ ─────────────────────────────────────────────────────────────────── │  │
│  │                                                                     │  │
│  │ [User] What's the best approach for scaling this system?            │  │
│  │                                                                     │  │
│  │ [Council] After deliberation, we recommend:                         │  │
│  │ 1. Implement horizontal scaling with Kubernetes                     │  │
│  │ 2. Use Redis for caching...                                         │  │
│  │                                                                     │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐│  │
│  │ │ Voting: Majority (3/4) agreed on horizontal scaling              ││  │
│  │ │ Dissent: Claude preferred vertical scaling initially             ││  │
│  │ │ Chairman: GPT-5 synthesized final response                       ││  │
│  │ └─────────────────────────────────────────────────────────────────┘│  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  CHECKPOINTS                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ● Turn 5: "Architecture discussion"      [Load] [Branch]           │  │
│  │ ● Turn 12: "Scaling debate"              [Load] [Branch]           │  │
│  │ ● Turn 15: "Resolution" (current)        [Load] [Branch]           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  [Export Session]  [Fork Session]  [Compare with...]                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. File Structure & Export Format

### 4.1 Project Directory Structure

```
llmcouncil/
├── docs/                           # Documentation
│   ├── RESEARCH.md
│   ├── ARCHITECTURE.md
│   ├── AZURE_SETUP.md
│   ├── FEATURES.md
│   └── ROADMAP.md
│
├── packages/
│   ├── core/                       # Core library
│   │   ├── src/
│   │   │   ├── council/           # Council orchestrator
│   │   │   ├── models/            # Provider adapters
│   │   │   ├── voting/            # Voting protocols
│   │   │   ├── tracing/           # Debug/trace collection
│   │   │   └── types/             # TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                        # Backend API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── web/                        # Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── chat/
│       │   │   ├── debug/
│       │   │   └── config/
│       │   ├── pages/
│       │   └── stores/
│       └── package.json
│
├── schemas/                        # JSON Schemas
│   └── v1/
│       ├── session.schema.json
│       ├── trace.schema.json
│       ├── vote.schema.json
│       └── checkpoint.schema.json
│
├── examples/                       # Usage examples
│   ├── basic-council/
│   ├── custom-voting/
│   └── with-tools/
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── azure/                          # Azure deployment
    ├── infra/
    │   └── main.bicep
    └── azure.yaml
```

### 4.2 Export File Structure

```
exports/
├── manifest.json                    # Index of all exports
├── sessions/
│   └── {session_id}/
│       ├── session.json            # Session metadata
│       ├── conversation.jsonl      # Messages in order
│       ├── traces/
│       │   ├── {trace_id}.json     # Individual traces
│       │   └── index.json          # Trace manifest
│       ├── checkpoints/
│       │   ├── {checkpoint_id}.json
│       │   └── index.json
│       ├── voting/
│       │   └── {vote_id}.json
│       └── debug/
│           ├── reasoning.jsonl     # Reasoning traces
│           └── tool_calls.jsonl    # Tool execution logs
├── agents/
│   └── {agent_id}/
│       ├── config.yaml             # Agent configuration
│       └── prompts/
│           └── {prompt_name}.txt
└── schemas/
    └── v1/
        └── *.schema.json
```

### 4.3 Export Format Specifications

#### Session Metadata (`session.json`)
```json
{
  "version": "1.0.0",
  "sessionId": "uuid",
  "createdAt": "2026-01-10T12:00:00Z",
  "updatedAt": "2026-01-10T13:30:00Z",
  "metadata": {
    "title": "Architecture Discussion",
    "description": "Council discussion about system scaling",
    "tags": ["architecture", "scaling"]
  },
  "council": {
    "configId": "research-council-v2",
    "primaryAgents": ["gpt-5", "claude", "o3-mini"],
    "backupAgents": ["deepseek-r1", "gemini"],
    "votingMethod": "ranked_choice"
  },
  "stats": {
    "totalTurns": 23,
    "totalTokens": 45000,
    "totalCost": 0.45,
    "avgLatencyMs": 1200,
    "consensusRate": 0.78
  },
  "files": {
    "conversation": "conversation.jsonl",
    "traces": "traces/index.json",
    "checkpoints": "checkpoints/index.json"
  }
}
```

#### Conversation Messages (`conversation.jsonl`)
```jsonl
{"id":"msg-001","timestamp":"2026-01-10T12:00:00Z","role":"user","content":"How should we scale this system?","metadata":{}}
{"id":"msg-002","timestamp":"2026-01-10T12:00:01Z","role":"council","content":"After deliberation...","councilData":{"stage":"synthesis","winningResponse":"resp-gpt5","votingResult":{"method":"ranked_choice","winner":"option_a","scores":{"option_a":0.65,"option_b":0.35}},"agentResponses":[{"agentId":"gpt-5","responseId":"resp-gpt5","content":"...","confidence":0.87,"latencyMs":450,"tokens":{"input":245,"output":189}},{"agentId":"claude","responseId":"resp-claude","content":"...","confidence":0.72,"latencyMs":380,"tokens":{"input":230,"output":210}}]}}
```

#### Trace Data (`traces/{trace_id}.json`)
```json
{
  "traceId": "trace-001",
  "sessionId": "session-uuid",
  "turnId": "msg-002",
  "spans": [
    {
      "spanId": "span-001",
      "parentSpanId": null,
      "name": "council.execute",
      "startTime": "2026-01-10T12:00:01.000Z",
      "endTime": "2026-01-10T12:00:02.430Z",
      "status": "ok",
      "attributes": {
        "council.config": "research-council-v2",
        "council.agents": 4
      },
      "children": ["span-002", "span-003", "span-004"]
    },
    {
      "spanId": "span-002",
      "parentSpanId": "span-001",
      "name": "agent.call",
      "agentId": "gpt-5",
      "startTime": "2026-01-10T12:00:01.100Z",
      "endTime": "2026-01-10T12:00:01.550Z",
      "status": "ok",
      "attributes": {
        "model": "gpt-5",
        "tokens.input": 245,
        "tokens.output": 189,
        "cost": 0.0023,
        "temperature": 0.7
      }
    }
  ]
}
```

#### Voting Record (`voting/{vote_id}.json`)
```json
{
  "voteId": "vote-001",
  "sessionId": "session-uuid",
  "turnId": "msg-002",
  "timestamp": "2026-01-10T12:00:02.200Z",
  "topic": "Scaling approach recommendation",
  "method": "ranked_choice",
  "rounds": [
    {
      "round": 1,
      "votes": {
        "gpt-5": {"rankings": ["option_a", "option_b"], "confidence": 0.87, "reasoning": "Horizontal scaling provides better elasticity..."},
        "claude": {"rankings": ["option_b", "option_a"], "confidence": 0.72, "reasoning": "Vertical scaling is simpler..."},
        "o3-mini": {"rankings": ["option_a", "option_b"], "confidence": 0.91, "reasoning": "Mathematical analysis shows..."}
      },
      "eliminated": "option_b",
      "continuing": ["option_a"]
    }
  ],
  "result": {
    "winner": "option_a",
    "finalScore": 0.65,
    "confidence": 0.83,
    "unanimous": false,
    "dissenting": ["claude"]
  }
}
```

#### Checkpoint (`checkpoints/{checkpoint_id}.json`)
```json
{
  "checkpointId": "cp-001",
  "sessionId": "session-uuid",
  "turnIndex": 15,
  "createdAt": "2026-01-10T12:30:00Z",
  "metadata": {
    "reason": "user_requested",
    "label": "Before final decision",
    "tags": ["milestone"]
  },
  "state": {
    "conversationHash": "sha256:abc123...",
    "agentStates": {
      "gpt-5": {
        "contextUsage": 0.45,
        "totalTokens": 12000,
        "totalCost": 0.12
      }
    },
    "pendingVotes": [],
    "currentStage": "synthesis"
  },
  "resumable": true
}
```

---

## 5. Data Models

### 5.1 Core TypeScript Types

```typescript
// Session
interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  title: string;
  councilConfigId: string;
  status: 'active' | 'completed' | 'archived';
  messages: Message[];
  stats: SessionStats;
}

// Message
interface Message {
  id: string;
  sessionId: string;
  timestamp: Date;
  role: 'user' | 'council' | 'system';
  content: string;
  councilData?: CouncilResponse;
  metadata: Record<string, any>;
}

// Council Response
interface CouncilResponse {
  stage: 'opinions' | 'review' | 'voting' | 'synthesis';
  agentResponses: AgentResponse[];
  votingResult?: VotingResult;
  winningResponse?: string;
  synthesizedContent?: string;
  traceId: string;
}

// Agent Response
interface AgentResponse {
  agentId: string;
  responseId: string;
  content: string;
  confidence: number;
  latencyMs: number;
  tokens: { input: number; output: number };
  cost: number;
  reasoning?: string[];
  toolCalls?: ToolCall[];
}

// Trace
interface Trace {
  traceId: string;
  sessionId: string;
  turnId: string;
  spans: Span[];
  startTime: Date;
  endTime: Date;
  status: 'ok' | 'error';
}

// Span (OpenTelemetry compatible)
interface Span {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime: Date;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, any>;
  events?: SpanEvent[];
  children?: string[];
}
```

### 5.2 Cosmos DB Container Design

| Container | Partition Key | Purpose |
|-----------|--------------|---------|
| `sessions` | `/userId` | User sessions |
| `messages` | `/sessionId` | Conversation messages |
| `traces` | `/sessionId` | Debug traces |
| `checkpoints` | `/sessionId` | Session checkpoints |
| `votes` | `/sessionId` | Voting records |
| `configs` | `/userId` | Council configurations |

---

## 6. API Design

### 6.1 REST Endpoints

```
POST   /api/sessions                  # Create new council session
GET    /api/sessions                  # List user sessions
GET    /api/sessions/:id              # Get session details
DELETE /api/sessions/:id              # Delete session

POST   /api/sessions/:id/messages     # Send message to council
GET    /api/sessions/:id/messages     # Get session messages

GET    /api/sessions/:id/traces       # Get debug traces
GET    /api/sessions/:id/votes        # Get voting records

POST   /api/sessions/:id/checkpoints  # Create checkpoint
GET    /api/sessions/:id/checkpoints  # List checkpoints
POST   /api/sessions/:id/restore/:cpId # Restore from checkpoint

POST   /api/sessions/:id/export       # Export session
POST   /api/import                    # Import session

GET    /api/configs                   # List council configs
POST   /api/configs                   # Create config
PUT    /api/configs/:id               # Update config
DELETE /api/configs/:id               # Delete config

GET    /api/models                    # List available models
```

### 6.2 WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'message:send': { sessionId: string; content: string };
  'session:subscribe': { sessionId: string };
  'session:unsubscribe': { sessionId: string };
}

// Server → Client
interface ServerEvents {
  'council:stage_start': { stage: string; agents: string[] };
  'agent:response_start': { agentId: string };
  'agent:response_chunk': { agentId: string; chunk: string };
  'agent:response_end': { agentId: string; response: AgentResponse };
  'voting:start': { method: string };
  'voting:result': { result: VotingResult };
  'council:complete': { response: CouncilResponse };
  'error': { code: string; message: string };
}
```

---

## 7. Technology Stack

### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React + TypeScript | Component ecosystem, type safety |
| **State Management** | Zustand | Lightweight, TypeScript-first |
| **UI Components** | shadcn/ui + Tailwind | Customizable, accessible |
| **Backend** | Node.js + Fastify | Fast, async-first |
| **API** | tRPC or REST | Type-safe API layer |
| **Database** | Azure Cosmos DB | Global scale, flexible schema |
| **Cache** | Redis | Session state, rate limiting |
| **Search** | Azure AI Search | RAG capabilities |
| **LLM Providers** | LiteLLM / AI SDK | Unified provider interface |
| **Tracing** | OpenTelemetry | Industry standard |
| **Hosting** | Azure Static Web Apps + Functions | Integrated deployment |

### Alternative Stack (Python)

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI + Pydantic |
| **Async** | asyncio + httpx |
| **Database** | SQLAlchemy + PostgreSQL |
| **LLM** | LiteLLM / LangChain |

---

## Next Steps

See [ROADMAP.md](./ROADMAP.md) for implementation phases.

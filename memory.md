# Memory Dump

## llm-council-copilot-instructions.md

# LLM Council - Copilot Instructions

> Auto-generated instructions for GitHub Copilot to assist with this project

## Project Overview
This is the LLM Council framework - a multi-model consensus system where multiple LLMs debate, vote, and synthesize answers. Inspired by Andrej Karpathy and Satya Nadella's discussions.

## Tech Stack
- **Runtime**: Node.js 18+ (18.7 works with pnpm 8.x and Fastify 4.x)
- **Package Manager**: pnpm 8.15.9 (workspace monorepo)
- **Language**: TypeScript 5.7+
- **Build**: tsc for packages, Vite 6 for web
- **Backend**: Fastify 4.x (NOT 5.x - requires Node 20+)
- **Frontend**: React 19 + TailwindCSS 3.4
- **AI SDK**: `openai` package (NOT `@azure/openai`)

## Azure Configuration
```env
AZURE_OPENAI_ENDPOINT=https://agpt11.openai.azure.com/
AZURE_OPENAI_API_KEY=97d2d8db24854ec69af6e64ed1889b76
AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

## Critical Patterns

### Azure OpenAI SDK Import (CORRECT)
```typescript
import { AzureOpenAI } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: '2024-10-01-preview',
});
```

### ESM Import Paths
- Always use `.js` extension in TypeScript ESM imports
- Example: `import { foo } from './types.js';` (not `./types.ts`)

### Unused Variables Fix
- Prefix unused parameters with underscore: `_reply`, `_messages`, `_idx`
- TypeScript strict mode (noUnusedLocals) requires this

### o-series Reasoning Models
- Models: o3, o3-mini, o4-mini
- Do NOT use `temperature` parameter (always 1)
- Use `reasoningEffort` parameter instead ('low', 'medium', 'high')

## Common Commands
```bash
# Azure login with tenant (required for MCP tools)
az login --tenant d89fd44c-adfc-4e20-acd5-cc9e5770e40b

# Install dependencies
cd G:\Code\dev\llmcouncil && pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @llm-council/core build

# Start web dev server
cd packages/web && npx vite --port 3000

# Start API server (requires Fastify 4.x for Node 18)
node packages/api/dist/index.js

# Deploy model via Azure REST API
az rest --method PUT \
  --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{name}?api-version=2024-10-01-preview" \
  --body '{"sku":{"name":"GlobalStandard","capacity":50},"properties":{"model":{"format":"OpenAI","name":"gpt-5"}}}'
```

## Known Issues & Solutions

### 1. MCP InvalidAuthenticationTokenTenant Error
**Problem**: Azure MCP tools return 401 with wrong tenant issuer
**Solution**: `az login --tenant d89fd44c-adfc-4e20-acd5-cc9e5770e40b`

### 2. Fastify 5 TypeError: tracingChannel is not a function
**Problem**: Fastify 5 requires Node.js 20+
**Solution**: Downgrade to Fastify 4.28.x in package.json

### 3. pnpm --ignore-engines not recognized
**Problem**: pnpm 8.x doesn't support this flag
**Solution**: Update package.json engines to match Node version

### 4. ESM URL scheme error on Windows
**Problem**: tsx has issues with Windows drive letters in ESM
**Solution**: Build with tsc first, run compiled JS instead

## File Structure
```
llmcouncil/
├── packages/
│   ├── core/               # Types, adapters, voting, pipeline
│   │   └── src/
│   │       ├── types.ts
│   │       ├── presets.ts
│   │       ├── adapters/
│   │       │   ├── base.ts
│   │       │   └── azure-openai.ts
│   │       ├── voting/
│   │       │   └── strategies.ts
│   │       └── pipeline/
│   │           └── council.ts
│   ├── api/                # Fastify REST + WebSocket
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/
│   └── web/                # React + Vite dashboard
│       └── src/
│           ├── pages/
│           └── components/
├── docs/                   # Research, architecture docs
└── .env                    # Azure credentials
```

## Deployed Models (Azure OpenAI - agpt11)
| Deployment | Model | TPM |
|------------|-------|-----|
| gpt-5 | gpt-5 | 50K |
| gpt-5-mini | gpt-5-mini | 50K |
| gpt-4o | gpt-4o | 50K |
| o3 | o3 | 5K |
| o3-mini | o3-mini | 200K |
| o4-mini | o4-mini | - |
| gpt-4.1 | gpt-4.1 | - |

## Next Steps (from Roadmap)
1. ✅ Core library implementation
2. ✅ Web dashboard UI
3. ✅ Build passes
4. ⬜ Add Anthropic adapter via AI Foundry
5. ⬜ Add Cosmos DB persistence
6. ⬜ Add Vitest unit tests
7. ⬜ Deploy to Azure Static Web Apps

---

## llm-council-learnings.md

# LLM Council Project Learnings

## Session Date: January 10, 2026
## Last Updated: January 10, 2026 (Build Successful)

## Azure Authentication
- **Tenant ID**: `d89fd44c-adfc-4e20-acd5-cc9e5770e40b`
- **Subscription**: Visual Studio Enterprise (`8dad9bf7-40dd-4a7f-a35f-b5d679f6cfb8`)
- **OpenAI Resource**: `agpt11` in resource group `agpt1` (East US)
- **Endpoint**: `https://agpt11.openai.azure.com/`
- **API Key**: `97d2d8db24854ec69af6e64ed1889b76`

## MCP Tool Issues & Solutions
1. **InvalidAuthenticationTokenTenant Error**
   - Cause: Wrong tenant issuer for Azure CLI token
   - Solution: `az login --tenant d89fd44c-adfc-4e20-acd5-cc9e5770e40b`
   
2. **Foundry/Cosmos MCP tools disabled**
   - Status: Some MCP tools are user-disabled
   - Workaround: Use Azure CLI (`az rest`) commands directly

3. **Azure Developer CLI (azd) not installed**
   - Solution: Install from https://aka.ms/azd/install (min version 1.20.0)

## Model Deployment Notes
- GPT-5 capacity limit: 50K TPM (not 100K)
- o3-mini: 200K TPM available
- o3: 5K TPM available
- Use `az rest --method PUT` for model deployments, not `az cognitiveservices`

## Package Management
- pnpm 8.15.9 doesn't support `--ignore-engines` flag
- Node 18.7.0 works with `"engines": { "node": ">=18.0.0" }`
- Changed `packageManager` to match installed version

## Deployed Models
| Model | Deployment | TPM | Status |
|-------|------------|-----|--------|
| gpt-5 | gpt-5 | 50K | Active |
| gpt-5-mini | gpt-5-mini | 50K | Active |
| o3 | o3 | 5K | Active |
| o3-mini | o3-mini | 200K | Active |
| gpt-4o | gpt-4o | 50K | Active |
| o4-mini | o4-mini | N/A | Pre-existing |
| gpt-4.1 | gpt-4.1 | N/A | Pre-existing |

## Project Structure
```
G:\Code\dev\llmcouncil\
├── packages/
│   ├── core/     # Types, adapters, voting, pipeline
│   ├── api/      # Fastify REST + WebSocket
│   └── web/      # React + Vite dashboard
├── docs/         # Research, architecture, roadmap
└── .env          # Azure credentials
```

## Key Implementation Patterns
### Azure OpenAI Adapter
- Use `reasoningEffort` parameter for o-series models (o3, o4-mini)
- Handle both streaming and non-streaming responses
- Include proper error handling for 429 rate limits

### Council Pipeline
1. Gather opinions (parallel)
2. Review/rank (each model reviews others)
3. Vote (configurable strategy)
4. Synthesize (chairman model)

### Voting Strategies Implemented
- MajorityVoting
- SuperMajorityVoting
- WeightedVoting
- RankedChoiceVoting
- VetoVoting
- ConfidenceVoting

## Commands Reference
```bash
# Azure login with tenant
az login --tenant d89fd44c-adfc-4e20-acd5-cc9e5770e40b

# Deploy model via REST API
az rest --method PUT \
  --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{name}?api-version=2024-10-01-preview" \
  --body '{"sku":{"name":"GlobalStandard","capacity":50},"properties":{"model":{"format":"OpenAI","name":"gpt-5"}}}'

# List deployments
az cognitiveservices account deployment list --name agpt11 --resource-group agpt1

# Install dependencies
cd G:\Code\dev\llmcouncil && pnpm install

# Run dev servers
pnpm dev
```

## Next Steps (from Roadmap)
- [ ] Add Vitest testing framework
- [ ] Add Anthropic adapter via AI Foundry
- [ ] Implement Cosmos DB persistence
- [ ] Deploy to Azure Static Web Apps

---

## llm-council-product-roadmap.md

# LLM Council - Product Roadmap & Requirements

> **Document Version**: 1.0  
> **Created**: January 11, 2026  
> **Authors**: PM, UX Designer, Marketing (AI-assisted)  
> **Status**: Living Document

---

## 📊 Current State Summary

### What's Deployed (Production)
- **Web**: https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io
- **API**: https://azca-apiyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io
- **Tests**: 48+ Playwright E2E tests passing

### Recent Implementations (Jan 11-12, 2026)
- ✅ LLM Narrator service (backend - `narrator.ts`)
- ✅ Dynamic Role Assignment via MetaCouncil (default behavior)
- ✅ WebSocket narrator integration
- ✅ Markdown rendering for responses
- ✅ Azure Container Apps deployment
- ✅ `useCouncilProgress` React hook (WebSocket progress tracking)
- ✅ `CouncilProgress.tsx` component (member cards, progress bar, narrative)
- ✅ HomePage integration (replaces spinner with progress UI)

### Pending
- ⏳ Deploy progress UI to Azure (in progress)
- ⏳ Cosmos DB persistence
- ⏳ Async queue processing

---

## 🎯 Jobs To Be Done (JTBD)

### Primary JTBD
> **When** I need a well-reasoned answer to a complex question,  
> **I want** multiple AI perspectives to debate and synthesize,  
> **So that** I get a more reliable, balanced answer than from a single model.

### Secondary JTBDs

| Job | Current Solution | Our Solution |
|-----|-----------------|--------------|
| **Compare AI models** | Manual: ask each model separately | Automatic: parallel queries, side-by-side comparison |
| **Reduce AI hallucinations** | Fact-checking, multiple prompts | Voting + self-correction catches errors |
| **Get diverse perspectives** | Ask different models sequentially | Council with different model "personalities" |
| **Explain AI reasoning** | Chain-of-thought prompting | Debate view shows each model's reasoning |

---

## 👥 User Personas

### 1. Technical Researcher (Primary)
- **Name**: Alex (Senior ML Engineer)
- **Goal**: Compare model capabilities for specific tasks
- **Pain points**: Manually testing 5+ models is tedious
- **Quote**: "I need to know which model gives the best code review"

### 2. Product Decision Maker (Secondary)
- **Name**: Jordan (Product Manager)
- **Goal**: Get balanced recommendations for complex decisions
- **Pain points**: Single AI can be biased or miss angles
- **Quote**: "I want multiple perspectives before choosing a strategy"

### 3. AI Curious Professional (Tertiary)
- **Name**: Sam (Marketing Manager)
- **Goal**: Explore AI capabilities without deep technical knowledge
- **Pain points**: Overwhelmed by model choices
- **Quote**: "I just want the best answer, don't make me choose models"

---

## 📋 Product Requirements Document (PRD)

### Epic 1: Enhanced Progress Experience (Priority: HIGH)

**Problem Statement**:  
Users wait 30-120 seconds with only a spinner. No feedback creates anxiety and abandonment.

**User Stories**:

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| US-1.1 | As a user, I want to see which council members are responding so I know progress is being made | Show member cards with status indicators | ✅ |
| US-1.2 | As a user, I want narrative updates about what's happening so I stay engaged | Display LLM-generated progress messages | ✅ |
| US-1.3 | As a user, I want to see a progress bar so I know how much longer to wait | Show stage-based progress (0-100%) | ✅ |
| US-1.4 | As a user, I want to see the current stage so I understand the process | Display: Opinions → Review → Voting → Synthesis | ✅ |

**Technical Requirements**:
- Connect to existing WebSocket narrator events
- Create `useCouncilProgress` React hook
- Create `CouncilProgress.tsx` component
- Add animations for stage transitions

### Epic 2: Persistence & Reliability (Priority: HIGH)

**Problem Statement**:  
Session data is lost on server restart. No way to access previous sessions.

**User Stories**:

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| US-2.1 | As a user, I want my sessions saved so I can refer back to them | Implement Cosmos DB storage | ⏳ |
| US-2.2 | As a user, I want to browse my session history | List view with search/filter | ⏳ |
| US-2.3 | As a user, I want to share a session link | Shareable URLs that persist | ⏳ |

### Epic 3: Performance & Scale (Priority: MEDIUM)

**Problem Statement**:  
API blocks for entire council duration. Can't handle concurrent requests well.

**User Stories**:

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| US-3.1 | As a user, I want immediate acknowledgment when I submit | Return job ID instantly | ⏳ |
| US-3.2 | As a power user, I want to run multiple councils simultaneously | Queue-based processing | ⏳ |

### Epic 4: Advanced Features (Priority: LOW)

| ID | Story | Status |
|----|-------|--------|
| US-4.1 | As a researcher, I want council members to use tools (calculator, code execution) | ⏳ |
| US-4.2 | As an enterprise user, I want councils grounded in my knowledge base (RAG) | ⏳ |
| US-4.3 | As a developer, I want to customize voting algorithms | ⏳ |

---

## 🎨 UX Design Guidelines

### Design Principles
1. **Transparency**: Show the AI's work, not just results
2. **Engagement**: Make waiting feel productive, not passive
3. **Trust**: Display confidence scores and dissenting opinions
4. **Simplicity**: Presets for beginners, customization for experts

### Progress UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  🔵 Gathering Opinions                    [████████░░] 72%  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  GPT-5  │  │ o4-mini │  │  GPT-5  │  │ o3-mini │        │
│  │   ✅    │  │   🔄    │  │  mini   │  │   ⏳    │        │
│  │  2.1s   │  │ 1.3s... │  │   ✅    │  │         │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  💬 "GPT-5 has weighed in with a detailed analysis.        │
│      o4-mini is still thinking through the problem..."     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Color Coding
- 🟢 Green: Complete, success
- 🔵 Blue: In progress, active
- 🟡 Yellow: Warning, low confidence
- 🔴 Red: Error, failed
- ⚪ Gray: Waiting, inactive

---

## 📈 Marketing Positioning

### Tagline Options
1. "When one AI isn't enough" 
2. "Collective AI Intelligence"
3. "The wisdom of many models"
4. "AI consensus, not guesswork"

### Value Propositions

| For | Value |
|-----|-------|
| **Researchers** | Compare models without manual work |
| **Enterprises** | Reduce single-model bias in decisions |
| **Developers** | API for multi-model workflows |
| **Curious users** | Get the "best" answer automatically |

### Competitive Differentiation

| Feature | ChatGPT | Claude | LLM Council |
|---------|---------|--------|-------------|
| Single model | ✅ | ✅ | ❌ |
| Multi-model | ❌ | ❌ | ✅ |
| Voting/consensus | ❌ | ❌ | ✅ |
| Self-correction | Limited | Limited | ✅ Built-in |
| Transparency | Low | Medium | ✅ Full debate view |

### Target Launch Channels
1. **Hacker News** - "Show HN: LLM Council - Multi-model consensus framework"
2. **r/LocalLLaMA** - Research community
3. **Twitter/X** - AI researcher audience
4. **Product Hunt** - Early adopter community

---

## 🗓️ Implementation Roadmap

### Sprint 1 (Current) - Progress UI ✅ COMPLETE
- [x] Create `useCouncilProgress` hook
- [x] Create `CouncilProgress.tsx` component
- [x] Connect to WebSocket narrator events
- [x] Add stage animations
- [ ] Deploy to Azure (in progress)

### Sprint 2 - Persistence
- [ ] Set up Cosmos DB account
- [ ] Implement `CosmosSessionRepository`
- [ ] Add session history UI
- [ ] Shareable session URLs

### Sprint 3 - Async Processing
- [ ] Azure Queue Storage setup
- [ ] Worker implementation (Azure Functions)
- [ ] Status polling UI
- [ ] Concurrent session support

### Sprint 4 - Polish & Launch
- [ ] Error handling improvements
- [ ] Mobile responsive fixes
- [ ] Performance optimization
- [ ] Documentation site

---

## 📊 Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Session completion rate | ~70% | >90% | Track abandoned sessions |
| Average wait time perception | "Long" | "Acceptable" | User survey |
| Return users | N/A | >30% | Analytics |
| API response time | 30-120s | <5s (async) | Monitoring |

---

## 🔄 Next Actions

1. **Immediate**: Build narrator UI components (Sprint 1)
2. **This week**: Set up Cosmos DB for persistence
3. **Next sprint**: Async queue processing
4. **Research**: RAG integration options

---

*Document maintained by product team. Last updated: January 11, 2026*

---

## llmcouncil-context.md

# LLM Council Project Context

## Azure Configuration
- **Tenant ID**: d89fd44c-adfc-4e20-acd5-cc9e5770e40b
- **Subscription**: 8dad9bf7-40dd-4a7f-a35f-b5d679f6cfb8
- **Resource Group**: agpt1
- **Azure OpenAI Resource**: agpt11
- **Endpoint**: https://agpt11.openai.azure.com/
- **API Key**: 97d2d8db24854ec69af6e64ed1889b76

## Deployed Models (on agpt11)
- gpt-5
- gpt-5-mini
- gpt-4o
- gpt-4.1
- o3
- o3-mini
- o4-mini
- dall-e-3

## Project Structure
- `packages/core`: Core library with adapters, voting, pipeline
- `packages/api`: Fastify REST API (port 3001)
- `packages/web`: React + Vite frontend (port 3000)

## API Endpoints
- POST /api/council/run - Run council session
- GET /api/sessions/:id - Get session details
- GET /api/council/presets - List presets
- GET /api/council/models - List models

## Request Schema
```json
{
  "question": "string",
  "preset": "small|standard|reasoning|diverse"
}
```

## Environment Variables (.env in packages/api)
```
AZURE_OPENAI_ENDPOINT=https://agpt11.openai.azure.com/
AZURE_OPENAI_API_KEY=97d2d8db24854ec69af6e64ed1889b76
AZURE_OPENAI_API_VERSION=2024-10-01-preview
API_PORT=3001
```

## Current Issues
- Web server startup issues in terminal
- Need to verify API can call Azure OpenAI models

## Session Progress
- API Server: Running on 0.0.0.0:3001
- Web Server: Needs manual start or alternative approach

---

## llmcouncil-models-research.md

# LLM Council - Available Models Research (Jan 2026)

## Currently Deployed on agpt11 (Azure OpenAI - East US)

| Deployment | Model | Version | Status | Capacity |
|------------|-------|---------|--------|----------|
| gpt-5 | gpt-5 | 2025-08-07 | ✅ Active | 50 |
| gpt-5-mini | gpt-5-mini | 2025-08-07 | ✅ Active | 50 |
| gpt-4.1 | gpt-4.1 | 2025-04-14 | ✅ Active | 50 |
| o4-mini | o4-mini | 2025-04-16 | ✅ Active (Reasoning) | 300 |
| o3-mini | o3-mini | 2025-01-31 | ✅ Active (Reasoning) | 20 |
| o3 | o3 | 2025-04-16 | ✅ Active (Reasoning) | 5 |
| gpt-4o | gpt-4o | 2024-11-20 | ⚠️ Legacy | 50 |

## Newer Models Available (Azure AI Foundry Catalog)

### Top-Tier Chat Models
- **GPT-5.2** (OpenAI) - 200K context, 100K output - Latest enterprise model
- **GPT-5.1** (OpenAI) - Logic-heavy, multi-step tasks
- **DeepSeek-V3.2** (DeepSeek) - 128K context, coding excellence
- **Mistral-Large-3** (Mistral) - 39B active params, multimodal MoE
- **Llama-4-Maverick-17B** (Meta) - 1M context, great for multimodal
- **Grok-4** (xAI) - 256K context, advanced reasoning

### Reasoning Models (no temperature support)
- **o4-mini** (OpenAI) - 200K context - Best cost-effective reasoning
- **o3** (OpenAI) - 200K context - Deep reasoning
- **DeepSeek-R1-0528** (DeepSeek) - 128K context - Open-source reasoning
- **Kimi-K2-Thinking** (Moonshot) - 262K context - Thinking model

### Azure AI Foundry MaaS Models (Serverless)
- **Claude Opus 4.5** (Anthropic) - 200K ctx, 64K output - Industry-leading
- **Claude Sonnet 4.5** (Anthropic) - Complex agents, coding
- **Claude Haiku 4.5** (Anthropic) - Fast, cost-effective
- **Mistral Large 3** - Multimodal, 128K context
- **DeepSeek-V3.2** - Superior reasoning

## Recommended Council Configuration (2026)

### For Azure OpenAI (Already Deployed):
- **gpt-5** - Primary reasoning, agents
- **gpt-5-mini** - Fast responses, cost-effective
- **gpt-4.1** - Long context (1M tokens), instruction following
- **o4-mini** - Deep reasoning tasks

### For Azure AI Foundry (MaaS - Serverless Endpoints):
- **Mistral-Large-3** - Diverse perspective, multimodal
- **DeepSeek-V3.2** - Coding, efficiency
- **Claude-Sonnet-4.5** - Complex agents

## API Version Requirements
- GPT-5 series: `2025-10-01-preview` or later
- o-series (o3, o4-mini): `2024-12-01-preview` or later
- All models: Use `max_completion_tokens` instead of `max_tokens`
- Reasoning models: Don't use `temperature` (fixed at 1)
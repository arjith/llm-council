# LLM Council 🏛️

A multi-model consensus framework inspired by [Andrej Karpathy](https://github.com/karpathy/llm-council) and [Satya Nadella](https://x.com/satyanadella)'s discussions on LLM Councils.

> "Instead of asking one AI for an answer, why not ask multiple and have them debate?"

## 🌐 Live Demo

**Try it now:** [https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io](https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io)

**API Endpoint:** `https://azca-apiyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io`

## ✨ Features

- **Multi-Model Debate**: Multiple AI models (GPT-5, o3, o4-mini) share perspectives and challenge each other
- **Democratic Voting**: Configurable voting methods (majority, ranked-choice, weighted, veto, confidence)
- **Self-Correction**: Backup models join automatically when confidence is low
- **Real-time Debug View**: Watch agents think, vote, and synthesize live
- **Export/Import**: Save and share council sessions in JSON, YAML, Markdown, or HTML
- **Council Presets**: Quick-start configurations for different use cases

## 🚀 Quick Start

### Option 1: Use the Live Demo

1. Visit [the live demo](https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io)
2. Select a council preset (Small, Standard, Reasoning, or Diverse)
3. Enter your question and watch the council deliberate!

### Option 2: Run Locally

#### Prerequisites

- Node.js 20+
- pnpm 9+
- Azure OpenAI account with deployed models

#### Installation

```bash
# Clone the repository
git clone https://github.com/arjith/llm-council.git
cd llm-council

# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Azure OpenAI credentials

# Start development servers
pnpm dev
```

#### Open the Dashboard

Navigate to [http://localhost:3000](http://localhost:3000) to use the web dashboard.

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@llm-council/core` | Core library with types, adapters, voting, and pipeline |
| `@llm-council/api` | Fastify REST API server with WebSocket support |
| `@llm-council/web` | React + Vite web dashboard |

## 🏛️ Council Presets

| Preset | Members | Use Case |
|--------|---------|----------|
| **Small** | 3 | Quick decisions, simple questions |
| **Standard** | 5 | General purpose with self-correction |
| **Reasoning** | 5 | Complex logical problems (o-series focus) |
| **Diverse** | 7 | Maximum perspective diversity |

## 🗳️ Voting Methods

- **Majority**: Simple > 50% wins
- **Super-majority**: 2/3 or 3/4 threshold
- **Ranked-Choice**: Instant runoff voting
- **Weighted**: Members have different voting power
- **Confidence**: Weighted by model confidence scores
- **Veto**: Any member can veto

## 🔧 Azure Models Deployed

This project uses the following Azure OpenAI models (deployed on `agpt11` resource in East US):

| Model | Deployment | Use Case |
|-------|------------|----------|
| GPT-5 | `gpt-5` | Primary reasoning, complex analysis |
| GPT-5 Mini | `gpt-5-mini` | Fast responses, simple queries |
| GPT-4.1 | `gpt-4.1` | Million-token context tasks |
| o3 | `o3` | Deep mathematical reasoning |
| o3-mini | `o3-mini` | Efficient reasoning tasks |
| o4-mini | `o4-mini` | Latest reasoning model |

> **Note:** o-series models (o3, o3-mini, o4-mini) use `reasoningEffort` instead of `temperature` parameter.

## 📡 API Endpoints

**Base URL:** `https://azca-apiyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io` (or `http://localhost:3001` for local dev)

### Council

- `GET /api/council/presets` - List available presets
- `GET /api/council/models` - List available models
- `POST /api/council/run` - Run a council session
- `GET /api/council/:id` - Get session details
- `GET /api/council/:id/traces` - Get session traces

### Sessions

- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session by ID
- `DELETE /api/sessions/:id` - Delete session
- `GET /api/sessions/:id/export` - Export session

### WebSocket

- `WS /api/ws/run?question=...&preset=...` - Run with real-time updates
- `WS /api/ws/session/:id` - Subscribe to session updates

## 🧪 Example Usage

### Run via API (Production)

```bash
curl -X POST https://azca-apiyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io/api/council/run \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the ethical implications of AI in healthcare?",
    "preset": "standard"
  }'
```

### Run via API (Local)

```bash
curl -X POST http://localhost:3001/api/council/run \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the ethical implications of AI in healthcare?",
    "preset": "standard"
  }'
```

### Custom Council Configuration

```bash
curl -X POST http://localhost:3001/api/council/run \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Should we use microservices or monolith?",
    "members": [
      { "modelKey": "gpt-5", "role": "opinion-giver", "name": "Architect" },
      { "modelKey": "o3-mini", "role": "reviewer", "name": "Critic" },
      { "modelKey": "gpt-4o", "role": "synthesizer", "name": "Synthesizer" }
    ],
    "config": {
      "votingMethod": "confidence",
      "selfCorrectionEnabled": true
    }
  }'
```

## 🧪 Testing

### E2E Tests with Playwright

The project includes comprehensive end-to-end tests covering all major user flows.

```bash
# Run tests locally (starts dev server automatically)
pnpm test:e2e

# Run tests with headed browser (visible)
pnpm test:e2e:headed

# Run tests with Playwright UI (interactive debugging)
pnpm test:e2e:ui

# Run tests against deployed endpoint
PLAYWRIGHT_BASE_URL=https://your-deployed-url.com pnpm test:e2e

# View test report
pnpm test:report
```

#### Test Coverage

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `homepage.spec.cjs` | 10 | Hero section, inputs, presets, tooltips |
| `council-flow.spec.cjs` | 15 | Full E2E flows - typing, submission, results |
| `session-detail.spec.cjs` | 20 | Debate/Debug tabs, member cards, timeline |
| `api-integration.spec.cjs` | 10 | API mocking and response handling |
| `navigation.spec.cjs` | 15 | Routing, deep links, keyboard navigation |
| `accessibility.spec.cjs` | 12 | Headings, labels, focus indicators, mobile |
| `inline-config.spec.cjs` | 7 | Config panel sections and interactions |
| `session.spec.cjs` | 5 | Error states, tab navigation |

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Dashboard                            │
│                   (React + Vite)                            │
│     azca-webyslfuxsmb344w...azurecontainerapps.io           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                      API Server                              │
│                     (Fastify)                               │
│     azca-apiyslfuxsmb344w...azurecontainerapps.io           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Core Library                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Adapters   │  │   Voting    │  │      Pipeline       │  │
│  │ (Azure,etc) │  │ Strategies  │  │ (Opinions→Vote→     │  │
│  │             │  │             │  │  Synthesis)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Azure OpenAI                               │
│  GPT-5 │ GPT-5-mini │ GPT-4.1 │ o3 │ o3-mini │ o4-mini     │
└─────────────────────────────────────────────────────────────┘
```

## 🏗️ Azure Infrastructure

The project is deployed on Azure Container Apps:

| Resource | Type | Details |
|----------|------|---------|
| `rg-llm-council` | Resource Group | East US |
| `azca-api...` | Container App | API backend |
| `azca-web...` | Container App | Web frontend |
| `azacr...` | Container Registry | Docker images |
| `agpt11` | Azure OpenAI | Model deployments |

## 🗳️ Voting Methods

| Method | Description |
|--------|-------------|
| **Majority** | Simple > 50% wins |
| **Super-majority** | 2/3 or 3/4 threshold required |
| **Ranked-Choice** | Instant runoff voting |
| **Weighted** | Members have different voting power |
| **Confidence** | Weighted by model confidence scores |
| **Consensus** | All members must agree |
| **Veto** | Any member can veto |

## 🎭 Council Member Roles

| Role | Description |
|------|-------------|
| **opinion-giver** | Provides initial perspective on the question |
| **reviewer** | Evaluates and critiques other responses |
| **synthesizer** | Combines multiple viewpoints into cohesive answer |
| **backup** | Joins when confidence is low or errors occur |
| **arbiter** | Makes final decisions in case of ties |

## 📚 References

- [Andrej Karpathy's LLM Council](https://github.com/karpathy/llm-council)
- [Microsoft AI Tour Demo](https://www.youtube.com/watch?v=...) - Satya Nadella's demo
- [Ensemble Learning (Wikipedia)](https://en.wikipedia.org/wiki/Ensemble_learning)
- [Multi-Agent Systems](https://en.wikipedia.org/wiki/Multi-agent_system)
- [Language Model Council Paper (NAACL 2025)](https://arxiv.org/abs/2406.08598)

## 📖 Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data models
- [Features](docs/FEATURES.md) - Detailed feature specifications
- [Azure Setup](docs/AZURE_SETUP.md) - Azure provisioning guide
- [Research](docs/RESEARCH.md) - Background research and academic references
- [Roadmap](docs/ROADMAP.md) - Implementation phases and milestones

## 📄 License

MIT

---

Built with ❤️ for the AI community | [Live Demo](https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io) | [GitHub](https://github.com/arjith/llm-council)

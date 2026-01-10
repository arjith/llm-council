# LLM Council 🏛️

A multi-model consensus framework inspired by [Andrej Karpathy](https://github.com/karpathy/llm-council) and [Satya Nadella](https://x.com/satyanadella)'s discussions on LLM Councils.

> "Instead of asking one AI for an answer, why not ask multiple and have them debate?"

## ✨ Features

- **Multi-Model Debate**: Multiple AI models share perspectives and challenge each other
- **Democratic Voting**: Configurable voting methods (majority, ranked-choice, weighted, veto)
- **Self-Correction**: Backup models join automatically when confidence is low
- **Real-time Debug View**: Watch agents think, vote, and synthesize live
- **Export/Import**: Save and share council sessions

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Azure OpenAI account with deployed models

### Installation

```bash
# Clone the repository
cd llmcouncil

# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Azure OpenAI credentials

# Start development servers
pnpm dev
```

### Open the Dashboard

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

This project uses the following Azure OpenAI models:

| Model | Deployment | TPM |
|-------|------------|-----|
| GPT-5 | `gpt-5` | 50K |
| GPT-5 Mini | `gpt-5-mini` | 50K |
| o3 | `o3` | 5K |
| o3-mini | `o3-mini` | 200K |
| o4-mini | `o4-mini` | - |
| GPT-4o | `gpt-4o` | 50K |
| GPT-4.1 | `gpt-4.1` | - |

## 📡 API Endpoints

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

### Run via API

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

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Dashboard                            │
│                   (React + Vite)                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                      API Server                              │
│                     (Fastify)                               │
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
│  GPT-5 │ GPT-5-mini │ o3 │ o3-mini │ o4-mini │ GPT-4o      │
└─────────────────────────────────────────────────────────────┘
```

## 📚 References

- [Andrej Karpathy's LLM Council](https://github.com/karpathy/llm-council)
- [Microsoft AI Tour Demo](https://www.youtube.com/watch?v=...) - Satya Nadella's demo
- [Ensemble Learning (Wikipedia)](https://en.wikipedia.org/wiki/Ensemble_learning)
- [Multi-Agent Systems](https://en.wikipedia.org/wiki/Multi-agent_system)

## 📄 License

MIT

---

Built with ❤️ for the AI community

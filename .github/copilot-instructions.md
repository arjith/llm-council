# LLM Council - Copilot Instructions

## Project Overview
Multi-model AI consensus framework inspired by Andrej Karpathy and Satya Nadella's discussions on LLM Councils.

## Tech Stack
- **Node.js**: 18+ (Node 20+ for Fastify 5)
- **Package Manager**: pnpm 8.x workspaces
- **TypeScript**: 5.7+ with strict mode
- **Backend**: Fastify 4.x (use 4.x for Node 18 compatibility)
- **Frontend**: React 19 + Vite 6 + TailwindCSS
- **AI SDK**: `openai` package for Azure OpenAI

## Critical Patterns

### Azure OpenAI SDK
```typescript
// CORRECT - use 'openai' package
import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: '2024-10-01-preview',
});
```

### ESM Imports
Always use `.js` extension:
```typescript
import { foo } from './types.js';  // ✅ Correct
import { foo } from './types';     // ❌ Wrong
```

### Unused Variables
Prefix with underscore for TypeScript strict:
```typescript
async (request, _reply) => { ... }  // ✅
```

### o-series Reasoning Models (o3, o3-mini, o4-mini)
- Don't use `temperature` parameter
- Use `reasoningEffort`: 'low' | 'medium' | 'high'

## Azure Configuration
- Tenant: `d89fd44c-adfc-4e20-acd5-cc9e5770e40b`
- Subscription: `8dad9bf7-40dd-4a7f-a35f-b5d679f6cfb8`
- Resource: `agpt11` in `agpt1` resource group
- Region: East US

## Common Commands
```bash
# Azure login for MCP tools
az login --tenant d89fd44c-adfc-4e20-acd5-cc9e5770e40b

# Build
pnpm build

# Dev servers
cd packages/web && npx vite --port 3000

# Deploy model
az rest --method PUT --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{name}?api-version=2024-10-01-preview" --body '{...}'
```

## Package Structure
- `@llm-council/core`: Types, adapters, voting strategies, council pipeline
- `@llm-council/api`: Fastify REST API + WebSocket
- `@llm-council/web`: React dashboard with debug view

## Deployed Models
| Name | Deployment | Use Case |
|------|------------|----------|
| GPT-5 | gpt-5 | Primary reasoning |
| GPT-5 Mini | gpt-5-mini | Fast responses |
| GPT-4o | gpt-4o | Vision/multimodal |
| o3 | o3 | Deep reasoning |
| o3-mini | o3-mini | Fast reasoning |
| o4-mini | o4-mini | Latest reasoning |

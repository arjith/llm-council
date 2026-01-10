# Azure AI Model Provisioning Guide

> **Purpose:** Step-by-step guide for provisioning AI models on Azure for the LLM Council framework  
> **Last Updated:** January 10, 2026

---

## Current Deployment

### Live Environment

| Resource | Type | URL/Details |
|----------|------|-------------|
| **Web App** | Container App | https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io |
| **API** | Container App | https://azca-apiyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io |
| **Container Registry** | ACR | azacryslfuxsmb344w.azurecr.io |
| **Resource Group** | RG | rg-llm-council (East US) |
| **Azure OpenAI** | Cognitive Services | agpt11 (in agpt1 RG) |

### Deployed Models

| Model | Deployment Name | Status |
|-------|-----------------|--------|
| GPT-5 | gpt-5 | ✅ Active |
| GPT-5 Mini | gpt-5-mini | ✅ Active |
| GPT-4.1 | gpt-4.1 | ✅ Active |
| o3 | o3 | ✅ Active |
| o3-mini | o3-mini | ✅ Active |
| o4-mini | o4-mini | ✅ Active |

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Prerequisites](#2-prerequisites)
- [3. Azure OpenAI Models](#3-azure-openai-models)
- [4. Azure AI Foundry Models](#4-azure-ai-foundry-models)
- [5. Multi-Model Architecture](#5-multi-model-architecture)
- [6. Provisioning Steps](#6-provisioning-steps)
- [7. Cost Optimization](#7-cost-optimization)
- [8. Security Configuration](#8-security-configuration)

---

## 1. Overview

The LLM Council framework requires multiple AI models from different providers to enable diverse perspectives and consensus-building. Azure provides:

1. **Azure OpenAI Service** — GPT-4o, GPT-5, o3, o1 series
2. **Azure AI Foundry** — Claude, Gemini, Llama, DeepSeek, Mistral via Serverless APIs
3. **Supporting Services** — Cosmos DB, AI Search, Static Web Apps, Functions

### Recommended Council Configuration

| Role | Primary Model | Backup Model | Provider |
|------|--------------|--------------|----------|
| **Reasoning Lead** | GPT-5 | GPT-4.1 | Azure OpenAI |
| **Fast Responder** | GPT-5-mini | GPT-4o-mini | Azure OpenAI |
| **Deep Reasoning** | o3-mini | o4-mini | Azure OpenAI |
| **Alternative View** | Claude 3.5 Sonnet | Claude 3 Opus | AI Foundry (Serverless) |
| **Cost Optimizer** | DeepSeek-R1 | Llama-3.3-70B | AI Foundry (Serverless) |

---

## 2. Prerequisites

### Required Azure Resources
- Azure Subscription with OpenAI access approved
- Resource Group for LLM Council resources
- Azure CLI installed and configured
- Contributor role on the subscription

### Access Requests
1. **Azure OpenAI Access:** [Request Form](https://aka.ms/oai/access)
2. **Quota Increases:** [Quota Request](https://aka.ms/oai/stuquotarequest)
3. **AI Foundry Preview Models:** Enable via Azure Portal

### CLI Setup
```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "<your-subscription-id>"

# Register providers
az provider register --namespace Microsoft.CognitiveServices
az provider register --namespace Microsoft.MachineLearningServices
```

---

## 3. Azure OpenAI Models

### Available Models (January 2026)

| Model | Context | Best For | Deployment Type |
|-------|---------|----------|-----------------|
| **GPT-5.2** | 400K | Latest reasoning, vision | Global Standard |
| **GPT-5.1** | 400K | Code optimization | Global Standard |
| **GPT-5** | 400K | General excellence | Global Standard |
| **GPT-5-mini** | 400K | Fast, cost-effective | Global Standard |
| **GPT-4.1** | 1M | Million-token context | Global Standard |
| **o3** | 200K | Advanced reasoning | Global Standard |
| **o3-mini** | 200K | Efficient reasoning | Global Standard |
| **o4-mini** | 200K | Latest reasoning | Global Standard |
| **GPT-4o** | 128K | Multimodal | Global Standard |
| **GPT-4o-mini** | 128K | Fast multimodal | Global Standard |

### Quota Defaults

| Model | Default TPM | Default RPM |
|-------|------------|-------------|
| GPT-5.1 | 1M | 1K |
| GPT-5-mini | 1M | 1K |
| GPT-4.1 | 1M | 1K |
| GPT-4o | 450K | 2.7K |
| o3 | 1M | 1K |

### Best Regions

| Region | Availability | Notes |
|--------|--------------|-------|
| **East US 2** | Full | All GPT-5.x, o-series, Sora |
| **Sweden Central** | Full | EU data residency |
| **West US 3** | Good | Image generation |
| **Central US** | Good | Audio/realtime models |

---

## 4. Azure AI Foundry Models

### Models Sold by Azure (with SLA)

| Provider | Model | Use Case |
|----------|-------|----------|
| **DeepSeek** | DeepSeek-V3.2, DeepSeek-R1 | Cost-effective reasoning |
| **Meta** | Llama-4-Maverick-17B, Llama-3.3-70B | Open-weight alternative |
| **Mistral** | Mistral-Large-3 | European AI option |
| **Cohere** | Command-a, Rerank-v4 | Search/retrieval |
| **xAI** | Grok-4, Grok-3 | Alternative reasoning |

### Serverless API Models (Pay-per-token)

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku |

### Serverless API Quota
- Default: 200,000 TPM, 1,000 RPM per deployment
- One deployment per model per project

---

## 5. Multi-Model Architecture

### Complete Azure Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              User Interface                                 │
│                        Azure Static Web Apps                                │
│                     (React/Vue Council Dashboard)                           │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Azure API Management                                 │
│  • Authentication (Entra ID)                                               │
│  • Rate limiting per user/tier                                              │
│  • Load balancing across model endpoints                                    │
│  • Circuit breaker for failover                                             │
│  • Usage analytics & billing                                                │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Azure Functions                                      │
│                    (Durable Functions Orchestrator)                         │
│  • Council Orchestrator (Fan-out/Fan-in)                                    │
│  • Model Router                                                             │
│  • Response Aggregator                                                      │
│  • Voting Engine                                                            │
│  • Health Monitor                                                           │
└───────────────┬─────────────────┬─────────────────┬────────────────────────┘
                │                 │                 │
        ┌───────┴────┐    ┌───────┴────┐    ┌───────┴────┐
        ▼            ▼    ▼            ▼    ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│Azure OpenAI │ │Azure OpenAI │ │ Serverless  │ │ Serverless  │
│  GPT-5      │ │  o3-mini    │ │   Claude    │ │  DeepSeek   │
│(East US 2)  │ │(Sweden Cen) │ │ (Foundry)   │ │ (Foundry)   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐   │
│  │   Azure Cosmos DB   │  │   Azure AI Search   │  │  Azure Blob       │   │
│  │ • Conversations     │  │ • Knowledge base    │  │  Storage          │   │
│  │ • Council decisions │  │ • Vector embeddings │  │ • Export files    │   │
│  │ • User context      │  │ • Semantic ranking  │  │ • Debug logs      │   │
│  │ • Debug traces      │  └─────────────────────┘  └───────────────────┘   │
│  └─────────────────────┘                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### API Gateway Pattern with Failover

```yaml
# Azure API Management Policy (conceptual)
backends:
  - name: gpt5-primary
    url: https://council-aoai-eastus2.openai.azure.com
    priority: 1
  - name: gpt5-backup
    url: https://council-aoai-swedencentral.openai.azure.com
    priority: 2
    
circuit_breaker:
  failure_threshold: 3
  reset_timeout: 30s
  
retry_policy:
  max_retries: 3
  initial_delay: 1s
  max_delay: 30s
  backoff: exponential
```

---

## 6. Provisioning Steps

### Step 1: Create Resource Group

```bash
# Create resource group
az group create \
  --name llm-council-rg \
  --location eastus2
```

### Step 2: Create Azure OpenAI Resources

```bash
# Primary region (East US 2)
az cognitiveservices account create \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --kind OpenAI \
  --sku S0 \
  --location eastus2 \
  --yes

# Backup region (Sweden Central)
az cognitiveservices account create \
  --name council-aoai-swedencentral \
  --resource-group llm-council-rg \
  --kind OpenAI \
  --sku S0 \
  --location swedencentral \
  --yes
```

### Step 3: Deploy Models

```bash
# Deploy GPT-5 (Primary reasoning)
az cognitiveservices account deployment create \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --deployment-name gpt-5 \
  --model-name gpt-5 \
  --model-version "2025-08-07" \
  --model-format OpenAI \
  --sku-capacity 100 \
  --sku-name GlobalStandard

# Deploy GPT-5-mini (Fast responses)
az cognitiveservices account deployment create \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --deployment-name gpt-5-mini \
  --model-name gpt-5-mini \
  --model-version "2025-08-07" \
  --model-format OpenAI \
  --sku-capacity 100 \
  --sku-name GlobalStandard

# Deploy o3-mini (Deep reasoning)
az cognitiveservices account deployment create \
  --name council-aoai-swedencentral \
  --resource-group llm-council-rg \
  --deployment-name o3-mini \
  --model-name o3-mini \
  --model-version "2025-01-31" \
  --model-format OpenAI \
  --sku-capacity 50 \
  --sku-name GlobalStandard

# Deploy GPT-4o-mini (Budget option)
az cognitiveservices account deployment create \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --deployment-name gpt-4o-mini \
  --model-name gpt-4o-mini \
  --model-version "2024-07-18" \
  --model-format OpenAI \
  --sku-capacity 100 \
  --sku-name GlobalStandard
```

### Step 4: Create AI Foundry Hub & Project

```bash
# Create AI Foundry Hub
az ml workspace create \
  --name council-ai-hub \
  --resource-group llm-council-rg \
  --kind hub \
  --location eastus2

# Create Project under Hub
az ml workspace create \
  --name council-project \
  --resource-group llm-council-rg \
  --kind project \
  --hub-id /subscriptions/<sub-id>/resourceGroups/llm-council-rg/providers/Microsoft.MachineLearningServices/workspaces/council-ai-hub
```

### Step 5: Deploy Serverless Models (via Portal)

1. Navigate to Azure AI Foundry Portal
2. Select `council-project`
3. Go to Model Catalog → Deploy
4. Deploy:
   - **Claude 3.5 Sonnet** (Serverless API)
   - **DeepSeek-R1** (Serverless API)
   - **Llama-3.3-70B-Instruct** (Serverless API)

### Step 6: Create Supporting Services

```bash
# Azure Cosmos DB (NoSQL)
az cosmosdb create \
  --name council-cosmos \
  --resource-group llm-council-rg \
  --locations regionName=eastus2 failoverPriority=0 isZoneRedundant=true \
  --default-consistency-level Session \
  --enable-analytical-storage true

# Create database and containers
az cosmosdb sql database create \
  --account-name council-cosmos \
  --resource-group llm-council-rg \
  --name CouncilDB

az cosmosdb sql container create \
  --account-name council-cosmos \
  --resource-group llm-council-rg \
  --database-name CouncilDB \
  --name conversations \
  --partition-key-path /userId \
  --throughput 400

az cosmosdb sql container create \
  --account-name council-cosmos \
  --resource-group llm-council-rg \
  --database-name CouncilDB \
  --name traces \
  --partition-key-path /sessionId \
  --throughput 400
```

```bash
# Azure AI Search
az search service create \
  --name council-search \
  --resource-group llm-council-rg \
  --sku standard \
  --replica-count 3 \
  --partition-count 1 \
  --location eastus2
```

### Step 7: Get Connection Information

```bash
# Get Azure OpenAI endpoints and keys
az cognitiveservices account show \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --query properties.endpoint

az cognitiveservices account keys list \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg

# Get Cosmos DB connection string
az cosmosdb keys list \
  --name council-cosmos \
  --resource-group llm-council-rg \
  --type connection-strings
```

---

## 7. Cost Optimization

### Pricing Tiers Strategy

| Query Type | Model | Cost/1M tokens | Use When |
|------------|-------|----------------|----------|
| Simple | GPT-4o-mini | ~$0.15 input | Quick questions |
| Standard | GPT-5-mini | ~$0.50 input | General tasks |
| Complex | GPT-5 | ~$2.50 input | Deep reasoning |
| Reasoning | o3-mini | ~$1.10 input | Math/logic |
| Budget | DeepSeek-R1 | ~$0.14 input | Cost-sensitive |

### Cost-Saving Strategies

1. **Model Tiering**
   - Route simple queries to mini models
   - Escalate to full models only when needed
   - **Savings:** 50-80%

2. **Global Batch Processing**
   - Use for non-real-time evaluation
   - **Savings:** 50%

3. **Provisioned Throughput**
   - For stable, high-volume workloads
   - **Savings:** 20-40%

4. **Caching**
   - Cache common responses in Cosmos DB
   - Use TTL based on query type
   - **Savings:** 30-50%

5. **Prompt Optimization**
   - Minimize system prompt size
   - Use concise instructions
   - **Savings:** 20-40%

### Estimated Monthly Costs

| Component | Configuration | Est. Cost/Month |
|-----------|--------------|-----------------|
| Azure OpenAI (GPT-5) | 1M TPM, moderate use | $500-2,000 |
| Azure OpenAI (mini models) | 1M TPM | $100-400 |
| Serverless APIs | Pay-per-use | $100-500 |
| Cosmos DB | 400 RU/s, 10GB | $25 |
| AI Search | Standard, 3 replicas | $750 |
| Functions | Consumption plan | $50-200 |
| Static Web Apps | Standard | $9 |
| API Management | Developer tier | $50 |
| **Total (moderate use)** | | **$1,500-4,000** |

---

## 8. Security Configuration

### Recommended Security Settings

1. **Private Endpoints**
```bash
# Create private endpoint for Azure OpenAI
az network private-endpoint create \
  --name council-aoai-pe \
  --resource-group llm-council-rg \
  --vnet-name council-vnet \
  --subnet private-endpoints \
  --private-connection-resource-id /subscriptions/<sub>/resourceGroups/llm-council-rg/providers/Microsoft.CognitiveServices/accounts/council-aoai-eastus2 \
  --group-id account \
  --connection-name aoai-connection
```

2. **Managed Identity**
```bash
# Enable system-assigned identity for Functions
az functionapp identity assign \
  --name council-functions \
  --resource-group llm-council-rg

# Assign Cognitive Services User role
az role assignment create \
  --assignee <function-identity-principal-id> \
  --role "Cognitive Services User" \
  --scope /subscriptions/<sub>/resourceGroups/llm-council-rg/providers/Microsoft.CognitiveServices/accounts/council-aoai-eastus2
```

3. **Network Security**
```bash
# Disable public access
az cognitiveservices account update \
  --name council-aoai-eastus2 \
  --resource-group llm-council-rg \
  --public-network-access Disabled
```

4. **Key Vault for Secrets**
```bash
# Create Key Vault
az keyvault create \
  --name council-kv \
  --resource-group llm-council-rg \
  --location eastus2

# Store API keys
az keyvault secret set \
  --vault-name council-kv \
  --name aoai-key \
  --value "<api-key>"
```

### Defender for AI
- Enable Microsoft Defender for AI Services
- Monitor for prompt injection attempts
- Track anomalous usage patterns

---

## Next Steps

1. ✅ Provision Azure OpenAI resources
2. ✅ Deploy required models
3. ✅ Set up AI Foundry for serverless models
4. ✅ Configure Cosmos DB and AI Search
5. ⏳ Implement Functions orchestrator
6. ⏳ Build Static Web App frontend
7. ⏳ Configure API Management
8. ⏳ Enable monitoring and alerts

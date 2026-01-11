# Dynamic Council Architecture

> **Purpose:** Design document for dynamic role assignment, iteration control, and meta-council  
> **Created:** January 11, 2026

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Meta-Council System](#2-meta-council-system)
- [3. Dynamic Role Assignment](#3-dynamic-role-assignment)
- [4. Iteration Control](#4-iteration-control)
- [5. Memory & Context Sharing](#5-memory--context-sharing)
- [6. Configuration Schema](#6-configuration-schema)
- [7. Implementation Details](#7-implementation-details)

---

## 1. Overview

### Problem Statement

The current LLM Council uses static preset configurations. For complex tasks, we need:
- **Dynamic role assignment** based on question complexity and type
- **Flexible council composition** - repeat models with different personas if needed
- **Iteration control** with safeguards against runaway processing
- **Shared memory** for context persistence across iterations
- **Meta-decision making** about council setup itself

### Design Goals

1. **Intelligent Configuration** - Let an LLM (or rules) decide optimal council setup
2. **Iterative Refinement** - Allow multi-pass processing for complex questions
3. **Snowball Prevention** - Hard limits on depth, count, tokens, and time
4. **Context Continuity** - Share relevant information across iterations
5. **Deterministic Output** - Use JSON schemas for configuration decisions

---

## 2. Meta-Council System

### Concept

A "meta-council" or "council planner" analyzes the incoming question and decides:
- How many council members to use
- Which roles to assign
- Whether to allow iterations
- What voting method to use
- Complexity assessment

### Two Modes

#### 2.1 Static Rules (Fast, Deterministic)

```typescript
interface StaticRules {
  // Keyword-based routing
  keywords: {
    pattern: RegExp;
    preset: 'small' | 'standard' | 'reasoning' | 'diverse';
    allowIterations: boolean;
  }[];
  
  // Length-based adjustments
  lengthThresholds: {
    short: number;   // < 100 chars
    medium: number;  // 100-500 chars
    long: number;    // > 500 chars
  };
  
  // Default fallback
  default: CouncilConfig;
}

// Example rules
const STATIC_RULES: StaticRules = {
  keywords: [
    { pattern: /math|calculate|solve|equation/i, preset: 'reasoning', allowIterations: true },
    { pattern: /code|program|function|algorithm/i, preset: 'reasoning', allowIterations: true },
    { pattern: /simple|quick|what is|define/i, preset: 'small', allowIterations: false },
    { pattern: /compare|analyze|evaluate|complex/i, preset: 'diverse', allowIterations: true },
    { pattern: /debate|argue|pros.?cons|should/i, preset: 'diverse', allowIterations: true },
  ],
  lengthThresholds: { short: 100, medium: 500, long: 1000 },
  default: { preset: 'standard', allowIterations: false },
};
```

#### 2.2 LLM-Based Planning (Intelligent, Flexible)

Use a fast model (gpt-5-mini) to analyze the question and output structured JSON:

```typescript
interface MetaCouncilPrompt {
  systemPrompt: string;
  outputSchema: JsonSchema;
}

const META_COUNCIL_PROMPT = `You are a council planning assistant. Analyze the user's question and decide the optimal council configuration.

Consider:
1. Question complexity (simple factual vs complex reasoning)
2. Domain (general, technical, creative, ethical)
3. Need for multiple perspectives
4. Whether iterative refinement would help

Output your decision as JSON matching the schema provided.`;

const META_COUNCIL_SCHEMA = {
  type: 'object',
  properties: {
    complexity: { enum: ['simple', 'moderate', 'complex', 'expert'] },
    domain: { enum: ['general', 'technical', 'creative', 'ethical', 'factual'] },
    councilSize: { type: 'number', minimum: 3, maximum: 9 },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { enum: ['opinion-giver', 'reviewer', 'devil-advocate', 'fact-checker', 'synthesizer'] },
          model: { enum: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'o3', 'o3-mini', 'o4-mini'] },
          persona: { type: 'string' },
        }
      }
    },
    allowIterations: { type: 'boolean' },
    maxIterations: { type: 'number', minimum: 1, maximum: 5 },
    votingMethod: { enum: ['majority', 'confidence', 'weighted', 'ranked-choice'] },
    reasoning: { type: 'string' },
  },
  required: ['complexity', 'councilSize', 'roles', 'allowIterations', 'votingMethod'],
};
```

### Decision Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         META-COUNCIL FLOW                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User Question                                                             │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────┐                                                  │
│  │ Planning Mode?      │                                                  │
│  └──────────┬──────────┘                                                  │
│             │                                                              │
│      ┌──────┴──────┐                                                      │
│      │             │                                                      │
│      ▼             ▼                                                      │
│  ┌───────┐    ┌───────────┐                                              │
│  │Static │    │LLM-Based  │                                              │
│  │Rules  │    │Planning   │                                              │
│  └───┬───┘    └─────┬─────┘                                              │
│      │              │                                                      │
│      │         ┌────▼────┐                                                │
│      │         │GPT-5-mini│──► JSON Config                                │
│      │         │(fast)   │                                                │
│      │         └─────────┘                                                │
│      │              │                                                      │
│      └──────────────┴────────────────────────────────────┐                │
│                                                          │                │
│                                                          ▼                │
│                                                  ┌───────────────┐        │
│                                                  │Council Config │        │
│                                                  │{              │        │
│                                                  │  size: 5,     │        │
│                                                  │  roles: [...],│        │
│                                                  │  iterate: true│        │
│                                                  │}              │        │
│                                                  └───────┬───────┘        │
│                                                          │                │
│                                                          ▼                │
│                                                  Run Council Pipeline     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dynamic Role Assignment

### Extended Roles

```typescript
type ExtendedCouncilRole =
  | 'opinion-giver'      // Standard opinion provider
  | 'reviewer'           // Critiques other opinions
  | 'synthesizer'        // Combines viewpoints
  | 'devil-advocate'     // Challenges consensus
  | 'fact-checker'       // Verifies claims
  | 'domain-expert'      // Specialized knowledge
  | 'moderator'          // Guides discussion
  | 'skeptic'            // Questions assumptions
  | 'creative'           // Novel ideas
  | 'arbiter'            // Tie-breaker
  | 'backup';            // Activated on low confidence

interface DynamicMember {
  id: string;
  model: ModelKey;
  role: ExtendedCouncilRole;
  persona?: string;           // Custom persona description
  systemPrompt?: string;      // Override prompt
  temperature?: number;       // Per-member temperature
  weight?: number;            // Voting weight
}
```

### Model Reuse with Different Personas

The same model can appear multiple times with different configurations:

```typescript
const DIVERSE_PERSPECTIVES = [
  {
    model: 'gpt-5',
    role: 'opinion-giver',
    persona: 'Analytical Thinker',
    systemPrompt: 'You are an analytical thinker who focuses on data and logical reasoning.',
    temperature: 0.3,
  },
  {
    model: 'gpt-5',
    role: 'opinion-giver',
    persona: 'Creative Visionary',
    systemPrompt: 'You are a creative visionary who explores unconventional solutions.',
    temperature: 0.9,
  },
  {
    model: 'gpt-5',
    role: 'devil-advocate',
    persona: 'Critical Skeptic',
    systemPrompt: 'You challenge assumptions and find weaknesses in arguments.',
    temperature: 0.5,
  },
];
```

### Role Templates

Professional, well-engineered prompts for each role:

```typescript
const ROLE_PROMPTS: Record<ExtendedCouncilRole, string> = {
  'opinion-giver': `You are a council member providing your expert opinion.

RESPONSIBILITIES:
- Analyze the question thoroughly before responding
- Provide a clear, well-reasoned position
- Support your view with evidence and logic
- Express your confidence level honestly (0.0-1.0)
- Consider potential counterarguments

FORMAT:
Begin with your main position, then elaborate with supporting points.
End with: "Confidence: [0.0-1.0]"`,

  'reviewer': `You are a critical reviewer on the council.

RESPONSIBILITIES:
- Evaluate each opinion for logical consistency
- Identify strengths and weaknesses
- Check for unsupported assumptions
- Rate each opinion on quality (1-10)
- Suggest improvements or alternatives

FORMAT:
For each opinion, provide:
1. Summary of position
2. Strengths identified
3. Weaknesses or gaps
4. Quality rating (1-10)`,

  'devil-advocate': `You are the Devil's Advocate on this council.

RESPONSIBILITIES:
- Challenge the emerging consensus
- Present the strongest opposing arguments
- Identify risks and downsides
- Force the council to justify their positions
- Prevent groupthink

FORMAT:
Present your challenges clearly and forcefully.
Your role is adversarial but constructive.`,

  'fact-checker': `You are the Fact-Checker for this council.

RESPONSIBILITIES:
- Verify factual claims made by council members
- Flag unverified or potentially incorrect statements
- Distinguish facts from opinions
- Note areas requiring external verification

FORMAT:
For each claim, state:
- VERIFIED: [claim] - [source/reasoning]
- QUESTIONABLE: [claim] - [concern]
- OPINION: [statement] - not a factual claim`,

  'synthesizer': `You are the Synthesizer (Chairman) of this council.

RESPONSIBILITIES:
- Combine all perspectives into a coherent answer
- Represent the council's collective wisdom
- Acknowledge dissenting views appropriately
- Provide a clear, actionable final response
- Note the confidence level of the consensus

FORMAT:
Provide a comprehensive synthesis that:
1. States the council's consensus position
2. Highlights key supporting arguments
3. Acknowledges minority views if significant
4. Offers a clear recommendation or answer`,

  // ... additional roles
};
```

---

## 4. Iteration Control

### Design Principles

1. **Opt-in Iteration** - Disabled by default, enabled for complex queries
2. **Hard Limits** - Absolute maximums that cannot be exceeded
3. **Dynamic Termination** - Stop early if convergence reached
4. **Cost Awareness** - Track tokens and cost per iteration

### Iteration Configuration

```typescript
interface IterationConfig {
  // Enable iteration
  enabled: boolean;
  
  // Hard limits (snowball prevention)
  maxIterations: number;        // Max passes (default: 3, max: 5)
  maxTotalTokens: number;       // Max tokens across all iterations (default: 100K)
  maxDurationMs: number;        // Max wall-clock time (default: 120s)
  maxDepth: number;             // For hierarchical councils (default: 2)
  
  // Termination conditions
  convergenceThreshold: number; // Stop if confidence >= this (default: 0.85)
  improvementThreshold: number; // Stop if improvement < this (default: 0.05)
  
  // Iteration strategy
  strategy: IterationStrategy;
}

type IterationStrategy =
  | 'refine'      // Same council refines answer
  | 'escalate'    // Add more members each iteration
  | 'specialize'  // Route to specialist sub-councils
  | 'debate'      // Structured back-and-forth;
```

### Iteration Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        ITERATION CONTROL FLOW                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────┐                                                      │
│  │ Start Iteration │                                                      │
│  │     i = 1       │                                                      │
│  └────────┬────────┘                                                      │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────┐              │
│  │                 CHECK LIMITS                             │              │
│  │  i <= maxIterations?                                    │              │
│  │  tokens <= maxTotalTokens?                              │              │
│  │  time <= maxDurationMs?                                 │              │
│  └────────────────────────────┬────────────────────────────┘              │
│                               │                                            │
│           ┌───────────────────┴───────────────────┐                        │
│           │                                       │                        │
│        PASS                                    FAIL                        │
│           │                                       │                        │
│           ▼                                       ▼                        │
│  ┌────────────────┐                      ┌────────────────┐               │
│  │ Run Council    │                      │ Force Stop     │               │
│  │ Pipeline       │                      │ Return Best    │               │
│  └───────┬────────┘                      │ Result So Far  │               │
│          │                               └────────────────┘               │
│          ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────┐              │
│  │              CHECK CONVERGENCE                          │              │
│  │  confidence >= convergenceThreshold?                    │              │
│  │  improvement >= improvementThreshold?                   │              │
│  └────────────────────────────┬────────────────────────────┘              │
│                               │                                            │
│           ┌───────────────────┴───────────────────┐                        │
│           │                                       │                        │
│      CONVERGED                              NOT CONVERGED                  │
│           │                                       │                        │
│           ▼                                       ▼                        │
│  ┌────────────────┐                      ┌────────────────┐               │
│  │ Return Final   │                      │ Prepare Next   │               │
│  │ Answer         │                      │ Iteration      │               │
│  └────────────────┘                      │ i = i + 1      │               │
│                                          │ Update Memory  │               │
│                                          └───────┬────────┘               │
│                                                  │                         │
│                                                  └────────────► Loop       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Iteration State

```typescript
interface IterationState {
  currentIteration: number;
  totalIterations: number;
  tokensSoFar: number;
  elapsedMs: number;
  confidenceHistory: number[];
  improvements: number[];
  decisions: IterationDecision[];
}

interface IterationDecision {
  iteration: number;
  action: 'continue' | 'stop' | 'escalate';
  reason: string;
  confidence: number;
  tokensUsed: number;
}
```

---

## 5. Memory & Context Sharing

### Memory Types

```typescript
interface CouncilMemory {
  // Short-term: Current session
  shortTerm: {
    question: string;
    previousResponses: Response[];
    currentConfidence: number;
    keyInsights: string[];
  };
  
  // Working: Cross-iteration context
  working: {
    consensusPoints: string[];
    disagreements: string[];
    openQuestions: string[];
    refinements: Refinement[];
  };
  
  // Long-term: Persistent knowledge (optional)
  longTerm?: {
    userPreferences?: Record<string, unknown>;
    domainContext?: string;
    previousSessions?: SessionSummary[];
  };
}
```

### Context Injection

Each iteration receives compressed context from previous iterations:

```typescript
interface IterationContext {
  iteration: number;
  previousSummary: string;        // Compressed summary of previous work
  keyDecisions: string[];         // Important decisions made
  openIssues: string[];           // Unresolved issues to address
  confidenceTrend: number[];      // Confidence over iterations
  instructions: string;           // Specific focus for this iteration
}

function buildIterationPrompt(context: IterationContext): string {
  return `## Iteration ${context.iteration} Context

### Previous Work Summary
${context.previousSummary}

### Key Decisions Made
${context.keyDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

### Open Issues to Address
${context.openIssues.map((i, idx) => `- ${i}`).join('\n')}

### Confidence Trend
${context.confidenceTrend.join(' → ')}

### Focus for This Iteration
${context.instructions}

---
Please build upon the previous work and address the open issues.`;
}
```

### Memory Compression

To prevent context explosion, compress memory between iterations:

```typescript
interface MemoryCompressor {
  compress(memory: CouncilMemory): CompressedMemory;
  summarize(responses: Response[]): string;
  extractKeyPoints(text: string, maxPoints: number): string[];
}

class LLMMemoryCompressor implements MemoryCompressor {
  async compress(memory: CouncilMemory): Promise<CompressedMemory> {
    const prompt = `Summarize the following council deliberation in 3-5 bullet points, focusing on:
1. Main consensus points
2. Key disagreements
3. Unresolved questions

Deliberation:
${JSON.stringify(memory.shortTerm.previousResponses)}`;

    const summary = await this.llm.complete(prompt);
    return { summary, tokenCount: countTokens(summary) };
  }
}
```

---

## 6. Configuration Schema

### Complete JSON Schema for Council Configuration

```typescript
const COUNCIL_CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    // Meta information
    meta: {
      type: 'object',
      properties: {
        planningMode: { enum: ['static', 'llm', 'hybrid'] },
        complexity: { enum: ['simple', 'moderate', 'complex', 'expert'] },
        domain: { type: 'string' },
        reasoning: { type: 'string' },
      },
    },
    
    // Council composition
    council: {
      type: 'object',
      properties: {
        size: { type: 'number', minimum: 3, maximum: 9 },
        members: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              role: { type: 'string' },
              persona: { type: 'string' },
              systemPrompt: { type: 'string' },
              temperature: { type: 'number', minimum: 0, maximum: 2 },
              weight: { type: 'number', minimum: 0, maximum: 2 },
            },
            required: ['model', 'role'],
          },
        },
        voting: {
          type: 'object',
          properties: {
            method: { type: 'string' },
            threshold: { type: 'number' },
          },
        },
      },
      required: ['size', 'members'],
    },
    
    // Iteration settings
    iteration: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        maxIterations: { type: 'number', minimum: 1, maximum: 5 },
        maxTokens: { type: 'number' },
        maxDurationMs: { type: 'number' },
        convergenceThreshold: { type: 'number' },
        strategy: { enum: ['refine', 'escalate', 'specialize', 'debate'] },
      },
    },
    
    // Memory settings
    memory: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        compression: { type: 'boolean' },
        maxContextTokens: { type: 'number' },
      },
    },
  },
  required: ['council'],
};
```

### Example Configurations

#### Simple Query
```json
{
  "meta": {
    "planningMode": "static",
    "complexity": "simple"
  },
  "council": {
    "size": 3,
    "members": [
      { "model": "gpt-5-mini", "role": "opinion-giver" },
      { "model": "gpt-5-mini", "role": "reviewer" },
      { "model": "gpt-5", "role": "synthesizer" }
    ],
    "voting": { "method": "majority" }
  },
  "iteration": { "enabled": false }
}
```

#### Complex Reasoning
```json
{
  "meta": {
    "planningMode": "llm",
    "complexity": "expert",
    "domain": "technical",
    "reasoning": "Multi-faceted technical problem requiring deep analysis"
  },
  "council": {
    "size": 7,
    "members": [
      { "model": "o3", "role": "opinion-giver", "persona": "Deep Reasoner", "weight": 1.3 },
      { "model": "o4-mini", "role": "opinion-giver", "persona": "Quick Analyst" },
      { "model": "gpt-5", "role": "opinion-giver", "persona": "Generalist" },
      { "model": "gpt-5", "role": "devil-advocate", "persona": "Skeptic", "temperature": 0.5 },
      { "model": "gpt-5-mini", "role": "fact-checker" },
      { "model": "gpt-4.1", "role": "reviewer", "persona": "Context Expert" },
      { "model": "gpt-5", "role": "synthesizer" }
    ],
    "voting": { "method": "weighted", "threshold": 0.7 }
  },
  "iteration": {
    "enabled": true,
    "maxIterations": 3,
    "maxTokens": 150000,
    "maxDurationMs": 180000,
    "convergenceThreshold": 0.85,
    "strategy": "refine"
  },
  "memory": {
    "enabled": true,
    "compression": true,
    "maxContextTokens": 8000
  }
}
```

---

## 7. Implementation Details

### New Core Types

See [types.ts changes](#types-changes) below.

### Meta-Council Implementation

```typescript
class MetaCouncil {
  constructor(
    private mode: 'static' | 'llm' | 'hybrid',
    private llmAdapter?: ModelAdapter
  ) {}

  async plan(question: string): Promise<CouncilConfig> {
    switch (this.mode) {
      case 'static':
        return this.staticPlan(question);
      case 'llm':
        return this.llmPlan(question);
      case 'hybrid':
        const staticConfig = this.staticPlan(question);
        if (staticConfig.meta?.complexity === 'complex') {
          return this.llmPlan(question);
        }
        return staticConfig;
    }
  }

  private staticPlan(question: string): CouncilConfig {
    // Apply static rules
    for (const rule of STATIC_RULES.keywords) {
      if (rule.pattern.test(question)) {
        return this.configFromPreset(rule.preset, rule.allowIterations);
      }
    }
    return this.configFromPreset('standard', false);
  }

  private async llmPlan(question: string): Promise<CouncilConfig> {
    const response = await this.llmAdapter!.complete([
      { role: 'system', content: META_COUNCIL_PROMPT },
      { role: 'user', content: `Question to analyze:\n\n${question}` },
    ], {
      responseFormat: { type: 'json_schema', schema: META_COUNCIL_SCHEMA },
    });

    return JSON.parse(response.content);
  }
}
```

### Iteration Controller

```typescript
class IterationController {
  private state: IterationState;
  private limits: IterationConfig;
  private memory: CouncilMemory;

  constructor(config: IterationConfig) {
    this.limits = config;
    this.state = {
      currentIteration: 0,
      totalIterations: 0,
      tokensSoFar: 0,
      elapsedMs: 0,
      confidenceHistory: [],
      improvements: [],
      decisions: [],
    };
    this.memory = { shortTerm: {}, working: {} };
  }

  shouldContinue(): { continue: boolean; reason: string } {
    // Check hard limits
    if (this.state.currentIteration >= this.limits.maxIterations) {
      return { continue: false, reason: 'Max iterations reached' };
    }
    if (this.state.tokensSoFar >= this.limits.maxTotalTokens) {
      return { continue: false, reason: 'Token limit reached' };
    }
    if (this.state.elapsedMs >= this.limits.maxDurationMs) {
      return { continue: false, reason: 'Time limit reached' };
    }

    // Check convergence
    const lastConfidence = this.state.confidenceHistory.at(-1) ?? 0;
    if (lastConfidence >= this.limits.convergenceThreshold) {
      return { continue: false, reason: 'Convergence reached' };
    }

    // Check improvement
    if (this.state.improvements.length > 0) {
      const lastImprovement = this.state.improvements.at(-1) ?? 0;
      if (lastImprovement < this.limits.improvementThreshold) {
        return { continue: false, reason: 'Insufficient improvement' };
      }
    }

    return { continue: true, reason: 'Continue iteration' };
  }

  recordIteration(result: StageResult): void {
    const confidence = result.votingResult?.confidenceAvg ?? 0;
    const prevConfidence = this.state.confidenceHistory.at(-1) ?? 0;
    const improvement = confidence - prevConfidence;

    this.state.currentIteration++;
    this.state.totalIterations++;
    this.state.confidenceHistory.push(confidence);
    this.state.improvements.push(improvement);

    // Update memory
    this.memory.working.consensusPoints.push(result.votingResult?.winner ?? '');
  }

  getContext(): IterationContext {
    return {
      iteration: this.state.currentIteration + 1,
      previousSummary: this.compressPreviousWork(),
      keyDecisions: this.memory.working.consensusPoints,
      openIssues: this.memory.working.openQuestions,
      confidenceTrend: this.state.confidenceHistory,
      instructions: this.generateInstructions(),
    };
  }
}
```

---

## Summary

This design enables:

1. **Intelligent Council Planning** - Static rules for simple cases, LLM for complex
2. **Dynamic Composition** - Any model combination with custom personas
3. **Safe Iteration** - Hard limits prevent runaway processing
4. **Context Continuity** - Memory shared across iterations
5. **Professional Prompts** - Well-engineered role templates
6. **JSON Configuration** - Deterministic, schema-validated configs

Next: Implement these changes in the codebase.

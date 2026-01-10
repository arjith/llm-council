# Council Iteration Patterns

> **Purpose:** Guide to different council deliberation methods and iteration patterns  
> **Last Updated:** January 10, 2026

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Standard Pattern](#2-standard-pattern)
- [3. Oxford Debate](#3-oxford-debate)
- [4. Delphi Method](#4-delphi-method)
- [5. Socratic Dialogue](#5-socratic-dialogue)
- [6. Brainstorming](#6-brainstorming)
- [7. Devil's Advocate](#7-devils-advocate)
- [8. Trade-off Analysis](#8-trade-off-analysis)
- [9. Implementation Guide](#9-implementation-guide)

---

## 1. Overview

The LLM Council framework supports multiple deliberation patterns, each suited to different types of questions and decision-making scenarios.

### Pattern Selection Matrix

| Pattern | Best For | Council Size | Iterations |
|---------|----------|--------------|------------|
| Standard | General questions | 3-5 | 1 |
| Oxford Debate | Binary decisions | 4-6 | 2-3 |
| Delphi Method | Forecasting, estimates | 5-7 | 3-4 |
| Socratic Dialogue | Deep exploration | 3-4 | 2-4 |
| Brainstorming | Creative ideation | 4-6 | 3 |
| Devil's Advocate | Risk assessment | 4-5 | 2 |
| Trade-off Analysis | Technology choices | 5-7 | 2 |

---

## 2. Standard Pattern

### Description
The default 3-stage pipeline: Opinions → Review → Synthesis

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Stage 1: OPINIONS                                        │
│ All council members respond independently in parallel    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 2: REVIEW                                          │
│ Members evaluate and rank anonymized responses           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 3: SYNTHESIS                                       │
│ Chairman combines viewpoints based on votes              │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- General knowledge questions
- Straightforward queries
- Time-sensitive responses
- Cost-conscious scenarios

### Configuration
```typescript
{
  pattern: 'standard',
  stages: ['opinions', 'review', 'synthesis'],
  iterations: 1,
  votingMethod: 'confidence'
}
```

---

## 3. Oxford Debate

### Description
Structured debate format with FOR and AGAINST positions, followed by cross-examination and final arguments.

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Stage 1: OPENING STATEMENTS                              │
│ FOR team presents position                               │
│ AGAINST team presents position                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 2: CROSS-EXAMINATION                               │
│ Teams challenge each other's arguments                   │
│ Questions and rebuttals exchanged                        │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 3: CLOSING STATEMENTS                              │
│ Each side summarizes strongest arguments                 │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 4: JUDGMENT                                        │
│ Neutral arbiter evaluates arguments                      │
│ Determines winner with reasoning                         │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- "Should we X or Y?" questions
- Policy decisions
- Pros and cons analysis
- Contentious topics

### Council Composition
```yaml
council:
  name: "Oxford Debate"
  members:
    - role: for-advocate
      name: "Proponent"
      systemPrompt: "Argue strongly FOR the proposition..."
    - role: for-advocate
      name: "Supporting Proponent"
      systemPrompt: "Support and expand the FOR position..."
    - role: against-advocate
      name: "Opponent"
      systemPrompt: "Argue strongly AGAINST the proposition..."
    - role: against-advocate
      name: "Supporting Opponent"
      systemPrompt: "Support and expand the AGAINST position..."
    - role: arbiter
      name: "Judge"
      systemPrompt: "Evaluate arguments objectively..."
```

### Example Prompts

**Opening (FOR):**
```
You are debating FOR the proposition: "{question}"

Present your strongest opening argument in favor. Include:
- Your main thesis
- 3-5 supporting points with evidence
- Anticipated counterarguments and preemptive rebuttals

Be persuasive but intellectually honest.
```

**Cross-Examination:**
```
You have heard the opposing side's arguments:
{opposing_arguments}

Identify weaknesses in their position and pose 2-3 challenging questions.
Then respond to questions posed to your side.
```

---

## 4. Delphi Method

### Description
Iterative consensus-building where experts revise estimates based on anonymized group feedback. Designed for forecasting and estimation tasks.

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Round 1: INITIAL ESTIMATES                               │
│ Each expert provides independent estimate + reasoning    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ AGGREGATION                                              │
│ Calculate median, range, IQR                             │
│ Identify outliers                                        │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Round 2: REVISION                                        │
│ Experts see anonymous summary:                           │
│ - Group median and range                                 │
│ - Reasoning from outliers                                │
│ Revise estimate or justify position                      │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Round 3+ : CONVERGENCE (repeat until stable)             │
│ Continue until:                                          │
│ - Estimates converge (IQR shrinks)                       │
│ - Maximum rounds reached                                 │
│ - No further revisions                                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ FINAL: CONSENSUS ESTIMATE                                │
│ Report final median with confidence interval             │
│ Document dissenting positions                            │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- Probability estimates
- Timeline forecasting
- Resource estimation
- Risk assessment
- Future predictions

### Configuration
```typescript
{
  pattern: 'delphi',
  maxRounds: 4,
  convergenceThreshold: 0.1, // Stop when IQR < 10% of median
  requireJustification: true,
  anonymize: true
}
```

### Example Prompts

**Round 1:**
```
As an expert, provide your estimate for: "{question}"

Give:
1. Your estimate (numeric if applicable)
2. Confidence level (1-10)
3. Key factors influencing your estimate
4. Potential sources of uncertainty
```

**Round 2+:**
```
Group Summary from Round {n-1}:
- Median estimate: {median}
- Range: {min} to {max}
- Interquartile range: {iqr}

High estimate rationale: "{high_reasoning}"
Low estimate rationale: "{low_reasoning}"

Based on this feedback, would you like to:
A) Revise your estimate (provide new value and reasoning)
B) Maintain your position (explain why)
```

---

## 5. Socratic Dialogue

### Description
Question-driven exploration where one model asks probing questions to guide another toward deeper understanding or expose assumptions.

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Stage 1: INITIAL RESPONSE                                │
│ Responder provides initial answer to question            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 2: QUESTIONING                                     │
│ Questioner probes with clarifying questions:             │
│ - "What do you mean by...?"                              │
│ - "How does that follow from...?"                        │
│ - "What assumptions are you making?"                     │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 3: ELABORATION                                     │
│ Responder addresses questions, refines answer            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 4: DEEPER QUESTIONING (repeat 2-3 times)           │
│ More fundamental questions about reasoning               │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 5: SYNTHESIS                                       │
│ Summarize insights gained through dialogue               │
│ Identify refined understanding                           │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- Exploring complex concepts
- Uncovering hidden assumptions
- Educational explanations
- Philosophical questions
- Clarifying ambiguous requirements

### Question Types

| Type | Purpose | Example |
|------|---------|---------|
| Clarification | Define terms | "What do you mean by 'efficient'?" |
| Assumption | Expose hidden beliefs | "What are you assuming about the user?" |
| Evidence | Support claims | "What evidence supports this?" |
| Implication | Explore consequences | "If that's true, what follows?" |
| Perspective | Alternative views | "How would a critic respond?" |
| Meta | About reasoning | "Why do you think that's the right approach?" |

---

## 6. Brainstorming

### Description
Three-phase creative ideation: Diverge (generate many ideas) → Build (expand on ideas) → Converge (select best ideas).

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Phase 1: DIVERGE                                         │
│ Generate as many ideas as possible                       │
│ No criticism, quantity over quality                      │
│ Wild ideas encouraged                                    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Phase 2: BUILD                                           │
│ Expand on promising ideas                                │
│ Combine ideas ("Yes, and...")                            │
│ Add variations and improvements                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Phase 3: CONVERGE                                        │
│ Evaluate ideas against criteria                          │
│ Vote on top candidates                                   │
│ Select and refine winning ideas                          │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- Creative problem-solving
- Feature ideation
- Naming exercises
- Strategy development
- Innovation challenges

### Rules for Divergence
1. **Defer judgment** — No criticism during ideation
2. **Go for quantity** — More ideas = better odds
3. **Encourage wild ideas** — Unrealistic can inspire realistic
4. **Build on others** — "Yes, and..." mindset

### Configuration
```typescript
{
  pattern: 'brainstorm',
  phases: ['diverge', 'build', 'converge'],
  divergeTarget: 20, // Minimum ideas before building
  evaluationCriteria: ['feasibility', 'impact', 'novelty']
}
```

---

## 7. Devil's Advocate

### Description
One member actively challenges the emerging consensus to stress-test ideas and prevent groupthink.

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Stage 1: INITIAL CONSENSUS                               │
│ Council reaches preliminary agreement                    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 2: DEVIL'S ADVOCATE CHALLENGE                      │
│ Designated challenger:                                   │
│ - Attacks weakest points                                 │
│ - Presents alternative hypotheses                        │
│ - Identifies overlooked risks                            │
│ - Questions evidence quality                             │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 3: DEFENSE                                         │
│ Council defends position against challenges              │
│ Addresses criticisms directly                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 4: REVISION                                        │
│ Incorporate valid criticisms                             │
│ Strengthen weak points                                   │
│ Document remaining risks                                 │
└──────────────────────────────────────────────────────────┘
```

### When to Use
- High-stakes decisions
- Risk assessment
- Security reviews
- Avoiding confirmation bias
- Challenging assumptions

### Activation Triggers
```typescript
{
  pattern: 'devil_advocate',
  activationConditions: {
    lowConfidence: 0.6, // Activate when consensus < 60%
    highStakes: true,   // Always for critical decisions
    onRequest: true     // User can request
  }
}
```

---

## 8. Trade-off Analysis

### Description
Systematic evaluation of options against weighted criteria, commonly used for technology choices and comparisons.

### Flow
```
┌──────────────────────────────────────────────────────────┐
│ Stage 1: CRITERIA DEFINITION                             │
│ Identify evaluation criteria                             │
│ Assign weights to each criterion                         │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 2: OPTION ANALYSIS                                 │
│ Each council member evaluates options                    │
│ Score each option against each criterion (1-10)          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 3: AGGREGATION                                     │
│ Calculate weighted scores                                │
│ Identify areas of agreement/disagreement                 │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 4: RECOMMENDATION                                  │
│ Present ranked options with scores                       │
│ Highlight key trade-offs                                 │
│ Provide conditional recommendations                      │
└──────────────────────────────────────────────────────────┘
```

### Output Format
```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADE-OFF ANALYSIS                           │
├─────────────────────────────────────────────────────────────────┤
│ Question: "React vs Vue vs Svelte for new project?"             │
│                                                                 │
│ Criteria (weighted):                                            │
│   Performance (25%) | Learning Curve (20%) | Ecosystem (30%)    │
│   Hiring Pool (15%) | Future-proof (10%)                        │
│                                                                 │
│ ┌──────────┬──────┬──────┬──────┬──────┬──────┬─────────┐      │
│ │ Option   │ Perf │ Learn│ Eco  │ Hire │ Future│ TOTAL  │      │
│ ├──────────┼──────┼──────┼──────┼──────┼──────┼─────────┤      │
│ │ React    │  7   │  6   │  9   │  9   │  8   │  7.85  │      │
│ │ Vue      │  8   │  8   │  7   │  6   │  7   │  7.25  │      │
│ │ Svelte   │  9   │  7   │  5   │  4   │  6   │  6.25  │      │
│ └──────────┴──────┴──────┴──────┴──────┴──────┴─────────┘      │
│                                                                 │
│ Recommendation: React (7.85)                                    │
│ Key Trade-off: Svelte has best performance but smaller ecosystem│
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Guide

### Adding a New Pattern

1. **Define the pattern in types:**
```typescript
// packages/core/src/types.ts
export type CouncilPattern = 
  | 'standard'
  | 'oxford-debate'
  | 'delphi'
  | 'socratic'
  | 'brainstorm'
  | 'devil-advocate'
  | 'tradeoff';
```

2. **Create pattern handler:**
```typescript
// packages/core/src/patterns/delphi.ts
export class DelphiPattern implements CouncilPattern {
  async execute(config: DelphiConfig): Promise<CouncilResult> {
    let round = 1;
    let estimates: Estimate[] = [];
    
    while (round <= config.maxRounds && !this.hasConverged(estimates)) {
      estimates = await this.collectEstimates(round, estimates);
      round++;
    }
    
    return this.synthesize(estimates);
  }
}
```

3. **Add to pipeline:**
```typescript
// packages/core/src/pipeline.ts
export function createPipeline(pattern: CouncilPattern) {
  switch (pattern) {
    case 'delphi':
      return new DelphiPattern();
    case 'oxford-debate':
      return new OxfordDebatePattern();
    // ...
  }
}
```

### Configuration Options

```typescript
interface PatternConfig {
  pattern: CouncilPattern;
  maxIterations?: number;
  convergenceThreshold?: number;
  votingMethod?: VotingMethod;
  roles?: RoleAssignment[];
  customPrompts?: Record<string, string>;
}
```

---

## Summary

| Pattern | Iterations | Best For | Complexity |
|---------|------------|----------|------------|
| Standard | 1 | Quick answers | Low |
| Oxford Debate | 2-3 | Binary decisions | Medium |
| Delphi | 3-4 | Forecasting | High |
| Socratic | 2-4 | Deep exploration | Medium |
| Brainstorm | 3 | Creative ideas | Medium |
| Devil's Advocate | 2 | Risk assessment | Medium |
| Trade-off | 2 | Comparisons | Medium |

Choose the pattern that best matches your question type and decision requirements.

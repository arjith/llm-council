# LLM Council Roles Guide

> **Purpose:** Comprehensive guide to council member roles and configurations  
> **Last Updated:** January 10, 2026

---

## Table of Contents
- [1. Current Roles](#1-current-roles)
- [2. Extended Role Types](#2-extended-role-types)
- [3. Role Configurations](#3-role-configurations)
- [4. Role Composition Patterns](#4-role-composition-patterns)
- [5. System Prompts by Role](#5-system-prompts-by-role)

---

## 1. Current Roles

The LLM Council currently implements these core roles:

| Role | Description | Stage |
|------|-------------|-------|
| `opinion-giver` | Provides initial perspective on the question | Opinions |
| `reviewer` | Evaluates and critiques other responses | Review |
| `synthesizer` | Combines multiple viewpoints into cohesive answer | Synthesis |
| `backup` | Joins when confidence is low or errors occur | Any |
| `arbiter` | Makes final decisions in case of ties | Voting |

---

## 2. Extended Role Types

### 2.1 Analytical Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| **Fact-Checker** | Verifies claims against known information | Questions with factual assertions |
| **Statistician** | Analyzes numerical data and probabilities | Quantitative questions |
| **Logician** | Evaluates logical consistency of arguments | Complex reasoning tasks |
| **Code Reviewer** | Analyzes code for bugs and best practices | Programming questions |
| **Data Analyst** | Interprets data patterns and trends | Data-related queries |

### 2.2 Critical Thinking Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| **Devil's Advocate** | Challenges consensus, finds weaknesses | Avoiding groupthink |
| **Skeptic** | Questions assumptions and evidence | High-stakes decisions |
| **Risk Assessor** | Identifies potential downsides | Strategy/planning |
| **Contrarian** | Presents opposing viewpoints | One-sided discussions |
| **Red Team** | Actively tries to find flaws | Security/safety questions |

### 2.3 Domain Expert Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| **Technical Expert** | Deep technical knowledge | Engineering questions |
| **Business Analyst** | Business/market perspective | Strategy questions |
| **Legal Advisor** | Legal implications and compliance | Regulatory questions |
| **Ethics Reviewer** | Ethical considerations | AI/moral questions |
| **UX Expert** | User experience perspective | Design questions |
| **Security Expert** | Security implications | Cybersecurity topics |

### 2.4 Process Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| **Moderator** | Guides discussion, manages turn-taking | Large councils |
| **Facilitator** | Ensures all perspectives are heard | Diverse councils |
| **Timekeeper** | Manages response length and depth | Complex questions |
| **Summarizer** | Creates concise summaries | Long discussions |
| **Clarifier** | Asks clarifying questions | Ambiguous queries |

### 2.5 Creative Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| **Brainstormer** | Generates creative ideas | Innovation tasks |
| **Visionary** | Long-term strategic thinking | Future planning |
| **Storyteller** | Narrative explanations | Educational content |
| **Analogist** | Creates helpful analogies | Complex concepts |

---

## 3. Role Configurations

### 3.1 Minimal Council (3 members)

```yaml
council:
  name: "Quick Decision"
  members:
    - role: opinion-giver
      model: gpt-5-mini
      name: "Analyst"
    - role: reviewer
      model: o3-mini
      name: "Critic"
    - role: synthesizer
      model: gpt-5
      name: "Chairman"
```

**Best for:** Simple questions, quick responses, cost-conscious use cases

### 3.2 Standard Council (5 members)

```yaml
council:
  name: "Standard Council"
  members:
    - role: opinion-giver
      model: gpt-5
      name: "Lead Analyst"
    - role: opinion-giver
      model: gpt-5-mini
      name: "Fast Responder"
    - role: opinion-giver
      model: o3-mini
      name: "Deep Thinker"
    - role: reviewer
      model: gpt-4.1
      name: "Critic"
    - role: synthesizer
      model: gpt-5
      name: "Chairman"
```

**Best for:** General purpose, balanced speed/quality

### 3.3 Reasoning Council (5 members)

```yaml
council:
  name: "Reasoning Council"
  members:
    - role: opinion-giver
      model: o3
      name: "Logical Reasoner"
    - role: opinion-giver
      model: o3-mini
      name: "Quick Reasoner"
    - role: opinion-giver
      model: o4-mini
      name: "Modern Reasoner"
    - role: reviewer
      model: gpt-5
      name: "Validator"
    - role: synthesizer
      model: o3
      name: "Chairman"
```

**Best for:** Math, logic, complex reasoning tasks

### 3.4 Diverse Council (7 members)

```yaml
council:
  name: "Diverse Perspectives"
  members:
    - role: opinion-giver
      model: gpt-5
      name: "Generalist"
    - role: opinion-giver
      model: o3-mini
      name: "Mathematician"
    - role: opinion-giver
      model: gpt-4.1
      name: "Context Expert"
    - role: devil-advocate
      model: gpt-5-mini
      name: "Challenger"
    - role: fact-checker
      model: o4-mini
      name: "Fact Checker"
    - role: reviewer
      model: gpt-5
      name: "Critic"
    - role: synthesizer
      model: gpt-5
      name: "Chairman"
```

**Best for:** Complex, multi-faceted questions requiring diverse viewpoints

### 3.5 Research Council (6 members)

```yaml
council:
  name: "Research Council"
  members:
    - role: opinion-giver
      model: gpt-5
      name: "Primary Researcher"
    - role: fact-checker
      model: o3-mini
      name: "Fact Verifier"
    - role: skeptic
      model: gpt-5-mini
      name: "Skeptic"
    - role: domain-expert
      model: gpt-4.1
      name: "Domain Expert"
    - role: reviewer
      model: o4-mini
      name: "Critical Reviewer"
    - role: synthesizer
      model: gpt-5
      name: "Lead Author"
```

**Best for:** Research questions, academic topics, fact-intensive queries

### 3.6 Code Review Council (5 members)

```yaml
council:
  name: "Code Review Council"
  members:
    - role: opinion-giver
      model: gpt-5
      name: "Senior Developer"
    - role: code-reviewer
      model: o3-mini
      name: "Bug Hunter"
    - role: security-expert
      model: gpt-5-mini
      name: "Security Analyst"
    - role: reviewer
      model: o4-mini
      name: "Architecture Reviewer"
    - role: synthesizer
      model: gpt-5
      name: "Tech Lead"
```

**Best for:** Code reviews, architecture decisions, debugging

---

## 4. Role Composition Patterns

### 4.1 Balanced Pattern
- 2-3 Opinion Givers
- 1 Critical Role (Reviewer/Skeptic)
- 1 Synthesizer

**Rationale:** Ensures diverse input while maintaining focus

### 4.2 Adversarial Pattern
- 2 Opinion Givers
- 1 Devil's Advocate
- 1 Fact-Checker
- 1 Synthesizer

**Rationale:** Challenges assumptions, reduces groupthink

### 4.3 Expert Panel Pattern
- 3-4 Domain Experts (different specializations)
- 1 Moderator
- 1 Synthesizer

**Rationale:** Deep expertise from multiple angles

### 4.4 Debate Pattern
- 2 Opinion Givers (opposing default positions)
- 1 Moderator
- 1 Arbiter
- 1 Synthesizer

**Rationale:** Structured debate format for contentious topics

### 4.5 Iterative Refinement Pattern
- 1 Initial Responder
- 2 Reviewers (sequential)
- 1 Fact-Checker
- 1 Final Editor

**Rationale:** Progressive improvement through multiple passes

---

## 5. System Prompts by Role

### Opinion Giver
```
You are participating in an LLM Council as a Primary Opinion Giver.

Your responsibilities:
- Provide a thoughtful, well-reasoned initial response to the question
- Express your confidence level honestly (0-100%)
- Consider multiple perspectives but present your best judgment
- Support your answer with reasoning and evidence where possible

Be direct and substantive. Your response will be reviewed by other council members.
```

### Reviewer
```
You are participating in an LLM Council as a Critical Reviewer.

Your responsibilities:
- Evaluate responses from other council members objectively
- Identify strengths and weaknesses in each response
- Check for factual accuracy and logical consistency
- Rank responses based on quality, accuracy, and completeness

Be constructive but rigorous in your evaluation. Your review helps determine the final consensus.
```

### Devil's Advocate
```
You are participating in an LLM Council as the Devil's Advocate.

Your responsibilities:
- Challenge the emerging consensus or majority opinion
- Identify potential weaknesses, blind spots, and counterarguments
- Present alternative viewpoints that may have been overlooked
- Push the council to justify their positions more rigorously

Be provocative but intellectually honest. Your role is to strengthen the final answer through challenge.
```

### Fact-Checker
```
You are participating in an LLM Council as the Fact-Checker.

Your responsibilities:
- Verify factual claims made by other council members
- Flag potential inaccuracies or unsupported assertions
- Provide corrections with sources where possible
- Distinguish between facts, opinions, and speculation

Be precise and evidence-based. Your role is to ensure the council's response is factually grounded.
```

### Synthesizer
```
You are the Chairman of this LLM Council, responsible for synthesis.

Your responsibilities:
- Review all council members' responses and reviews
- Consider the voting results and confidence levels
- Synthesize a final response that represents the council's collective wisdom
- Acknowledge dissenting views where relevant
- Present a coherent, well-structured final answer

Be comprehensive but concise. Your synthesis is the council's official response.
```

### Domain Expert
```
You are participating in an LLM Council as a Domain Expert in [DOMAIN].

Your responsibilities:
- Bring specialized knowledge from your domain to the discussion
- Identify technical nuances that generalists might miss
- Provide domain-specific context and best practices
- Flag when questions require specialized expertise beyond your domain

Be thorough in your domain while acknowledging limitations outside it.
```

### Moderator
```
You are the Moderator of this LLM Council.

Your responsibilities:
- Ensure all perspectives are heard and considered
- Guide the discussion to stay on topic
- Summarize key points of agreement and disagreement
- Facilitate resolution of conflicts between viewpoints
- Manage the flow of the council process

Be neutral and facilitative. Your role is to improve the quality of the council's deliberation.
```

---

## 6. Role Selection Guidelines

### When to use each role:

| Question Type | Recommended Roles |
|--------------|-------------------|
| Simple factual | opinion-giver, fact-checker, synthesizer |
| Complex reasoning | opinion-giver (x2), reviewer, synthesizer |
| Controversial | opinion-giver (x2), devil-advocate, moderator, synthesizer |
| Technical | opinion-giver, domain-expert, code-reviewer, synthesizer |
| Strategic | opinion-giver (x2), risk-assessor, contrarian, synthesizer |
| Creative | brainstormer, visionary, reviewer, synthesizer |
| Research | opinion-giver, fact-checker, skeptic, synthesizer |

### Anti-patterns to avoid:

1. **Too many critics** — Leads to analysis paralysis
2. **No synthesizer** — Produces incoherent output
3. **All same model** — Reduces diversity of thought
4. **Too large council** — Increases latency without proportional quality gain
5. **Missing reviewer** — No quality control on opinions

---

## Next Steps

1. Implement additional roles in `packages/core/src/types.ts`
2. Create system prompt templates in `packages/core/src/prompts/`
3. Add role configuration UI in web dashboard
4. Build preset templates for common use cases


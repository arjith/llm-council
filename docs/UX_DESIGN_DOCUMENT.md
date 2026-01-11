# LLM Council - UX Design Document v2.0

> **Author**: GitHub Copilot (Expert UX Design Team)  
> **Date**: Created during UI redesign sprint  
> **Status**: AWAITING APPROVAL (After 3 Design Iterations)  
> **Priority**: High

---

# 🔄 DESIGN ITERATION LOG

## Iteration 1: Critical Analysis (What's Wrong with v1.0)

### ❌ Over-Engineering Identified

| v1.0 Design Element | Problem | Severity |
|---------------------|---------|----------|
| 4-step Council Composer wizard | Too many clicks, breaks flow, intimidating | 🔴 High |
| SVG Council Chamber visualization | Complex to build, marginal value, performance concern | 🔴 High |
| WebSocket requirement for MVP | Adds backend complexity, polling works fine | 🟡 Medium |
| 10 new components | Scope creep, many not essential | 🟡 Medium |
| Dual-mode selector (Quick/Advanced) | Confusing UX, users don't know which to pick | 🟡 Medium |
| Memory sidebar | Clutter, rarely needed for most users | 🟢 Low |
| Voice input | Nice-to-have, not MVP | 🟢 Low |

### ❌ Missing Simplicity

1. **Current UI is actually good** - Glass morphism, dark theme work well
2. **Wizard pattern is outdated** - Modern UIs use inline/collapsible sections
3. **Node diagrams are gimmicky** - A simple list with avatars is clearer
4. **"Let AI Decide" is confusing** - Users should always feel in control

### ❌ Complexity vs Value Analysis

```
                    HIGH VALUE
                        │
     ┌──────────────────┼──────────────────┐
     │ Iteration        │ Live Streaming   │
     │ Tracking         │ Responses        │
     │ ✅ KEEP          │ ✅ KEEP          │
LOW  │──────────────────┼──────────────────│ HIGH
COMPLEXITY │ Config      │ SVG Council     │ COMPLEXITY
     │ Preview         │ Chamber          │
     │ ✅ KEEP          │ ❌ CUT           │
     │                  │                  │
     │ Stats Panel     │ 4-Step Wizard    │
     │ ❓ SIMPLIFY      │ ❌ CUT           │
     └──────────────────┼──────────────────┘
                        │
                    LOW VALUE
```

---

## Iteration 2: Constructive Redesign (Better Alternatives)

### ✅ Key Insight: "Debate View" is the Core Innovation

The unique value of LLM Council isn't configuration - it's **watching AI models debate**. The UI should:
1. **Minimize time to first debate** (Quick Start)
2. **Maximize debate visibility** (Conversation-style view)
3. **Surface complexity only when needed** (Progressive Disclosure)

### ✅ Simpler Alternatives

| v1.0 Element | v2.0 Alternative | Why Better |
|--------------|------------------|------------|
| 4-step wizard | Single-page with collapsible sections | Less clicks, see all at once |
| SVG chamber | Avatar row with status badges | Simpler, clearer, faster |
| WebSocket streaming | Polling with smooth transitions | Works now, upgrade later |
| Dual-mode | Smart defaults + "Customize" link | One path, optional depth |
| Memory sidebar | Inline memory pills in responses | Contextual, not distracting |

### ✅ The "Debate Transcript" Pattern

Inspired by Kialo (debate platform) and chat interfaces:

```
┌────────────────────────────────────────────────────────────┐
│  ROUND 1 • Opinions                              ⏱️ 3.2s   │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔵 GPT-5 (Opinion Giver)                     85% ⭐   │  │
│  │ "Quantum computing poses a significant threat..."    │  │
│  │ [Pro: Immediate action needed] [Con: Overstated]     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔴 o3 (Devil's Advocate)                     72% ⭐   │  │
│  │ "However, the timeline is often exaggerated..."      │  │
│  │ [Challenges: GPT-5's urgency claim]                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🟡 GPT-4.1 (Fact Checker)                    91% ⭐   │  │
│  │ "NIST post-quantum standards were finalized in..."   │  │
│  │ [Verified: Timeline claims] [Flagged: Cost estimate] │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  VOTING: Confidence → GPT-4.1 wins (91%) • Consensus: Yes │
└────────────────────────────────────────────────────────────┘
```

### ✅ Progressive Disclosure Pattern

```
LEVEL 1 (Default)          LEVEL 2 (On Click)           LEVEL 3 (Debug)
─────────────────          ──────────────────           ───────────────
┌─────────────────┐        ┌─────────────────┐          ┌─────────────────┐
│ Standard Council│ ───►   │ + Edit Members  │ ───►     │ Raw JSON Config │
│ [Ask Question]  │        │ + Voting Method │          │ Trace Events    │
└─────────────────┘        │ + Iterations    │          │ Token Breakdown │
                           └─────────────────┘          └─────────────────┘
```

---

## Iteration 3: Cumulative Synthesis (Final Design)

### 🎯 Design Philosophy (Refined)

1. **Start Simple, Reveal Power** - Most users just want to ask questions
2. **The Debate IS the Product** - Make responses the hero, not config
3. **Iterations Tell a Story** - Show confidence improving like a narrative
4. **Debug is First-Class** - Developers need deep visibility, but opt-in
5. **Keep What Works** - Glass morphism, dark theme, existing components

### 🎯 Core UX Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Config Start** | Pre-selected "Standard" preset, just type and go |
| **Inline Customization** | Click gear icon to expand config, don't leave page |
| **Debate Transcript** | Chat-style responses with role badges and confidence |
| **Iteration as Chapters** | "Round 1", "Round 2" headers with confidence trend |
| **Hover for Depth** | Token counts, latency on hover, not always visible |
| **Debug on Demand** | Tab switch, not separate page |

---

# 📋 FINAL DESIGN (v2.0)

## Executive Summary

This document proposes a **focused UI enhancement** for LLM Council that:

1. **Preserves simplicity** - Keeps existing glass morphism aesthetic
2. **Adds debate visualization** - Conversation-style response display
3. **Surfaces iteration tracking** - Round-by-round confidence progression
4. **Enables inline configuration** - No wizards, just expandable sections
5. **Integrates debug view** - Tab-based, not separate page

### What We're NOT Building (Scope Control)
- ❌ SVG node diagrams
- ❌ WebSocket streaming (polling is fine for MVP)
- ❌ Voice input
- ❌ Preset sharing
- ❌ Light mode toggle
- ❌ Mobile optimization

---

## 🎯 Design Objectives

### Primary Goals
1. **Reduce time to first council** - Under 3 clicks from landing
2. **Make debates engaging** - Conversation-style, not data tables
3. **Show iteration progress** - Confidence improving over rounds
4. **Enable power users** - Inline config without breaking flow
5. **Maintain developer trust** - Deep debug when needed

---

## 🏗️ Information Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM Council                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │       HOME           │    │         SESSION              │  │
│  │   (with inline       │───►│   [Debate] [Debug] tabs      │  │
│  │    customization)    │    │                              │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
│           │                              │                      │
│           ▼                              ▼                      │
│  • Question Input              • Debate Transcript View        │
│  • Preset Pills (hover=details)• Iteration Round Headers       │
│  • [⚙️] Expand Config          • Member Response Cards         │
│  • Recent Sessions             • Confidence Trend Line         │
│                                • [Debug] Tab: Timeline         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

KEY SIMPLIFICATION: Only 2 pages (Home, Session) - Debug is a TAB, not a page
```

---

## 📱 Page Designs (v2.0 - Simplified)

### 1. Home Page (Refined - Not Redesigned)

> **Philosophy**: Keep what works. Enhance, don't replace.

#### What Stays the Same ✅
- Glass morphism cards
- Dark theme gradient background
- Preset selection buttons
- Recent sessions list
- Feature cards at bottom

#### What Changes 🔄

**A. Preset Pills with Hover Details**
```
┌──────────────────────────────────────────────────────────────┐
│  Council Preset                                              │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Small   │ │ Standard │ │Reasoning │ │ Diverse  │       │
│  │  ⚡ 3    │ │  👥 5    │ │  🧠 5    │ │  🌈 7    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│       │                                                      │
│       ▼ (on hover)                                          │
│  ┌─────────────────────────────────────┐                    │
│  │ Small Council                       │                    │
│  │ ─────────────────────────────────── │                    │
│  │ • GPT-5 (Opinion Giver)            │                    │
│  │ • o3-mini (Reviewer)               │                    │
│  │ • GPT-5-mini (Synthesizer)         │                    │
│  │ ─────────────────────────────────── │                    │
│  │ Voting: Majority • Fast responses   │                    │
│  └─────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

**B. Inline Configuration (Collapsible)**
```
┌──────────────────────────────────────────────────────────────┐
│  Ask the Council                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ What are the ethical implications of AI in healthcare? │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Standard ▼]  [⚙️ Customize]  [🚀 Ask Council]             │
│                     │                                        │
│                     ▼ (when clicked - INLINE, not new page)  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚙️ Advanced Configuration                        [×]   │ │
│  │ ───────────────────────────────────────────────────── │ │
│  │                                                        │ │
│  │ 👥 Members        🗳️ Voting         🔄 Iterations     │ │
│  │ ─────────────     ────────────      ──────────────    │ │
│  │ [+ Add Member]    ○ Majority        [ ] Enable        │ │
│  │                   ● Confidence      Max: [3]          │ │
│  │ GPT-5 (Opinion)   ○ Weighted        Strategy: [Refine]│ │
│  │ o3 (Devil's Adv)  ○ Consensus                         │ │
│  │ GPT-4.1 (Fact)                                        │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**C. Enhanced Recent Sessions**
```
┌──────────────────────────────────────────────────────────────┐
│  Recent Sessions                                             │
│  ────────────────────────────────────────────────────────── │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🟢 "What are the ethical implications of AI..."        │ │
│  │                                                        │ │
│  │ ┌────────┐  92% confident  •  5 members  •  2 rounds  │ │
│  │ │▓▓▓▓▓▓▓▓│  ↑ from 71%     •  12.3s     •  2min ago   │ │
│  │ └────────┘                                             │ │
│  │                                                        │ │
│  │ Final: "AI in healthcare raises important questions..." │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🟡 "Should autonomous vehicles prioritize..."          │ │
│  │ 68% confident  •  7 members  •  3 rounds  •  15min ago │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**KEY INSIGHT**: No separate "Council Composer" page needed. Inline expansion is sufficient.

---

### 2. Session Page (The Hero - Debate Transcript View)

> **Route**: `/session/:id`
> **Philosophy**: The debate IS the product. Make it engaging to watch.

```
┌─────────────────────────────────────────────────────────────────┐
│  🏛️ LLM Council                      [← Home] [📥 Export]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📝 "What are the ethical implications of AI in           │ │
│  │      healthcare decision-making?"                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐                               │
│  │ 💬 Debate   │ │ 🔍 Debug    │   92% confident • 12.3s      │
│  └─────────────┘ └─────────────┘   ████████████░░ 2 rounds    │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🏆 FINAL ANSWER                                          │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  AI in healthcare raises important ethical questions      │ │
│  │  around autonomy, accountability, and equity. While AI    │ │
│  │  can improve diagnostic accuracy, the council reached     │ │
│  │  consensus that human oversight remains essential...      │ │
│  │                                                           │ │
│  │  [Show full answer ▼]                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  ROUND 2 • Final Refinement                    92% → ↑ +21%   │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🔵 GPT-5 (Opinion Giver)                          89%   │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  "Building on the previous round's discussion, I'd like  │ │
│  │  to emphasize that the core tension is between           │ │
│  │  efficiency gains and the preservation of human agency..."│ │
│  │                                                           │ │
│  │  💡 Key point: "Human oversight essential"               │ │
│  │  ⚖️ Agrees with: o3, GPT-4.1  •  Challenges: none        │ │
│  │                                            [Show more ▼] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🔴 o3 (Devil's Advocate)                          85%   │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  "I previously challenged the urgency, but after review  │ │
│  │  I concede that the evidence supports more immediate     │ │
│  │  regulatory frameworks, particularly in diagnostic AI..."│ │
│  │                                                           │ │
│  │  🔄 Changed position from Round 1                        │ │
│  │  ⚖️ Now agrees with: GPT-5, GPT-4.1                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────── VOTING RESULT ─────────────────────────────┐ │
│  │  Method: Confidence  •  Consensus: ✅ Yes                 │ │
│  │  Winner: "Human oversight essential" (92% avg confidence) │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  ROUND 1 • Initial Opinions                    71%    [▼]     │
│  ═══════════════════════════════════════════════════════════   │
│  (Collapsed - click to expand)                                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  👥 Council: GPT-5, o3, GPT-4.1, o3-mini, GPT-5-mini          │
│  ⏱️ 12.3s total  •  📊 4,521 tokens  •  🔄 2 rounds           │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features (v2.0)

**A. Tab-Based Navigation (Debate vs Debug)**
- Default: Debate view (user-friendly)
- Debug: Same data, different presentation
- No separate page/route

**B. Confidence Trend Line**
- Shows improvement across rounds
- "↑ +21%" style delta indicators
- Visual progress bar

**C. Debate Transcript Cards**
- Color-coded role badges
- Confidence score prominent
- Key points extracted
- Agreement/disagreement indicators
- "Changed position" flags

**D. Collapsible Rounds**
- Most recent round expanded
- Previous rounds collapsed by default
- Confidence shown even when collapsed

**E. Council Footer**
- Member list (simple, no avatars)
- Duration, tokens, rounds summary
- Export button

---

### 3. Debug Tab (Within Session Page)

> **Not a separate page** - A tab within the Session view
> Accessed via [🔍 Debug] tab on session page

```
┌─────────────────────────────────────────────────────────────────┐
│  🏛️ LLM Council                      [← Home] [📥 Export]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 "What are the ethical implications of AI..."               │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐                               │
│  │ 💬 Debate   │ │ 🔍 Debug    │ ◄── ACTIVE TAB               │
│  └─────────────┘ └─────────────┘                               │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  Filter: [All ▼]  [✓] Requests  [✓] Responses  [ ] Voting     │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│  ROUND 1                                            71% final  │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  +0.00s   🟢 session-start                                     │
│           └─ config: standard preset, 5 members                │
│                                                                 │
│  +0.02s   📋 stage-start → opinions                            │
│           └─ parallel: true                                     │
│                                                                 │
│  +0.05s   ├─ 📤 GPT-5 request (245 tokens)                     │
│           ├─ 📤 o3 request (245 tokens)                        │
│           ├─ 📤 GPT-4.1 request (245 tokens)                   │
│           ├─ 📤 o3-mini request (245 tokens)                   │
│           └─ 📤 GPT-5-mini request (245 tokens)                │
│                                                                 │
│  +2.34s   📥 o3-mini response ⚡ 2.29s                         │
│           └─ 312 tokens, confidence: 82%  [▶ Expand]           │
│                                                                 │
│  +3.12s   📥 GPT-5-mini response • 3.07s                       │
│  +4.56s   📥 GPT-4.1 response • 4.51s                          │
│  +5.23s   📥 GPT-5 response • 5.18s                            │
│  +6.78s   📥 o3 response • 6.73s                               │
│                                                                 │
│  +6.80s   ✓ stage-end → opinions (6.78s total)                 │
│                                                                 │
│  +6.82s   📋 stage-start → voting                              │
│           └─ method: confidence                                 │
│                                                                 │
│  +7.45s   🗳️ GPT-5 voted Position A (85%)                     │
│  +7.52s   🗳️ o3 voted Position B (72%)                        │
│  +7.58s   🗳️ GPT-4.1 voted Position A (91%)                   │
│  +7.63s   🗳️ o3-mini voted Position A (82%)                   │
│  +7.69s   🗳️ GPT-5-mini voted Position A (78%)                │
│                                                                 │
│  +7.71s   🏁 voting-complete                                   │
│           └─ winner: Position A, consensus: yes, avg: 71%      │
│                                                                 │
│  +7.73s   ⚠️ iteration-triggered                               │
│           └─ reason: confidence 71% < threshold 85%            │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│  ROUND 2                                            92% final  │
│  ───────────────────────────────────────────────────────────── │
│  ... (similar structure)                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Debug Tab Features (v2.0 - Simplified)

**A. Same Data, Different View**
- Uses existing `/api/council/:id/traces` endpoint
- No new API needed
- Just reorganized presentation

**B. Inline Filters**
- Simple checkboxes
- No separate "view modes"
- Instant filtering

**C. Round Grouping**
- Events grouped by iteration round
- Final confidence shown per round
- Collapsible rounds

**D. Expandable Responses**
- Collapsed by default
- Click to see full response content
- Copy button for debugging

**REMOVED from v1.0:**
- ❌ Iteration Flow Mode (too complex)
- ❌ Member Focus Mode (niche use case)
- ❌ Separate debug route (unnecessary navigation)

---

## 🎨 Design System (v2.0 - Streamlined)

### Color Palette (Keep Existing)

```css
/* Primary - NO CHANGES */
--council-primary: #6366f1;     /* Indigo - main brand */
--council-secondary: #8b5cf6;   /* Purple - accent */

/* Status - NO CHANGES */
--council-success: #22c55e;     /* Green - completed/high confidence */
--council-warning: #eab308;     /* Yellow - in-progress/medium */
--council-error: #ef4444;       /* Red - failed/low confidence */

/* NEW: Role Colors (minimal additions) */
--role-blue: #60a5fa;           /* Opinion giver */
--role-red: #f87171;            /* Devil's advocate */
--role-amber: #fbbf24;          /* Fact checker */
--role-emerald: #34d399;        /* Synthesizer */
--role-purple: #a78bfa;         /* Reviewer */
```

### Typography (NO CHANGES)

Existing font system is fine - keep Inter + JetBrains Mono.

### Components (v2.0 - Reduced from 10 to 5)

| Component | Purpose | Complexity |
|-----------|---------|------------|
| **DebateCard** | Member response in transcript view | Medium |
| **RoundHeader** | Iteration separator with confidence | Low |
| **ConfidenceBadge** | Inline confidence % indicator | Low |
| **InlineConfig** | Collapsible config panel | Medium |
| **TimelineEvent** | Debug timeline row | Low |

**REMOVED from v1.0:**
- ❌ MemberCard (drag-and-drop) - Just use list
- ❌ RoleSelector (custom) - Use native select
- ❌ VotingMethodPicker (radio cards) - Use radio buttons
- ❌ CouncilChamber (SVG) - Cut entirely
- ❌ IterationSidebar - Use inline pills instead

---

## 🔌 API Requirements (v2.0 - Simplified)

### NO New Endpoints Needed! 

The existing API already supports everything we need:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/council/presets` | Get preset configurations | ✅ Exists |
| `GET /api/council/presets/:id` | Get specific preset | ✅ Exists |
| `POST /api/council/run` | Run council session | ✅ Exists |
| `POST /api/council/run-dynamic` | Run with iterations | ✅ Exists |
| `GET /api/council/:id/result` | Get session result | ✅ Exists |
| `GET /api/council/:id/traces` | Get debug traces | ✅ Exists |
| `GET /api/roles` | Get available roles | ✅ Exists |
| `GET /api/voting-methods` | Get voting methods | ✅ Exists |
| `GET /api/iteration-strategies` | Get iteration options | ✅ Exists |

### Polling Strategy (Instead of WebSocket)

```typescript
// Simple polling for live sessions
const pollInterval = 1000; // 1 second

const pollSession = async (sessionId: string) => {
  const result = await fetch(`/api/council/${sessionId}/result`);
  const data = await result.json();
  
  if (data.status === 'completed') {
    clearInterval(poller);
    return data;
  }
  
  // Update UI with partial data
  updatePartialResult(data);
};

const poller = setInterval(() => pollSession(sessionId), pollInterval);
```

**Why Polling is Fine for MVP:**
- Simpler backend (no WebSocket infrastructure)
- Works with existing Fastify routes
- 1s latency is acceptable for 5-15s sessions
- Can upgrade to WebSocket later if needed

### Minor API Enhancement (Optional)

```typescript
// Add iteration grouping to traces (nice-to-have)
GET /api/council/:id/traces?groupByRound=true

// Response shape:
{
  rounds: [
    { round: 1, confidence: 0.71, events: [...] },
    { round: 2, confidence: 0.92, events: [...] }
  ]
}
```

**REMOVED from v1.0:**
- ❌ WebSocket endpoint
- ❌ `/analyze-preview` endpoint (unnecessary complexity)
- ❌ Custom preset saving (future feature)

---

## 📐 Responsive Design

| Breakpoint | Layout Changes |
|------------|----------------|
| Desktop (≥1024px) | Full layout |
| Tablet (≥768px) | Single column with collapsible config |
| Mobile | *Not primary target* - basic support only |

---

## 📦 Implementation Phases (v2.0 - 5 Days)

### Phase 1: Home Page Enhancements (Day 1)
- [ ] Add preset hover details tooltip
- [ ] Create `InlineConfig` collapsible component
- [ ] Enhance Recent Sessions with confidence display
- [ ] Add confidence trend mini-chart

### Phase 2: Session Page - Debate View (Day 2)
- [ ] Create `DebateCard` component for responses
- [ ] Create `RoundHeader` component for iterations
- [ ] Add tab navigation (Debate | Debug)
- [ ] Display final answer prominently
- [ ] Collapse older rounds

### Phase 3: Session Page - Debug Tab (Day 3)
- [ ] Create `TimelineEvent` component
- [ ] Group events by round
- [ ] Add inline filters (checkboxes)
- [ ] Expandable response content

### Phase 4: Polling & Integration (Day 4)
- [ ] Implement polling for live sessions
- [ ] Smooth transitions for incoming data
- [ ] Loading states and skeletons
- [ ] Error handling

### Phase 5: Testing & Polish (Day 5)
- [ ] Write Playwright E2E tests
- [ ] Accessibility review
- [ ] Animation polish
- [ ] Deploy to Azure

---

## 🧪 Testing Plan (Simplified)

```typescript
// tests/e2e/council.spec.ts
describe('LLM Council v2.0', () => {
  test('home: can select preset and ask question')
  test('home: can expand inline config')
  test('session: shows debate transcript with rounds')
  test('session: can switch to debug tab')
  test('session: shows final answer at top')
  test('debug: can filter events')
  test('debug: can expand response details')
})
```

---

## ✅ Approval Checklist (v2.0)

**Please review and approve the following design decisions:**

### Architecture Decisions
- [ ] **2-Page Structure** - Home + Session (Debug as tab, not page)
- [ ] **No Wizard** - Inline config with collapsible sections
- [ ] **No SVG Chamber** - Simple debate transcript view instead

### Home Page
- [ ] **Preset Pills** - With hover tooltip for details
- [ ] **Inline Config** - Click ⚙️ to expand, don't leave page
- [ ] **Recent Sessions** - Show confidence trend

### Session Page  
- [ ] **Debate Transcript** - Chat-style with role badges
- [ ] **Round Headers** - Confidence per iteration
- [ ] **Tab Navigation** - [Debate] [Debug] tabs

### Debug View
- [ ] **Same Route** - Tab within Session, not `/debug/:id`
- [ ] **Simple Timeline** - No "view modes", just filters
- [ ] **Round Grouping** - Events grouped by iteration

### Technical
- [ ] **Polling** - Not WebSocket (simpler for MVP)
- [ ] **5 Components** - Down from 10
- [ ] **Existing API** - No new endpoints needed
- [ ] **5-Day Timeline** - Down from 10 days

---

## 🔄 v1.0 vs v2.0 Summary

| Aspect | v1.0 (Over-engineered) | v2.0 (Refined) |
|--------|------------------------|----------------|
| Pages | 4 (Home, Composer, Session, Debug) | 2 (Home, Session with tabs) |
| Config Flow | 4-step wizard | Inline collapsible |
| Session View | SVG Council Chamber | Debate Transcript |
| Debug Access | Separate route | Tab in Session |
| Live Updates | WebSocket streaming | Polling |
| Components | 10 new | 5 new |
| Timeline | 10 days | 5 days |
| API Changes | 5 new endpoints | 0 new endpoints |

---

## 🤔 Open Questions

1. **Polling Interval**: 1 second OK, or should we go faster/slower?
2. **Max Rounds Display**: Show all rounds or cap at 5?
3. **Export Format**: JSON only, or add PDF/Markdown?

---

**Awaiting your approval to proceed with implementation!** 🚀

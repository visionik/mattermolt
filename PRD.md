# Product Requirements Document: MatterMolt

**Generated**: 2026-01-27
**Status**: Ready for AI Interview

## Initial Input

**Project Description**: Adapter between MatterMost (chat, files, voice, etc) and Clawdbot (now being renamed MoltBot), implementing as many features of the Clawdbot Slack/Discord channel adapters as possible.

**I want to build MatterMolt that has the following features:**
1. can run as daemon
2. can also run from shell for dev mode
3. fast responses
4. flexible features
5. modular, use plugin architecture when possible
---

# Specification Generation

Agent workflow for creating project specifications via structured interview.

Legend (from RFC2119): !=MUST, ~=SHOULD, ≉=SHOULD NOT, ⊗=MUST NOT, ?=MAY.

## Input Template

```
I want to build MatterMolt that has the following features:
1. [feature]
2. [feature]
...
N. [feature]
```

## Interview Process

- ~ Use Claude AskInterviewQuestion when available (emulate it if not available)
- ! If Input Template fields are empty: ask overview, then features, then details
- ! Ask one focused, non-trivial question per step
- ~ Provide numbered answer options when appropriate
- ! Include "other" option for custom/unknown responses
- ! make it clear which option you feel is RECOMMENDED
- ! when you are done, append to the end of this file all questions asked and answers given.

**Question Areas:**

- ! Missing decisions (language, framework, deployment)
- ! Edge cases (errors, boundaries, failure modes)
- ! Implementation details (architecture, patterns, libraries)
- ! Requirements (performance, security, scalability)
- ! UX/constraints (users, timeline, compatibility)
- ! Tradeoffs (simplicity vs features, speed vs safety)

**Completion:**

- ! Continue until little ambiguity remains
- ! Ensure spec is comprehensive enough to implement

## Output Generation

- ! Generate as SPECIFICATION.md
- ! follow all relevant warping guidelines
- ! use RFC2119 MUST, SHOULD, MAY, SHOULD NOT, MUST NOT wording
- ! Break into phases, subphases, tasks
- ! end of each phase/subphase must implement and run testing until it passes
- ! Mark all dependencies explicitly: "Phase 2 (depends on: Phase 1)"
- ! Design for parallel work (multiple agents)
- ⊗ Write code (specification only)

## Afterwards

- ! let user know to type "implement SPECIFICATION.md" to start implementation

**Structure:**

```markdown
# Project Name

## Overview

## Requirements

## Architecture

## Implementation Plan

### Phase 1: Foundation

#### Subphase 1.1: Setup

- Task 1.1.1: (description, dependencies, acceptance criteria)

#### Subphase 1.2: Core (depends on: 1.1)

### Phase 2: Features (depends on: Phase 1)

## Testing Strategy

## Deployment
```

## Best Practices

- ! Detailed enough to implement without guesswork
- ! Clear scope boundaries (in vs out)
- ! Include rationale for major decisions
- ~ Size tasks for 1-4 hours
- ! Minimize inter-task dependencies
- ! Define clear component interfaces

## Anti-Patterns

- ⊗ Multiple questions at once
- ⊗ Assumptions without clarifying
- ⊗ Vague requirements
- ⊗ Missing dependencies
- ⊗ Sequential tasks that could be parallel

---

## Interview Results

**Date**: 2026-01-27

### Questions and Answers

**Q1: Programming Language & Runtime**
Answer: TypeScript/Node.js (Option 4) - Using Hubot compatibility initially, later clarified to native MoltBot channel

**Q2: Architecture Approach**
Answer: Native MoltBot channel adapter (like Slack/Discord), no Hubot needed

**Q3: MatterMost Connection Method**
Answer: MatterMost Bot API + WebSocket (Option 1) - Real-time, lowest latency

**Q4: Feature Parity Scope**
Answer: Full parity (Option 4) - Text, media, rich interactions, typing indicators, presence, channel management

**Q5: Deployment & Runtime**
Answer: NPM package (Option 1) with standalone GitHub repo for development

**Q6: Configuration & Security**
Answer: MoltBot config file pattern (Option 1) - Settings in `~/.clawdbot/moltbot.json`

**Q7: Error Handling & Resilience**
Answer: Auto-reconnect with exponential backoff (Option 1)

**Q8: Testing Strategy**
Answer: Unit tests + integration tests (Option 1) - Mock API for unit, real server for integration

**Q9: MatterMost Client Library**
Answer: @mattermost/client (Option 1) - Official MatterMost JavaScript client

**Q10: Access Control & Security**
Answer: MoltBot's existing access control (Option 1) - DM pairing, allowFrom, group policies

**Q11: Session Management**
Answer: Follow Slack/Discord pattern (Option 1) - DMs → main session, channels → isolated sessions

**Q12: Development Mode**
Answer: Standard MoltBot Gateway dev mode (Option 1) - Run via `moltbot gateway` with verbose logging


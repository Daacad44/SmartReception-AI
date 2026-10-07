# AI Agent Studio — Phase 8 Human Handover Operations

## Outcome

Phase 8 turns a conversation status change into an auditable handover case with
ownership, priority, SLA, context evidence and a controlled return to AI.

## Case lifecycle

1. `OPEN`: AI or an operator requests human support.
2. `ACKNOWLEDGED`: an operator takes ownership.
3. `RESOLVED`: the human-support outcome is recorded.
4. `AI_RESUMED`: the assigned operator verifies context and returns control.

A partial unique index guarantees at most one `OPEN`/`ACKNOWLEDGED` case per
conversation. Existing human-needed and human-handling conversations are
backfilled during migration.

## Context transfer

Every case snapshots the most recent messages and the latest Agent Studio
execution, including release, intent, confidence, retrieved sources, proposed
actions and runtime error. Operators therefore receive the evidence that caused
the escalation rather than only a generic status.

## Priority and SLA

- `URGENT`: safety/emergency language, five-minute SLA.
- `HIGH`: AI grounding/hallucination handoff, fifteen-minute SLA.
- `NORMAL`: all other handoffs, thirty-minute SLA.

Queue responses include whether the SLA is breached and the remaining seconds.
Queues can include all active cases or only cases assigned/unassigned for the
current operator.

## Controlled AI resume

AI stays disabled throughout human handling. A case must be acknowledged before
resume, and only the assigned operator may return it to AI. The resume action
records the operator identity, timestamp and a context summary.

## API

- `GET /conversations/handoffs/queue`
- `GET /conversations/handoffs/queue?mine=true`
- `GET /conversations/:id/handoff-case`

Existing takeover, assignment, transfer, resolve, close and return-to-AI routes
now synchronize the handover case lifecycle.

## Next phase

Phase 9 should add confirmation-led business actions for bookings, leads and
orders, with idempotent tool execution and compensating failure workflows.

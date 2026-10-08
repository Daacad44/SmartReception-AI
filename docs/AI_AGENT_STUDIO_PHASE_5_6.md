# AI Agent Studio — Phases 5 and 6

## Phase 5: governed knowledge ingestion

Agent Studio can now attach an already indexed, tenant-owned Knowledge Base
document to a WhatsApp agent. Every attachment stores a SHA-256 content checksum,
an immutable revision snapshot, review state, reviewer notes, verification time
and a freshness deadline.

The workflow rejects unprocessed documents and duplicate content. New or changed
content always returns to `PENDING_REVIEW`; only an explicit review can mark it
`APPROVED`. The source list reports approved, pending and stale totals.

## Phase 6: anti-hallucination release gates

Every draft release can be evaluated before approval. The pre-deployment gate
creates a persisted evaluation run and individual cases for:

- at least one approved knowledge source;
- explicit anti-invention boundaries;
- mandatory handover when knowledge is missing;
- an enabled human handover capability; and
- a professional agent role.

Any critical failure blocks review and marks the release `FAILED`. A release with
zero critical failures and a score of at least 80 becomes `READY_FOR_REVIEW`—it
is not deployed automatically. Case evidence, scores and failure reasons remain
available for audit and operator review.

## API

- `GET /ai-agent-studio/:agentId/knowledge`
- `POST /ai-agent-studio/:agentId/knowledge`
- `POST /ai-agent-studio/:agentId/knowledge/:sourceId/review`
- `GET /ai-agent-studio/:agentId/evaluations`
- `POST /ai-agent-studio/:agentId/releases/:releaseId/evaluate`

## Next phase

Phase 7 should connect an approved active release to the WhatsApp runtime with
idempotent execution traces, strict action policies and safe fallbacks.

# AI Agent Studio — Phase 0 and Phase 1 Completion

## Scope

Phase 0 establishes a reproducible safety baseline for the existing WhatsApp AI
training platform. Phase 1 removes unsafe deployment and concurrency behavior
before the user-facing AI Agent Studio domain is introduced.

No existing HTTP route or Prisma model is renamed in these phases. The rollout
is backward compatible and guarded by `AGENT_STUDIO_V2_ENABLED=false` by default.

## Runtime flow

1. An approved training action creates one queued job per business.
2. BullMQ runs the training pipeline; an inline fallback remains for local
   environments without Redis.
3. Incremental runs process changed documents but materialize a complete version
   snapshot.
4. The selected sandbox version restricts retrieval to its snapshot documents.
5. Automated evaluation creates a pending deployment request; it never publishes.
6. Readiness checks require sandbox evidence for that exact version.
7. A human approval is consumed exactly once during transactional publication.

## Concurrency and recovery invariants

- PostgreSQL advisory locks serialize active-job creation, version-number
  allocation, deployment-request creation, publication, and rollback per tenant.
- Partial unique indexes guarantee one active training job per business, one
  pending request per business/version, and one production version per business.
- A cancelled job cannot be claimed and active jobs stop cooperatively at the
  next progress checkpoint.
- Queued jobs missing from BullMQ are re-enqueued by the worker recovery scan.
- Running jobs without a heartbeat for 30 minutes are failed explicitly instead
  of remaining permanently stuck.

## Deployment and rollback checklist

Before deployment:

1. Back up PostgreSQL.
2. Run `npm run build -w @smartreception/shared`.
3. Run `npm run db:generate -w @smartreception/backend`.
4. Run `npm run typecheck -w @smartreception/backend`.
5. Run `npm test -w @smartreception/backend`.
6. Apply `prisma migrate deploy` before starting API and worker processes.
7. Confirm Redis and the dedicated worker are healthy.
8. Leave `AGENT_STUDIO_V2_ENABLED=false` until Phase 2 rollout begins.

Rollback procedure:

1. Disable `AGENT_STUDIO_V2_ENABLED`.
2. Stop API and worker processes before database rollback.
3. Restore the pre-deployment database backup if the safety migration must be
   removed; partial unique indexes should not be dropped while duplicate active
   records can be created.
4. Redeploy the previous application commit.
5. Restart the worker first, then the API, and verify queue reconciliation logs.

## Phase 0 evidence

- Shared, backend, and frontend builds are part of the repository commit hook.
- The backend test command includes dedicated training safety regression tests.
- `agentStudioV2` is available as a disabled-by-default compatibility flag.
- This document records dependencies, deployment order, and rollback steps.

## Phase 1 evidence

- Automated validation ends in a pending human approval request.
- Publication and rollback are transactional.
- Version allocation and active job creation are race safe.
- Sandbox evidence and retrieval are scoped to the candidate version.
- Stale job recovery is scheduled in the worker.
- Database indexes provide final concurrency enforcement.

## Remaining scope

Phase 2 and later introduce Agent, Agent Draft, Agent Release, Business Discovery,
industry blueprints, governed knowledge, skills, workflows, advanced evaluation,
the Improvement Inbox, analytics, and the final AI Agent Studio UI.

# AI Agent Studio — Phase 2 Domain Foundation

## Outcome

Phase 2 introduces an additive, WhatsApp-first Agent Studio domain without
renaming or removing any legacy training API. The new API is available at
`/api/v1/ai-agent-studio` only when `AGENT_STUDIO_V2_ENABLED=true`.

## Domain

- `AiAgent`: tenant-owned WhatsApp agent identity and active release pointer.
- `AiAgentDraft`: mutable configuration workspace with revision tracking.
- `AiAgentRelease`: immutable release snapshot, optionally linked to a legacy
  training version.
- `AiAgentReleaseApproval`: review history foundation.
- `AiAgentSkillConfiguration`: governed skill enablement, risk and confirmation.
- `AiAgentExecution`: future runtime trace and cost record.
- `AiAgentEvaluationRun` and `AiAgentEvaluationCase`: evaluation foundation.

## Backward compatibility

The migration creates one `whatsapp-agent` for every existing business, imports
every legacy training version as an Agent Release, selects the production version
as the active release, imports deployment approvals, and creates a mutable draft.
Legacy routes and tables remain authoritative during the staged rollout.

The service also performs idempotent lazy synchronization so training versions
created during a mixed-version deployment are imported when Agent Studio is read.

## Safety

- Default Agent Studio endpoints remain hidden behind the Phase 0 feature flag.
- Every lookup is scoped by `businessId`.
- Agent/release numbering and default provisioning use advisory locks.
- Draft writes require the expected revision, preventing silent concurrent edits.
- Releases snapshot agent identity, draft revision/configuration, governed skills,
  and the latest eligible knowledge snapshot.
- Agent, draft, release and skill mutations write audit records atomically.
- Critical autonomous skills cannot be enabled; high-risk skills require explicit
  confirmation.
- Existing AI Training Management endpoints are unchanged.

## API

- `GET /ai-agent-studio`
- `GET /ai-agent-studio/:agentId`
- `PATCH /ai-agent-studio/:agentId`
- `PUT /ai-agent-studio/:agentId/draft`
- `POST /ai-agent-studio/:agentId/releases`
- `PUT /ai-agent-studio/:agentId/skills/:skillKey`

## Next phase

Phase 3 provides the user-facing AI Agent Studio navigation, terminology and
screens while keeping the current AI Training UI available during rollout.

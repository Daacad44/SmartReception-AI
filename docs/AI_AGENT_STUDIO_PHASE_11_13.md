# AI Agent Studio — Phases 11–13

## Phase 11 — Enterprise Governance and Compliance

- Each agent has a tenant-scoped, revision-safe governance policy.
- Confidence and hallucination thresholds are enforced by the live runtime.
- Release approval requires a passing evaluation and can require a reviewer who
  is different from the requester.
- Activation is transactional: the prior active release is retired before the
  approved release becomes active.
- Compliance evidence can be exported with policies, releases, approvals,
  evaluation cases and relevant audit events.
- Retention settings are recorded now; automated deletion must be enabled only
  after legal/business retention requirements are configured.

## Phase 12 — WhatsApp Production Rollout and Observability

- Agent Studio traffic is disabled by default after migration.
- Operators can roll out deterministic cohorts from 0–100%; a conversation
  always stays in the same cohort.
- A kill switch immediately sends traffic to the legacy WhatsApp runtime.
- Runtime failures can fall back to the legacy implementation without sending a
  duplicate Agent Studio response.
- Health reports compare failure, handoff and confidence rates with configurable
  thresholds over a bounded observation window.

Recommended progression: 5% → 10% → 25% → 50% → 100%, advancing only when the
configured observation window is healthy.

## Phase 13 — Multi-Agent Routing

- A business can create multiple specialized WhatsApp agents.
- Enabled routing rules are evaluated in ascending priority order using
  normalized intent and keyword matching.
- The database permits only one enabled fallback rule per business.
- A rule cannot target an agent from another tenant, and live routing only
  selects active agents with active releases.
- If no rule matches, the existing default active WhatsApp agent remains the
  backward-compatible fallback.

## Operational sequence

1. Create and train a specialized agent.
2. Evaluate its immutable release.
3. Request approval; a separate authorized reviewer approves it.
4. Activate the approved release.
5. Add a routing rule and retain one fallback rule.
6. Start at a small rollout percentage and monitor health.
7. Use the kill switch if thresholds are breached, then review evidence before
   resuming traffic.

# AI Agent Studio — Phase 10 Quality and Operations Analytics

## Outcome

Phase 10 provides tenant- and agent-scoped operational analytics sourced from
durable Agent Studio records rather than inferred UI counters.

## Metrics

- Runtime executions, completion, handoff and failure rates.
- Average grounded confidence and latency.
- Token consumption and estimated model cost.
- Action completion, confirmation backlog, cancellation, expiry and conversion.
- Handoff volume, urgency, SLA compliance and acknowledgement time.
- Evaluation pass rate, average score and critical failures.
- Approved, pending and stale knowledge counts.
- Release distribution and daily execution/action trend data.

All ratio metrics return zero for empty datasets instead of `NaN` or misleading
100% values. Queries are scoped by both `businessId` and `agentId`, accept a
validated 1–365 day window, and never expose cross-tenant data.

## API and UI

- `GET /ai-agent-studio/:agentId/analytics?days=30`
- The Agent Studio Analytics tab shows containment, confidence, conversion, SLA,
  runtime health, quality gates, human operations and recent daily activity.

## Next phase

Phase 11 should add enterprise governance: configurable policies, separation of
duties, release approval evidence, retention controls and compliance exports.

# AI Agent Studio — Phase 7 WhatsApp Runtime

## Outcome

Phase 7 binds an active, approved Agent Studio release to the existing WhatsApp
reply pipeline. The legacy runtime remains the fallback when the feature flag is
disabled or a business has no active WhatsApp agent release.

## Runtime contract

- Resolve the active WhatsApp agent and immutable active release per tenant.
- Restrict RAG retrieval to approved and non-expired agent knowledge documents.
- Append immutable release instructions and boundaries to the system prompt.
- Persist one execution trace per inbound WhatsApp message.
- Reuse a completed execution on queue/webhook retries.
- Do not send a second outbound message when that execution was already persisted.
- Record retrieval evidence, proposed actions, executed actions, confidence,
  latency, release identity, completion status and failures.

## Safety policy

- Missing knowledge, hallucination risk above `0.55`, or confidence below `0.30`
  produces a human-handover response rather than an invented answer.
- Appointment creation is blocked unless the active release enables the skill
  without a confirmation requirement.
- Blocked write actions are removed and replaced with human escalation.
- Empty approved-knowledge allowlists retrieve no live documents; they never
  silently fall back to the tenant's unrestricted knowledge index.

## Compatibility

`AGENT_STUDIO_V2_ENABLED=false` preserves the existing runtime exactly. Enabling
the flag opts active Agent Studio releases into the governed path, while tenants
without an active release continue on the legacy path.

## Next phase

Phase 8 should add operator handover queues, ownership, service-level timers,
full context transfer and a controlled AI-resume workflow.

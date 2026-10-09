# AI Agent Studio — Phase 4 Structured Business Discovery

## Outcome

Phase 4 adds a structured, category-aware interview that turns verified business
context into a professional WhatsApp agent draft. It does not publish or deploy.

## Included templates

- Healthcare reception.
- Hospitality and reservations.
- Commerce sales support.
- Professional services reception.
- Safe general-business fallback.

Each template defines the agent role, objectives, non-negotiable boundaries,
recommended low-risk skills and the business facts required for good answers.

## Safety

- Draft updates require the current revision and fail on concurrent edits.
- Templates add explicit anti-invention and escalation boundaries.
- Human handover and missing-knowledge escalation are enabled by default.
- Only existing read-only/default-safe skills are enabled by discovery.
- All changes and the selected template are written to the audit log.
- Applying discovery never creates, approves or deploys a release.

## Readiness

The API measures business identity, overview, contact details, working hours,
approved knowledge, human handover and completion of the discovery interview.

## Next phase

Phase 5 should build the professional knowledge ingestion pipeline: source
ownership, parsing status, duplicate detection, freshness, approval and coverage.

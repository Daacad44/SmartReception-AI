# AI Agent Studio — Phase 3 Operator Experience

## Outcome

Phase 3 adds the first business-facing, WhatsApp-only Agent Studio workspace. It
uses the Phase 2 API and does not replace or remove the legacy AI Training UI.

## Rollout

Both flags must be enabled in the deployment:

- `AGENT_STUDIO_V2_ENABLED=true` exposes the protected backend API.
- `VITE_AGENT_STUDIO_V2_ENABLED=true` includes Agent Studio in the frontend
  navigation. Because Vite variables are build-time values, the frontend must be
  rebuilt after changing this flag.

Keep both flags disabled until the Phase 2 migration is deployed and verified.

## Workspace capabilities

- WhatsApp agent identity and lifecycle visibility.
- Readiness checklist for identity, instructions, retrieval, handover and release.
- Revision-safe instruction editing to prevent concurrent overwrite.
- Governed skill enablement with visible risk and confirmation requirements.
- Immutable release creation and release history.
- Existing production release visibility without automatic publication.

## Safety boundaries

- Creating a release does not deploy it.
- Critical skills cannot be enabled from the UI.
- Backend authorization, tenant scoping and risk policy remain authoritative.
- The legacy training and deployment workflow stays available during rollout.

## Next phase

Phase 4 should add structured business discovery, category-aware onboarding,
knowledge readiness checks and reusable professional agent templates.

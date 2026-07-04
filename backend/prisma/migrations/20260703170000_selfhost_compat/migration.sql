-- Self-hosted Postgres compatibility.
--
-- The audit (backup-plan/answer.md §2) confirmed the only app-table RLS in
-- the entire schema is a single deny-all "defense in depth" policy on
-- governance_approval_requests. Since the app moves off Supabase PostgREST
-- entirely — Prisma has always connected as a privileged role that bypasses
-- RLS, and Express middleware is the real authorization boundary — this
-- policy no longer buys anything and would silently break future PostgREST
-- or replication tooling that reads this table.
--
-- Idempotent: safe to re-run on any host, Supabase or self-hosted.
DROP POLICY IF EXISTS "governance_requests_service_only" ON "governance_approval_requests";
ALTER TABLE "governance_approval_requests" DISABLE ROW LEVEL SECURITY;

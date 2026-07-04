-- RLS policies for governance approval requests (defense in depth; app uses service role)

ALTER TABLE "governance_approval_requests" ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated users cannot access directly via PostgREST
CREATE POLICY "governance_requests_service_only"
  ON "governance_approval_requests"
  FOR ALL
  USING (false)
  WITH CHECK (false);

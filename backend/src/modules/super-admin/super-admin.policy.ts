export function isLastSuperAdminChangeBlocked(opts: {
  targetIsSuperAdmin: boolean;
  activeSuperAdminCount: number;
  nextIsSuperAdmin?: boolean;
  nextIsActive?: boolean;
}): boolean {
  if (!opts.targetIsSuperAdmin) return false;
  if (opts.activeSuperAdminCount > 1) return false;
  if (opts.nextIsSuperAdmin === false) return true;
  if (opts.nextIsActive === false) return true;
  return false;
}

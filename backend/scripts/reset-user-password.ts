/**
 * One-off: reset a user's password and make sure the account can log in.
 *
 * The password is read from the NEW_PASSWORD env var — never hardcoded — and
 * hashed with the SAME passwordService (bcryptjs, 12 salt rounds) that the login
 * flow compares against, so the new hash is guaranteed compatible.
 *
 * Usage (run where DATABASE_URL is set, e.g. the VPS backend dir):
 *   OWNER_EMAIL='mimafoundation1@gmail.com' NEW_PASSWORD='Mimo@2026' \
 *     npx tsx scripts/reset-user-password.ts
 *
 * If the user does not exist, the script reports it and makes no changes.
 */
import { prisma } from '../src/infrastructure/database/prisma';
import { passwordService } from '../src/infrastructure/auth/password.service';

async function main() {
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.NEW_PASSWORD;

  if (!email) throw new Error('Set OWNER_EMAIL');
  if (!password) throw new Error('Set NEW_PASSWORD');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`❌ User not found: ${email}`);
    console.log('   No changes made. Create the account via the normal signup/approval flow first.');
    return;
  }

  const passwordHash = await passwordService.hash(password);

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash,
      isActive: true,
      isEmailVerified: true,
      approvalStatus: 'ACTIVE',
      emailOtpHash: null,
      emailOtpExpires: null,
      emailOtpAttempts: 0,
      resetOtpHash: null,
      resetOtpExpires: null,
      resetOtpAttempts: 0,
    },
  });

  // Force a clean re-login everywhere.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`✅ Password reset and account activated for ${email}`);
  console.log(`   userId=${user.id}  isActive=true  isEmailVerified=true  approvalStatus=ACTIVE`);
  console.log('   Note: if this user owns a business, run activate-business.ts so the');
  console.log('         login license gate also passes.');
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * One-off: lowercase/trim all existing User.email values so they match the new
 * normalized login lookup (email.trim().toLowerCase()).
 *
 * Safety: before writing, it checks for COLLISIONS — two different users whose
 * emails only differ by case/whitespace (e.g. "Foo@x.com" and "foo@x.com").
 * Those cannot both be lowercased (email is unique), so they are reported and
 * SKIPPED — no destructive merge is attempted. Resolve collisions by hand.
 *
 * DRY RUN by default. Pass APPLY=true to actually write.
 *   npx tsx scripts/backfill-user-emails.ts                 # preview only
 *   APPLY=true npx tsx scripts/backfill-user-emails.ts      # perform updates
 */
import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const apply = process.env.APPLY === 'true';
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  // Map normalized email -> list of users that would end up with it.
  const byNormalized = new Map<string, { id: string; email: string }[]>();
  for (const u of users) {
    const normalized = u.email.trim().toLowerCase();
    const list = byNormalized.get(normalized) ?? [];
    list.push(u);
    byNormalized.set(normalized, list);
  }

  const toUpdate: { id: string; from: string; to: string }[] = [];
  const collisions: { normalized: string; ids: string[]; emails: string[] }[] = [];

  for (const [normalized, group] of byNormalized) {
    if (group.length > 1) {
      // More than one user maps to the same normalized email → collision.
      collisions.push({
        normalized,
        ids: group.map((g) => g.id),
        emails: group.map((g) => g.email),
      });
      continue;
    }
    const only = group[0]!;
    if (only.email !== normalized) {
      toUpdate.push({ id: only.id, from: only.email, to: normalized });
    }
  }

  console.log(`Scanned ${users.length} users.`);
  console.log(`  ${toUpdate.length} need normalization.`);
  console.log(`  ${collisions.length} collision group(s) (SKIPPED — resolve manually).`);

  for (const c of collisions) {
    console.log(`  ⚠️  COLLISION for "${c.normalized}": ${c.emails.join(' , ')}  (ids: ${c.ids.join(', ')})`);
  }

  if (!apply) {
    console.log('\nDRY RUN — no changes written. Re-run with APPLY=true to apply.');
    for (const u of toUpdate) console.log(`  would update: "${u.from}" -> "${u.to}"`);
    return;
  }

  let updated = 0;
  for (const u of toUpdate) {
    await prisma.user.update({ where: { id: u.id }, data: { email: u.to } });
    updated += 1;
  }
  console.log(`\n✅ Updated ${updated} user email(s).`);
  if (collisions.length > 0) {
    console.log(`⚠️  ${collisions.length} collision group(s) were left untouched — resolve them by hand.`);
  }
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

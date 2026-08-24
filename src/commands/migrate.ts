import { loadIdentity } from '../identity/index.js';
import { migrateMembers } from '../vault/index.js';

export async function execute(_args: string[], _opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const members = migrateMembers(identity);

  process.stdout.write('Member list upgraded to the attested format.\n');
  process.stdout.write(`You have vouched for ${members.length} member(s):\n`);
  for (const member of members) {
    const marker = member.fingerprint === identity.fingerprint ? ' (you)' : '';
    process.stdout.write(`  ${member.fingerprint.slice(0, 16)}  ${member.label}${marker}\n`);
  }
  process.stdout.write('\nIf any of those are not people you expect, revoke them now with\n');
  process.stdout.write('"fermer revoke <fingerprint>", then commit .fermer/members.json.\n');
}

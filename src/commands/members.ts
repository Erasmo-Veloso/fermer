import { loadIdentity } from '../identity/index.js';
import { listMembers } from '../vault/index.js';

export async function execute(args: string[], _opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const members = listMembers(identity)
    .map((member) => ({ ...member, isSelf: member.fingerprint === identity.fingerprint }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(members, null, 2)}\n`);
    return;
  }

  for (const member of members) {
    const marker = member.isSelf ? ' (you)' : '';
    process.stdout.write(
      `${member.fingerprint.slice(0, 16)}  ${member.label}${marker}  added ${member.addedAt}\n`,
    );
  }
}

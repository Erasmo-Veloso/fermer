import { loadIdentity } from '../identity/index.js';
import { listMembers } from '../vault/index.js';

export async function execute(_args: string[], _opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const members = listMembers(identity).sort((a, b) => a.label.localeCompare(b.label));

  for (const member of members) {
    const marker = member.fingerprint === identity.fingerprint ? ' (you)' : '';
    process.stdout.write(`${member.fingerprint.slice(0, 16)}  ${member.label}${marker}  added ${member.addedAt}\n`);
  }
}

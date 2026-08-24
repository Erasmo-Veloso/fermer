import { canonicalizePublicKey, signPayload, verifySignature } from '../crypto/device.js';
import type { Identity, MemberEntry, MembersFile } from '../types.js';

const ATTESTATION_VERSION = 'fermer-member-attestation-v1';

// The signature deliberately does not cover wrappedKey. A membership grant
// outlives any particular wrapping: every revocation re-wraps the new project
// key for everyone who stays, and those re-wraps must not invalidate the
// attestation that says the member belongs here.
export function attestationPayload(fingerprint: string, entry: Omit<MemberEntry, 'signature'>): string {
  return JSON.stringify({
    v: ATTESTATION_VERSION,
    fingerprint,
    publicKey: canonicalizePublicKey(entry.publicKey),
    label: entry.label,
    addedAt: entry.addedAt,
    addedBy: entry.addedBy,
  });
}

export function signMemberEntry(
  fingerprint: string,
  entry: Omit<MemberEntry, 'signature'>,
  signer: Identity,
): MemberEntry {
  return { ...entry, signature: signPayload(signer.privateKey, attestationPayload(fingerprint, entry)) };
}

function signatureHolds(fingerprint: string, entry: MemberEntry, signerPublicKey: string): boolean {
  try {
    return verifySignature(signerPublicKey, attestationPayload(fingerprint, entry), entry.signature);
  } catch {
    return false;
  }
}

export type ChainResult = { ok: true } | { ok: false; reason: string };

// Every member must be attested by another member, transitively reaching the
// single founder who attested themselves at init.
//
// Requiring exactly one self-attested entry is what makes this hold. An attacker
// who can write to the repository cannot forge a signature from a real member,
// so their only option is to self-attest -- and that produces a second founder,
// which is precisely what this rejects. Accepting any self-attested entry as a
// root would defeat the whole mechanism, since anyone can sign with their own
// key.
export function verifyMemberChain(members: MembersFile['members']): ChainResult {
  const entries = Object.entries(members);
  if (entries.length === 0) {
    return { ok: false, reason: 'it lists no members at all' };
  }

  const selfAttested = entries.filter(
    ([fingerprint, entry]) =>
      entry.addedBy === fingerprint && signatureHolds(fingerprint, entry, entry.publicKey),
  );

  if (selfAttested.length === 0) {
    return { ok: false, reason: 'no member is attested as the project founder' };
  }
  if (selfAttested.length > 1) {
    const names = selfAttested.map(([, entry]) => entry.label).join(', ');
    return {
      ok: false,
      reason: `more than one member claims to be the project founder (${names}), which happens when an entry was added outside "fermer trust"`,
    };
  }

  const attested = new Set(selfAttested.map(([fingerprint]) => fingerprint));

  let grew = true;
  while (grew) {
    grew = false;
    for (const [fingerprint, entry] of entries) {
      if (attested.has(fingerprint) || !attested.has(entry.addedBy)) {
        continue;
      }
      if (signatureHolds(fingerprint, entry, members[entry.addedBy].publicKey)) {
        attested.add(fingerprint);
        grew = true;
      }
    }
  }

  const unattested = entries.filter(([fingerprint]) => !attested.has(fingerprint));
  if (unattested.length > 0) {
    const names = unattested.map(([, entry]) => entry.label).join(', ');
    return {
      ok: false,
      reason: `these members are not attested by anyone the project trusts: ${names}`,
    };
  }

  return { ok: true };
}

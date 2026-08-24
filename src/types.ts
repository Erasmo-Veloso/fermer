export interface Identity {
  version: 1;
  fingerprint: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
  label: string;
}

export interface WrappedKey {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface MemberEntry {
  publicKey: string;
  label: string;
  wrappedKey: WrappedKey;
  addedAt: string;
  /** Fingerprint of the member who attested this one; equals own fingerprint for the founder. */
  addedBy: string;
  /** ECDSA signature by `addedBy` over the attestation payload. */
  signature: string;
}

export interface MembersFile {
  version: 2;
  members: Record<string, MemberEntry>;
}

/** The pre-attestation format, still readable so `fermer migrate` can upgrade it. */
export interface LegacyMembersFile {
  version: 1;
  members: Record<string, Omit<MemberEntry, 'addedBy' | 'signature'>>;
}

export interface EncryptedValue {
  iv: string;
  ciphertext: string;
  tag: string;
  updatedAt: string;
}

export interface VaultFile {
  version: 1;
  environments: Record<
    string,
    {
      secrets: Record<string, EncryptedValue>;
    }
  >;
}

export interface ConfigFile {
  version: 1;
  environments: string[];
  defaultEnvironment: string;
}

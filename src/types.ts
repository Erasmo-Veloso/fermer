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
}

export interface MembersFile {
  version: 1;
  members: Record<string, MemberEntry>;
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

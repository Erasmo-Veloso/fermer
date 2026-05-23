import assert from 'node:assert';
import { randomKey, encryptAesGcm, decryptAesGcm, generateKeyPair } from '../src/index';

function testAesGcm() {
  const key = randomKey(32);
  const plaintext = Buffer.from('hello fermer');
  const { iv, ciphertext, tag } = encryptAesGcm(plaintext, key);
  const out = decryptAesGcm(iv, ciphertext, tag, key);
  assert.strictEqual(out.toString(), 'hello fermer');
  console.log('AES-GCM roundtrip: OK');
}

function testKeyPair() {
  const kp = generateKeyPair();
  assert.ok(kp.publicKey.includes('BEGIN PUBLIC KEY'));
  assert.ok(kp.privateKey.includes('BEGIN PRIVATE KEY'));
  console.log('EC keypair generation: OK');
}

try {
  testAesGcm();
  testKeyPair();
  console.log('All crypto tests passed');
  process.exit(0);
} catch (err) {
  console.error('Crypto tests failed:', err);
  process.exit(2);
}

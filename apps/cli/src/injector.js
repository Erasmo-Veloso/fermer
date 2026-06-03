const fs = require('node:fs');
const path = require('node:path');
const { createDecipheriv } = require('node:crypto');

function secretsFilePath(environmentId) {
  return path.join(process.cwd(), '.fermer', 'secrets', `${environmentId}.json`);
}

function decryptAesGcm(iv_b64, ciphertext_b64, tag_b64, keyBuf) {
  const iv = Buffer.from(iv_b64, 'base64');
  const tag = Buffer.from(tag_b64, 'base64');
  const ciphertext = Buffer.from(ciphertext_b64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

async function loadSecrets(environmentId) {
  const p = secretsFilePath(environmentId);
  if (!fs.existsSync(p))
    throw new Error(`No local secrets file found for environment ${environmentId}`);
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Failed to parse local secrets file');
  }
}

function getLocalKey() {
  const raw = process.env.FERMER_LOCAL_KEY || '';
  if (!raw) return null;
  try {
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}

async function injectEnvironment(environmentId) {
  const data = await loadSecrets(environmentId);
  const secrets = data.secrets || [];
  const env = {};
  const key = getLocalKey();

  for (const s of secrets) {
    const name = s.name;
    const ev = s.encryptedValue;
    if (typeof ev !== 'string') continue;
    if (ev.startsWith('plain:')) {
      env[name] = ev.slice('plain:'.length);
      continue;
    }

    // try JSON payload {iv,ciphertext,tag}
    try {
      const parsed = JSON.parse(ev);
      if (parsed.iv && parsed.ciphertext && parsed.tag) {
        if (!key) throw new Error('FERMER_LOCAL_KEY not set for decrypting secrets');
        env[name] = decryptAesGcm(parsed.iv, parsed.ciphertext, parsed.tag, key);
        continue;
      }
    } catch {
      // fallthrough
    }

    // unsupported format
    throw new Error(`Unsupported encryptedValue format for secret ${name}`);
  }

  return env;
}

module.exports = { injectEnvironment };

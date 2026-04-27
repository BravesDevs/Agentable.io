import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.API_KEY_SECRET
  if (!secret) {
    throw new Error('API_KEY_SECRET env var is required to encrypt provider keys')
  }
  return createHash('sha256').update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const iv     = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Malformed encrypted payload')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8')
}

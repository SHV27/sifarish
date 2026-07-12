import { db } from '../../db/db'

/**
 * DARBAAN backup (P16) — one-click encrypted export so the real ledger survives browser
 * resets. AES-256-GCM with a PBKDF2-derived key (the GCM auth tag doubles as the integrity
 * check: a tampered file fails to decrypt, full stop). The passcode never leaves the device;
 * the export is safe to keep anywhere.
 */

const MAGIC = 'SIFARISH-BACKUP-v1'
const ITERATIONS = 210_000

const USER_TABLES = ['ledger', 'identity', 'voicebank', 'settings', 'jobs', 'packets', 'watchlist', 'savedHunts', 'suggestions', 'guruThreads'] as const
type UserTable = (typeof USER_TABLES)[number]

interface TableLike {
  toArray(): Promise<unknown[]>
  clear(): Promise<void>
  bulkPut(rows: unknown[]): Promise<unknown>
}
function tableOf(name: UserTable): TableLike {
  return db[name] as unknown as TableLike
}

interface BackupFile {
  magic: typeof MAGIC
  saltB64: string
  ivB64: string
  cipherB64: string
  at: string
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function exportBackup(passcode: string): Promise<string> {
  const payload: Record<string, unknown[]> = {}
  for (const t of USER_TABLES) payload[t] = await tableOf(t).toArray()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passcode, salt)
  const plain = new TextEncoder().encode(JSON.stringify(payload))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource)
  const file: BackupFile = {
    magic: MAGIC,
    saltB64: toB64(salt.buffer),
    ivB64: toB64(iv.buffer),
    cipherB64: toB64(cipher),
    at: new Date().toISOString(),
  }
  return JSON.stringify(file)
}

export async function importBackup(fileText: string, passcode: string): Promise<{ ok: boolean; reason?: string; counts?: Record<string, number> }> {
  let file: BackupFile
  try {
    file = JSON.parse(fileText) as BackupFile
  } catch {
    return { ok: false, reason: 'Not a SIFARISH backup file (bad JSON).' }
  }
  if (file.magic !== MAGIC) return { ok: false, reason: 'Not a SIFARISH backup file.' }
  let plainText: string
  try {
    const key = await deriveKey(passcode, fromB64(file.saltB64))
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.ivB64) as BufferSource },
      key,
      fromB64(file.cipherB64) as BufferSource,
    )
    plainText = new TextDecoder().decode(plain)
  } catch {
    // Wrong passcode and tampered ciphertext are indistinguishable by design (GCM auth).
    return { ok: false, reason: 'Decryption failed — wrong passcode or the file was modified (integrity check).' }
  }
  let payload: Record<string, unknown[]>
  try {
    payload = JSON.parse(plainText)
  } catch {
    return { ok: false, reason: 'Backup contents corrupted.' }
  }
  const counts: Record<string, number> = {}
  await db.transaction('rw', USER_TABLES.map((t) => db[t]), async () => {
    for (const t of USER_TABLES) {
      const rows = payload[t]
      if (!Array.isArray(rows)) continue
      await tableOf(t).clear()
      if (rows.length > 0) await tableOf(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return { ok: true, counts }
}

export { USER_TABLES }

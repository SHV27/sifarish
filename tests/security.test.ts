import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string): string[] {
  let out: string[] = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else out.push(p)
  }
  return out
}

const codeFiles = [...walk('src'), ...walk('api')].filter((f) => /\.(ts|tsx)$/.test(f))

describe('Security — no secrets in source (Law 11)', () => {
  it('no live token literals anywhere in src/ or api/', () => {
    const tokenRe = /\b(gsk_[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|tvly-[A-Za-z0-9-]{20}|ak_[a-z0-9]{30}|vcp_[A-Za-z0-9]{20})\b/
    for (const f of codeFiles) {
      const src = readFileSync(f, 'utf8')
      expect(tokenRe.test(src), `${f} contains a token literal`).toBe(false)
    }
  })

  it('no VITE_-prefixed secret is read anywhere (keys must stay server-side)', () => {
    for (const f of codeFiles) {
      const src = readFileSync(f, 'utf8')
      expect(/VITE_[A-Z_]*(KEY|TOKEN|SECRET|PAT)/.test(src), `${f} exposes a VITE_ secret`).toBe(false)
    }
  })

  it('every serverless function reads its key from process.env only', () => {
    for (const f of codeFiles.filter((p) => p.replace(/\\/g, '/').includes('/api/'))) {
      const src = readFileSync(f, 'utf8')
      // If a key name appears, it must be via process.env — never a hardcoded assignment.
      for (const key of ['GROQ_API_KEY', 'TAVILY_API_KEY', 'JSEARCH_API_KEY', 'GITHUB_PAT']) {
        if (src.includes(key)) {
          expect(src.includes(`process.env.${key}`), `${f} references ${key} without process.env`).toBe(true)
        }
      }
    }
  })
})

describe('I3 — No Send extends to v2 (Guru + Khabri): discovery is API-only', () => {
  it('no forbidden send/scrape/automation APIs in the codebase', () => {
    const forbidden = [/nodemailer/i, /sendmail/i, /puppeteer/i, /\bselenium\b/i, /linkedin\.com\/.*login/i]
    for (const f of codeFiles) {
      const src = readFileSync(f, 'utf8')
      for (const pat of forbidden) {
        expect(pat.test(src), `${f} matches forbidden ${pat}`).toBe(false)
      }
    }
  })

  it('Khabri only calls lawful aggregator/public APIs (no platform scraping)', () => {
    const keyless = readFileSync('src/lib/khabri/keyless.ts', 'utf8')
    // Allowed hosts only.
    expect(keyless).toMatch(/hn\.algolia\.com|remotive\.com|remoteok\.com/)
    expect(keyless).not.toMatch(/linkedin\.com\/jobs|naukri\.com|indeed\.com\/viewjob/)
  })
})

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'fs'
import { db } from '../src/db/db'
import { SEED_IDENTITY, SEED_LEDGER, fakeJob, compilePacketPure } from './helpers'
import { recompilePacket, floorPassPacket } from '../src/lib/darzi'
import { compileResume } from '../src/lib/compile/compiler'
import { compileCoverLetter, compileOutreach } from '../src/lib/compile/letters'
import { composeLetter } from '../src/lib/atelier/letter'
import { buildSummaryLine } from '../src/lib/darzi/summary'
import { identityToken, isIdentityBullet } from '../src/lib/compile/overlap'
import { decodeJD } from '../src/lib/jd/decode'
import { matchEvidence } from '../src/lib/match/evidence'
import type { LedgerEntry, Packet, VisionProfile } from '../src/types'

/**
 * Session 7.2 "The Sanad" — WS-A gates. The disease this workstream kills: STATE AMNESIA
 * (every recompile forgot a different field) and GATES GUARDING ONE DOOR OF A TWO-DOOR ROOM
 * (the résumé sanitized, the letter raw; the page deduped, polish mutating after it).
 * Every gate below is the regression test its fix ships with (§14).
 */

const VISION: VisionProfile = {
  dream: 'Direct AI to build what one person alone never could.',
  targetRoles: ['Agentic AI Engineer'],
  notInterested: [],
  compFloorStipend: 20000,
  ppoFloorLpa: 16,
  windowStart: 'Feb 2027',
  windowEnd: 'Jun 2027',
  remoteInternational: true,
  openToOctoberStart: false,
}

// His exact S7.1 twin pair — reused as the floor-pass fixture.
const TWIN_A =
  'Implemented guardrails that tag every content line with ledger IDs and reject uncited prose, guaranteeing 100% PDF round-trip fidelity to ensure all compiled resumes remain provably accurate'
const TWIN_B =
  'Developed Sifarish, an agentic job-hunt chief of staff that compiles verified role data and drafts applications while enforcing a strict human-in-the-loop policy for all outgoing content'

const shippedProject = SEED_LEDGER.find((e) => e.kind === 'project' && e.tier === 'shipped' && e.bullets.length >= 2)!

beforeAll(async () => {
  await db.identity.put({ ...SEED_IDENTITY, id: 'me' })
  await db.ledger.bulkPut(SEED_LEDGER)
  const existing = await db.settings.get('app')
  await db.settings.put({ ...(existing ?? { id: 'app', onboarded: true }), id: 'app', visionProfile: VISION } as never)
})

function packetWithState(): Packet {
  const job = fakeJob('SanadCo', 'AI Engineer', 'We need Python, LLM agents, RAG, evals and TypeScript.')
  const p = compilePacketPure(job)
  const excludedBullet = shippedProject.bullets[0]
  const overrideBullet = shippedProject.bullets[1]
  return {
    ...p,
    summaryOn: true,
    excludedIds: [],
    excludedBulletIds: [excludedBullet.id],
    bulletOverrides: { [overrideBullet.id]: `Engineered ${overrideBullet.text.charAt(0).toLowerCase()}${overrideBullet.text.slice(1)}` },
    compilePlan: {
      order: [shippedProject.id],
      bullets: { [shippedProject.id]: shippedProject.bullets.map((b) => b.id) },
    },
  }
}

describe('A1 — one recompile authority: no op forgets another op\'s state', () => {
  it('summary toggle keeps Nazar exclusions + framing overrides + the plan', async () => {
    const packet = packetWithState()
    const off = await recompilePacket(packet, { summaryOn: false })
    expect(off.summaryOn).toBe(false)
    expect(off.resume.lines.some((l) => l.kind === 'summary')).toBe(false)
    // The other fields SURVIVE the toggle — the exact amnesia the audit caught.
    expect(off.excludedBulletIds).toEqual(packet.excludedBulletIds)
    expect(off.bulletOverrides).toEqual(packet.bulletOverrides)
    expect(off.compilePlan).toBeDefined()
    expect(off.compilePlan!.order).toEqual([shippedProject.id])

    const on = await recompilePacket(off, { summaryOn: true })
    expect(on.resume.lines.some((l) => l.kind === 'summary')).toBe(true)
    expect(on.excludedBulletIds).toEqual(packet.excludedBulletIds)
  })

  it('a bullet-plan change keeps the professional summary on the page', async () => {
    const packet = packetWithState()
    const reordered = [...shippedProject.bullets.map((b) => b.id)].reverse()
    const after = await recompilePacket(packet, { planBullets: { [shippedProject.id]: reordered } })
    // Before A1, ANY Baithak op silently dropped the summary while summaryOn stayed true.
    expect(after.resume.lines.some((l) => l.kind === 'summary')).toBe(true)
    expect(after.summaryOn).toBe(true)
    expect(after.excludedBulletIds).toEqual(packet.excludedBulletIds)
  })

  it('a Nazar-excluded bullet stays off the page across recompiles', async () => {
    const packet = packetWithState()
    const excluded = shippedProject.bullets[0]
    const after = await recompilePacket(packet, { summaryOn: true })
    const bulletLines = after.resume.lines.filter((l) => l.kind === 'bullet' && l.ledgerIds.includes(shippedProject.id))
    expect(bulletLines.some((l) => l.text.includes(excluded.text.slice(0, 40)))).toBe(false)
  })

  it('an excluded-entry suppression survives an unrelated recompile', async () => {
    const skill = SEED_LEDGER.find((e) => e.kind === 'skill' && e.resumeEligible && e.tier === 'shipped')!
    const packet = { ...packetWithState(), excludedIds: [skill.id] }
    const after = await recompilePacket(packet, { summaryOn: true })
    expect(after.excludedIds).toEqual([skill.id])
    expect(after.resume.lines.some((l) => l.ledgerIds.includes(skill.id))).toBe(false)
  })
})

describe('A2 — the letter passes the same hygiene gates as the résumé', () => {
  const dirtyLedger: LedgerEntry[] = SEED_LEDGER.map((e) =>
    e.id === shippedProject.id
      ? {
          ...e,
          summary: '**A truth-first AI assistant** · sifarish-shv-s-projects.vercel.app** ▶ Live: something',
          bullets: [{ ...e.bullets[0], text: '**Implemented guardrails** that tag every line with `ledger IDs`' }, ...e.bullets.slice(1)],
          evidence: { ...(e.evidence ?? { date: '2026-07', note: '' }), url: 'https://sifarish.vercel.app**' },
        }
      : e,
  )
  const job = fakeJob('DirtyCo', 'AI Engineer', 'Python, LLM, RAG, evals.')
  const decode = decodeJD(job.jd)
  const coverage = matchEvidence(decode, dirtyLedger)

  it('compileCoverLetter renders no markdown residue and a clean URL', () => {
    const letter = compileCoverLetter(job, SEED_IDENTITY, dirtyLedger, decode, coverage, null, VISION)
    const text = letter.paragraphs.map((p) => p.text).join('\n')
    expect(text).not.toMatch(/\*\*/)
    expect(text).not.toMatch(/`/)
    expect(text).not.toMatch(/vercel\.app\*\*/)
  })

  it('composeLetter (atelier) is equally clean and reads the vision window, not a hardcoded year', () => {
    const letter = composeLetter({ job, identity: SEED_IDENTITY, ledger: dirtyLedger, decode, coverage, useSignature: false, vision: VISION })
    const text = letter.paragraphs.map((p) => p.text).join('\n')
    expect(text).not.toMatch(/\*\*/)
    if (/window is/.test(text)) expect(text).toContain('Feb 2027–Jun 2027')
    expect(text).not.toContain('January–May 2027')
  })

  it('outreach window follows the vision too', () => {
    const doc = compileOutreach(job, SEED_IDENTITY, SEED_LEDGER, decode, VISION)
    const text = doc.paragraphs[0].text
    expect(text).toContain('Feb 2027–Jun 2027')
    expect(text).not.toContain('Jan–May 2027')
  })
})

describe('A3 — polish re-enters the gate (sanitizer + twin rejection after the compiler)', () => {
  it('markdown from the polish LLM dies; a rewording that twins another line is rejected', async () => {
    const job = fakeJob('PolishCo', 'AI Engineer', 'Python, LLM agents, RAG, evals, TypeScript.')
    const base = compilePacketPure(job)
    await db.packets.put(base)
    const bulletIdx = base.resume.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === 'bullet' || l.kind === 'forge')
    expect(bulletIdx.length).toBeGreaterThanOrEqual(2)

    // The mock polish: line 0 comes back wearing markdown (legal otherwise); line 1 comes back
    // as an exact copy of line 0's text — a post-compile twin the page-wide MMR never saw.
    const polished = bulletIdx.map(({ l }, k) => {
      if (k === 0) return `**${l.text.replace(/^- /, '')}**`
      if (k === 1) return bulletIdx[0].l.text.replace(/^- /, '')
      return l.text.replace(/^- /, '')
    })
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ polished }) }) as Response)
    try {
      const { polishPacket } = await import('../src/lib/polish/client')
      const r = await polishPacket(base)
      const texts = r.packet.resume.lines.map((l) => l.text)
      expect(texts.join('\n')).not.toMatch(/\*\*/) // sanitizer ran post-polish
      // The twin candidate was rejected — line 1 keeps its original text.
      expect(r.packet.resume.lines[bulletIdx[1].i].text).toBe(bulletIdx[1].l.text)
      expect(r.rejected).toBeGreaterThanOrEqual(1)
    } finally {
      vi.stubGlobal('fetch', realFetch)
    }
  })
})

describe('A4 — phase-2 failure runs the deterministic floor and is VISIBLE', () => {
  it('floorPassPacket removes heuristic twins through the exclusion gate and stamps enhanceFailed', async () => {
    const twinProject: LedgerEntry = {
      ...shippedProject,
      id: 'proj-floor-twin',
      title: 'SANAD — floor fixture',
      bullets: [
        { id: 'fp-t1', text: TWIN_A, keywords: ['python'] },
        { id: 'fp-t2', text: TWIN_B, keywords: ['python'] },
      ],
    }
    await db.ledger.put(twinProject)
    try {
      const job = fakeJob('FloorCo', 'AI Engineer', 'Python, LLM.')
      const base = compilePacketPure(job)
      // A fast packet whose PAGE carries the twin pair (the compiler would not produce this,
      // but a pre-MMR packet from an old vault can) — the floor must catch it.
      const packet: Packet = {
        ...base,
        enhancing: true,
        resume: {
          ...base.resume,
          lines: [
            ...base.resume.lines,
            { kind: 'bullet', text: `- ${TWIN_A}`, ledgerIds: ['proj-floor-twin'] },
            { kind: 'bullet', text: `- ${TWIN_B}`, ledgerIds: ['proj-floor-twin'] },
          ],
        },
      }
      const after = await floorPassPacket(packet)
      expect(after.enhanceFailed).toBe(true)
      expect(after.enhancing).toBe(false)
      expect(after.excludedBulletIds ?? []).toContain('fp-t2')
      expect(after.gapNote.some((n) => n.includes('Nazar (floor)'))).toBe(true)
    } finally {
      await db.ledger.delete('proj-floor-twin')
    }
  })

  it('a clean packet just gets the honest stamp — nothing else changes', async () => {
    const job = fakeJob('CleanCo', 'AI Engineer', 'Python, LLM.')
    const base = { ...compilePacketPure(job), enhancing: true }
    const after = await floorPassPacket(base)
    expect(after.enhanceFailed).toBe(true)
    expect(after.resume.lines.map((l) => l.text)).toEqual(base.resume.lines.map((l) => l.text))
  })
})

describe('A5 — recompile red-team re-runs carry full context (source gate, D79 style)', () => {
  it('recompilePacket passes decode + archetype + inventory to redTeamPass', () => {
    const src = readFileSync('src/lib/darzi.ts', 'utf8')
    const recompileBody = src.slice(src.indexOf('export async function recompilePacket'))
    expect(recompileBody).toMatch(/redTeamPass\([\s\S]{0,220}packet\.decode/)
    expect(recompileBody).toContain('redTeamInventory(ledger, resume)')
  })
})

describe('A6 — the professional summary is JD-aware, deterministic, I1-clean', () => {
  const identity = SEED_IDENTITY
  const mk = (jd: string) => {
    const decode = decodeJD(jd)
    const coverage = matchEvidence(decode, SEED_LEDGER)
    return buildSummaryLine({ identity, vision: VISION, ledger: SEED_LEDGER, decode, coverage })
  }

  it('two different JDs produce two different emphases', () => {
    const a = mk('Must have: RAG, guardrails, evals. AI engineer role.')
    const b = mk('Must have: Python, transformers. ML role.')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.text).not.toBe(b!.text)
  })

  it('the emphasis names only PROVEN must-haves (I1) and no project names', () => {
    const line = mk('Must have: RAG, guardrails. AI engineer.')!
    // Whatever appears after "shipped proof in" must be a matched (evidence-backed) keyword.
    const m = /shipped proof in (.+)\./.exec(line.text)
    if (m) {
      const decode = decodeJD('Must have: RAG, guardrails. AI engineer.')
      const proven = matchEvidence(decode, SEED_LEDGER).matched.filter((h) => h.mustHave).map((h) => h.keyword.replace(/-/g, ' '))
      for (const named of m[1].split(' and ')) expect(proven).toContain(named)
    }
    for (const e of SEED_LEDGER.filter((x) => x.kind === 'project')) {
      expect(line.text.toUpperCase()).not.toContain(e.title.split('—')[0].trim().toUpperCase())
    }
  })

  it('no proven must-have → the timeless base stands alone (backward compatible)', () => {
    const line = mk('Must have: kubernetes, terraform. Platform role.')
    expect(line).not.toBeNull()
    expect(line!.text).not.toContain('shipped proof in')
  })
})

describe('A7 — vault residue dies on education/achievement/cert lines too', () => {
  it('an education summary carrying a URL and a "Live:" label renders clean', () => {
    const eduDirty: LedgerEntry[] = SEED_LEDGER.map((e) =>
      e.kind === 'education' ? { ...e, summary: `${e.summary ?? '2023–2027'} · see https://thapar.edu/page **bold**` } : e,
    )
    const decode = decodeJD('AI engineer. Python.')
    const resume = compileResume({ identity: SEED_IDENTITY, ledger: eduDirty, decode, coverage: matchEvidence(decode, eduDirty), jobId: 'j' })
    const text = resume.lines.map((l) => `${l.text} ${l.right ?? ''}`).join('\n')
    expect(text).not.toMatch(/https?:\/\//)
    expect(text).not.toMatch(/\*\*/)
  })
})

describe('A8 — ONE identity-ban heuristic (compiler + forge share it)', () => {
  it('derives the same token from a title and a repo slug', () => {
    expect(identityToken('SIFARISH — job-hunt chief of staff')).toBe('sifarish')
    expect(identityToken('spark-core')).toBe('spark')
    expect(isIdentityBullet('SIFARISH — chief of staff', 'Developed Sifarish, an agentic assistant')).toBe(true)
    expect(isIdentityBullet('SIFARISH — chief of staff', 'Engineered a two-tier LLM router')).toBe(false)
    // Short tokens never ban (a 3-letter name would false-positive everywhere).
    expect(isIdentityBullet('AI — thing', 'built ai stuff')).toBe(false)
  })

  it('both call sites import the shared rule (no private copies left)', () => {
    const compiler = readFileSync('src/lib/compile/compiler.ts', 'utf8')
    const forge = readFileSync('src/lib/nabz/forge.ts', 'utf8')
    expect(compiler).toContain('isIdentityBullet(')
    expect(forge).toContain('isIdentityBullet(')
    expect(forge).not.toMatch(/repo\.name\.replace\(\/\[-_\]/)
  })
})

describe('A9 — the Editor\'s plan dedupe is concept-aware (source gate)', () => {
  it('the surgery pick loop uses bulletOverlapSameProject', () => {
    const src = readFileSync('src/lib/darzi/editor.ts', 'utf8')
    const pickIdx = src.indexOf('const pickedBullets')
    expect(pickIdx).toBeGreaterThan(-1)
    expect(src.slice(pickIdx, pickIdx + 600)).toContain('bulletOverlapSameProject')
  })
})

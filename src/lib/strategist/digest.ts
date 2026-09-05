import type { Identity, LedgerEntry, VisionProfile } from '../../types'
import { cleanSummaryForDisplay, displayTitle } from '../compile/compiler'
import { derivedSkills } from '../dossier/skills'

/**
 * v2 THE STRATEGIST — `buildDigest()` is the ONE function that turns the dossier into what a
 * brain reads (ARCHITECTURE v2, authority 3). Deterministic, capped, every fact id present, so a
 * plan can only ever cite ids that exist. Anthropic's context-engineering guidance: the minimum
 * curated set per turn — never the raw vault.
 */

export interface DigestFact {
  id: string
  kind: string
  title: string
  summary: string
  date: string
  url: string
  stack: string[]
  bullets: { id: string; text: string }[]
  features: string[]
  /** R3 — the README depth the brain reads: the problem statement + capped prose. */
  problem: string
  readme: string
  sworn: string
}

export interface Digest {
  text: string
  facts: DigestFact[]
  /** Derived skill vocabulary with the fact ids proving each item. */
  skills: { text: string; factIds: string[] }[]
  ids: Set<string>
  bulletIds: Set<string>
}

const cap = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

export function digestFacts(ledger: LedgerEntry[]): DigestFact[] {
  return ledger
    .filter((e) => e.resumeEligible && e.tier === 'shipped')
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      title: displayTitle(e.title),
      summary: cleanSummaryForDisplay(e.summary ?? ''),
      date: e.evidence?.date ?? '',
      url: e.evidence?.url ?? e.evidence?.repo ?? '',
      stack: e.context?.stack ?? [],
      bullets: e.bullets.map((b) => ({ id: b.id, text: b.text })),
      features: (e.context?.features ?? []).slice(0, 6),
      problem: e.context?.problem ?? '',
      readme: e.context?.readme ?? '',
      sworn: e.sworn ?? 'owner',
    }))
}

/** Render the digest as the brain's reading material (~≤ 6k tokens for a rich dossier). */
export function buildDigest(ledger: LedgerEntry[], identity: Identity, vision?: VisionProfile): Digest {
  const facts = digestFacts(ledger)
  const skills = derivedSkills(ledger).map((s) => ({ text: s.text, factIds: s.factIds }))
  const lines: string[] = []
  lines.push(`CANDIDATE: ${identity.name} — ${identity.location}. GitHub ${identity.github}.`)
  if (vision?.dream) lines.push(`WHAT HE WANTS (his own words): ${cap(vision.dream, 600)}`)
  lines.push('')
  lines.push('FACTS (each line is one fact; cite by id; nothing outside this list is true):')
  const order = ['experience', 'project', 'achievement', 'education', 'position', 'certification']
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i === -1 ? (k === 'skill' ? 99 : 50) : i
  }
  for (const f of facts.filter((x) => x.kind !== 'skill').sort((a, b) => rank(a.kind) - rank(b.kind))) {
    const head = `[${f.id}] (${f.kind}${f.date ? `, ${f.date}` : ''}) ${f.title}`
    lines.push(head)
    if (f.summary) lines.push(`  what: ${cap(f.summary, 320)}`)
    if (f.stack.length) lines.push(`  stack: ${f.stack.slice(0, 10).join(', ')}`)
    if (f.url) lines.push(`  link: ${f.url}`)
    for (const b of f.bullets.slice(0, 6)) lines.push(`  - {${b.id}} ${cap(b.text, 260)}`)
    // R3 (hunter-caught): "unhe deeply padhe" — the README's problem statement and prose reached the
    // vault but never the brain. Every project now carries them (capped), not only thin ones.
    if (f.problem) lines.push(`  problem (his README): ${cap(f.problem, 300)}`)
    if (f.features.length) lines.push(`  notable (his README): ${f.features.map((x) => cap(x, 140)).join(' | ')}`)
    if (f.readme) lines.push(`  readme prose: ${cap(f.readme, 600)}`)
  }
  lines.push('')
  lines.push(`PROVEN SKILLS (text → fact ids): ${skills.slice(0, 80).map((s) => `${s.text} [${s.factIds.slice(0, 3).join(',')}]`).join('; ')}`)
  return {
    text: lines.join('\n'),
    facts,
    skills,
    ids: new Set(facts.map((f) => f.id)),
    bulletIds: new Set(facts.flatMap((f) => f.bullets.map((b) => b.id))),
  }
}

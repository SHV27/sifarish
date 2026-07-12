import type { CompiledResume, CompileQuality, CoverageReport, LedgerEntry, QualityItem } from '../../types'
import { scanSlop } from '../slop/scan'
import { startsStrong, startsWeak } from './library'

/**
 * COMPILE QUALITY (P13) — a transparent, rubric-based estimate of how well the compiled
 * resume executes the Ustaad craft patterns. HONEST BY DESIGN (I9): this measures "how well
 * did the compile execute the craft on the evidence it has", never an "ATS score" — real ATS
 * ranking varies by system, and the UI says so.
 *
 * The gap/choice distinction is the heart of it: points are only DOCKED for craft the compile
 * could have executed better. What the ledger cannot prove (a missing keyword, a bullet with
 * no real number behind it) is itemized as an evidence gap — Gap Note / Taleem territory —
 * because fixing it means shipping work, never inventing words (I1).
 *
 * Rubric (100):
 *   • JD keyword delivery (30) — evidenced must-haves that actually made the page.
 *   • Parse & structure (25)  — single-column contract, standard headings, dated + linked
 *     projects (¶single-column-ats, ¶live-links-are-proof).
 *   • Quantification (25)     — project bullets surface every real number the ledger holds
 *     (¶quantify-everything-honest).
 *   • Verb craft & anti-slop (20) — strong openers on project bullets, zero weak openers,
 *     zero slop (¶verb-strength-ladder, ¶action-verb-lead).
 */

const STANDARD_HEADINGS = new Set(['EDUCATION', 'SKILLS', 'PROJECTS', 'ACHIEVEMENTS', 'CERTIFICATIONS', 'EXPERIENCE'])

/** Lines belonging to the PROJECTS section — craft checks apply to prose bullets, not title-lines. */
function projectSection(resume: CompiledResume) {
  const titles: string[] = []
  const bullets: { text: string; ledgerIds: string[] }[] = []
  const metas: string[] = []
  let inProjects = false
  for (const l of resume.lines) {
    if (l.kind === 'heading') {
      inProjects = l.text.trim().toUpperCase() === 'PROJECTS'
      continue
    }
    if (!inProjects) continue
    if (l.kind === 'entry-title') titles.push(l.text)
    else if (l.kind === 'bullet') bullets.push({ text: l.text, ledgerIds: l.ledgerIds })
    else if (l.kind === 'meta') metas.push(l.text)
  }
  return { titles, bullets, metas }
}

export function estimateQuality(resume: CompiledResume, coverage: CoverageReport, ledger: LedgerEntry[] = []): CompileQuality {
  const items: QualityItem[] = []
  const { titles, bullets, metas } = projectSection(resume)
  const pageText = resume.lines.map((l) => l.text).join('\n').toLowerCase()
  const byId = new Map(ledger.map((e) => [e.id, e]))

  // ---- 1 · JD keyword delivery (30) — evidenced must-haves that made the page ----
  // A keyword only counts against the COMPILE if the ledger's own surface text contains it
  // (the compiler may reorder and select, never mint words — I1). Keywords whose evidence is
  // tag-only (the ledger never literally says the word) are itemized as phrasing gaps instead.
  const hasWord = (text: string, keyword: string): boolean => {
    const k = keyword.toLowerCase().replace(/-/g, ' ')
    const variants = [k, k.endsWith('s') ? k.slice(0, -1) : `${k}s`]
    return variants.some((v) => new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text))
  }
  // Only text the compiler can actually put on the page counts as deliverable:
  // projects render title+bullets; skills render title; the rest render title+summary.
  const renderable = (e: LedgerEntry): string => {
    if (e.kind === 'project') return `${e.title} ${e.bullets.map((b) => `${b.text} ${b.metrics ?? ''}`).join(' ')}`
    if (e.kind === 'skill' || e.kind === 'position') return e.title
    return `${e.title} ${e.summary}`
  }
  const ledgerSurface = (ids: string[]): string =>
    ids
      .map((id) => byId.get(id))
      .filter((e): e is LedgerEntry => !!e)
      .map(renderable)
      .join(' ')
      .replace(/-/g, ' ')
  const pageWords = pageText.replace(/-/g, ' ')
  const mustMatched = coverage.matched.filter((k) => k.mustHave)
  const deliverable = mustMatched.filter((k) => hasWord(ledgerSurface(k.ledgerIds), k.keyword))
  const delivered = deliverable.filter((k) => hasWord(pageWords, k.keyword))
  const phraseGaps = mustMatched.filter((k) => !hasWord(ledgerSurface(k.ledgerIds), k.keyword))
  const covPts = deliverable.length === 0 ? 30 : Math.round((delivered.length / deliverable.length) * 30)
  items.push({
    label: 'JD keyword delivery',
    points: covPts,
    max: 30,
    why:
      mustMatched.length === 0
        ? 'This JD has no must-have keywords with ledger evidence — nothing to deliver, full marks by absence.'
        : covPts === 30
          ? `All ${deliverable.length} evidenced must-have keywords that the ledger names are on the page.`
          : `${delivered.length}/${deliverable.length} deliverable must-haves made the page — the one-page trim dropped entries carrying the rest; consider promoting them (Casting Sheet).`,
    kind: covPts === 30 ? 'ok' : 'choice',
    patternId: 'skills-grouped-exact',
  })
  if (phraseGaps.length > 0) {
    items.push({
      label: 'Keyword phrasing gaps (→ ledger wording)',
      points: 0,
      max: 0,
      why: `Evidence exists for ${phraseGaps.map((k) => `"${k.keyword}"`).join(', ')} but the ledger's own wording never says the term, so the compiler cannot surface it (I1: no minted words). If the term truthfully describes the work, spell it out in the ledger entry — the JD spells it that way (Ustaad ¶skills-grouped-exact).`,
      kind: 'gap',
      patternId: 'skills-grouped-exact',
    })
  }
  const mustBuilding = coverage.building.filter((k) => k.mustHave).length
  const mustMissing = coverage.missing.filter((k) => k.mustHave).length
  if (mustBuilding > 0) {
    items.push({
      label: 'Keywords still in the forge',
      points: 0,
      max: 0,
      why: `${mustBuilding} must-have keyword(s) have only in-forge evidence — they render solely in the dated "Currently Building" line (I2) and graduate when the work ships.`,
      kind: 'choice',
      patternId: 'quantify-everything-honest',
    })
  }
  if (mustMissing > 0) {
    items.push({
      label: 'Evidence gaps (→ Gap Note)',
      points: 0,
      max: 0,
      why: `${mustMissing} must-have keyword(s) have zero ledger evidence, so they stay OFF the page (I1). The Gap Note names them; Taleem tracks whether they're worth learning.`,
      kind: 'gap',
      patternId: 'no-hidden-text',
    })
  }

  // ---- 2 · Parse & structure (25) ----
  let structPts = 0
  const structWhys: string[] = []
  structPts += 10
  structWhys.push('Single-column, table-free, parser-safe layout is structural (the compiler cannot emit anything else).')
  const headings = resume.lines.filter((l) => l.kind === 'heading').map((l) => l.text.trim().toUpperCase())
  const badHeadings = headings.filter((h) => !STANDARD_HEADINGS.has(h))
  if (badHeadings.length === 0) {
    structPts += 5
    structWhys.push('All section headings are ATS-standard.')
  } else {
    structWhys.push(`Non-standard heading(s): ${badHeadings.join(', ')} — parsers may misfile these sections.`)
  }
  const dated = titles.filter((t) => /\d{4}/.test(t)).length
  if (titles.length === 0 || dated === titles.length) {
    structPts += 5
    structWhys.push('Every project carries its date.')
  } else {
    structWhys.push(`${titles.length - dated} project(s) missing a date — add the ship date to the ledger evidence.`)
  }
  const linked = metas.filter((m) => /\w\.\w{2,}/.test(m)).length
  if (titles.length === 0 || linked >= titles.length) {
    structPts += 5
    structWhys.push('Every project shows a clickable evidence URL.')
  } else {
    structWhys.push(`${titles.length - linked} project(s) without a visible evidence URL — a shipped project without a link loses its strongest proof (attach one in Baithak; it will be liveness-probed).`)
  }
  const structKind: QualityItem['kind'] = structPts === 25 ? 'ok' : 'gap'
  items.push({
    label: 'Parse & structure',
    points: structPts,
    max: 25,
    why: structWhys.join(' '),
    kind: structKind,
    patternId: 'single-column-ats',
  })

  // ---- 3 · Quantification (25) — surface every real number the ledger holds ----
  const numbered = bullets.filter((b) => /\d/.test(b.text))
  const unnumbered = bullets.filter((b) => !/\d/.test(b.text))
  // An unnumbered bullet is a CRAFT miss only if its ledger entry holds numbers it didn't surface.
  const couldHaveNumber = unnumbered.filter((b) =>
    b.ledgerIds.some((id) => {
      const e = byId.get(id)
      return e?.bullets.some((lb) => /\d/.test(lb.text) || (lb.metrics && /\d/.test(lb.metrics)))
    }),
  )
  const evidenceGapBullets = unnumbered.length - couldHaveNumber.length
  // Only bullets that SKIPPED an available number dock craft points; numberless evidence is a gap item.
  const qPts = bullets.length === 0 ? 25 : Math.round(((bullets.length - couldHaveNumber.length) / bullets.length) * 25)
  items.push({
    label: 'Quantification',
    points: Math.min(25, qPts),
    max: 25,
    why:
      bullets.length === 0
        ? 'No project bullets compiled.'
        : `${numbered.length}/${bullets.length} project bullets carry a real number.${
            couldHaveNumber.length > 0
              ? ` ${couldHaveNumber.length} bullet(s) skipped a number the ledger DOES hold — reorder or pick the numbered bullet (Baithak can do this).`
              : ''
          }${
            evidenceGapBullets > 0
              ? ` ${evidenceGapBullets} bullet(s) have no evidenced number to surface — honest as written; add real metrics to the ledger when they exist (I1).`
              : ''
          }`,
    kind: qPts >= 25 ? 'ok' : couldHaveNumber.length > 0 ? 'choice' : 'gap',
    patternId: 'quantify-everything-honest',
  })
  if (evidenceGapBullets > 0 && qPts >= 25) {
    items.push({
      label: 'Unnumbered evidence (→ ledger)',
      points: 0,
      max: 0,
      why: `${evidenceGapBullets} bullet(s) carry no number because the ledger holds none for them. If a real metric exists (users, ms, %, count), add it to the ledger entry — never to the resume directly.`,
      kind: 'gap',
      patternId: 'quantify-everything-honest',
    })
  }

  // ---- 4 · Verb craft & anti-slop (20) ----
  let verbPts = 0
  const verbWhys: string[] = []
  const weak = bullets.map((b) => startsWeak(b.text)).filter((w): w is string => !!w)
  if (weak.length === 0) {
    verbPts += 8
    verbWhys.push('Zero weak openers ("worked on", "helped"…).')
  } else {
    verbWhys.push(`${weak.length} bullet(s) open weak (${[...new Set(weak)].join(', ')}) — rephrase in Baithak (fact-drift-guarded).`)
  }
  const strong = bullets.filter((b) => startsStrong(b.text)).length
  const strongPts = bullets.length === 0 ? 8 : Math.round((strong / bullets.length) * 8)
  verbPts += strongPts
  verbWhys.push(bullets.length === 0 ? 'No project bullets to judge.' : `${strong}/${bullets.length} project bullets open with a strong engineering verb.`)
  const slop = scanSlop(resume.lines.map((l) => l.text).join('\n'))
  if (slop.length === 0) {
    verbPts += 4
    verbWhys.push('Slop-scan clean.')
  } else {
    verbWhys.push(`Slop detected: ${slop.join(', ')}.`)
  }
  items.push({
    label: 'Verb craft & anti-slop',
    points: verbPts,
    max: 20,
    why: verbWhys.join(' '),
    kind: verbPts === 20 ? 'ok' : 'choice',
    patternId: 'verb-strength-ladder',
  })

  const score = items.reduce((n, i) => n + i.points, 0)
  return { score, items, at: new Date().toISOString() }
}

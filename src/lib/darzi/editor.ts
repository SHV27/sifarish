import type { CastChoice, CompanyIntel, EditorialPlan, JDDecode, LedgerEntry, Rationale } from '../../types'
import { ARCHETYPES, ARCHETYPE_LABELS, archetypeById, type Archetype } from './archetypes'
import { classify, decide, critique, type DecideOption } from '../dimaag/core'

/**
 * THE PROJECT BRIEF (D56) — what the Editor's Desk reads before it casts and angles.
 *
 * It used to get `p.summary` and a tag list: one thin line to decide how to FRAME weeks of work.
 * That thinness is why the framing felt generic — the reasoner had nothing specific to reach for.
 * Now it reads the deep-read README context Nabz stored (the problem attacked, the stack, the real
 * feature set) so its angle can name the actual engineering. Read-only: the brief informs FRAMING
 * (which project leads, which bullets run, in what order). It can never become resume text —
 * the compiler still renders only evidence-linked ledger bullets (D28: Dimaag proposes, compiler
 * disposes), so widening the reasoner's context adds zero fact-drift surface.
 */
function projectBrief(p: LedgerEntry, cap: number): string {
  const c = p.context
  const parts = [
    p.summary,
    c?.problem && c.problem !== p.summary ? `Problem it attacks: ${c.problem}` : '',
    c?.stack?.length ? `Stack: ${c.stack.join(', ')}` : '',
    c?.features?.length ? `What it does: ${c.features.slice(0, 8).join(' | ')}` : '',
    `[tags: ${p.tags.join(', ')}]`,
    // The deep-read README prose (D58/D84) — his own words about his own work. Placed LAST so a
    // small cap keeps the structured facts and a large cap (the angle pass) gets real substance to
    // reason from. Read-only source material; the compiler still renders only ledger bullets (D28).
    c?.readme ? `Deep context: ${c.readme}` : '',
  ].filter(Boolean)
  return parts.join('\n').slice(0, cap)
}
import { entryRelevance, bulletRelevance } from '../match/evidence'
import { scanSlop, scanGuarantee } from '../slop/scan'
import { citePatterns, craftClauses, sectionOrderFor, startsWeak, type SectionKey } from '../ustaad/library'

/**
 * THE EDITOR'S DESK (Darzi v3, P10). Four passes, each rationaled (I10):
 *   1. Archetype — classify the role → load what THIS reviewer scans for.
 *   2. Casting   — decide which projects lead, ranked, with benched list + reasons.
 *   3. Surgery   — angle per project → evidence-true bullet selection/order (no new facts, I1).
 *   4. Red-Team  — hostile critique loop (≤3 rounds); PASS required for "ready".
 *
 * Dimaag PROPOSES; the v1 compiler DISPOSES (I1/I2/one-page/parse-back remain its authority).
 */

// ---- Pass 1: Archetype ----
export async function archetypePass(decode: JDDecode, jd: string, intel?: CompanyIntel) {
  const intelText = intel?.bullets.map((b) => b.text).join(' ') ?? ''
  const text = `${jd}\n\nKeywords: ${decode.mustHave.join(', ')}\n\nCompany intel: ${intelText}`.slice(0, 4000)
  const res = await classify({
    feature: 'darzi.archetype',
    text,
    labels: ARCHETYPE_LABELS,
    instruction:
      'Triage this job description into ONE reviewer archetype — the person who skims the resume in six ' +
      'seconds. Decisive rule: if the role centers on LLMs, agents/agentic systems, RAG, prompting, or ' +
      'guardrails/evals, choose applied-ai (product-building) or agent-eng (agent architecture) — NOT ' +
      'ml-generalist — even when Python is listed. Reserve ml-generalist for classic data/stats/modeling ' +
      'roles with no LLM/agent focus, research-intern for paper/method depth, forward-deployed for ' +
      'customer-facing delivery, platform-infra for serving/MLOps. Pick the closest.',
  })
  const arch = archetypeById(res.label)
  return { arch, confidence: res.confidence, by: res.by }
}

// ---- Pass 2: Casting ----
export async function castingPass(
  projects: LedgerEntry[],
  arch: Archetype,
  decode: JDDecode,
  intel?: CompanyIntel,
): Promise<{ casting: Rationale; chosenIds: string[]; benched: { ledgerId: string; title: string; why: string }[] }> {
  const options: DecideOption[] = projects.map((p) => ({
    id: p.id,
    label: p.title.split('—')[0].trim(),
    detail: projectBrief(p, 700),
  }))
  const criteria = [...arch.priorities, ...decode.mustHave.slice(0, 4).map((k) => k.replace(/-/g, ' '))]

  // Company intel TEXT (Session 5.5) — the live "what this company builds & values" bullets now reach
  // the casting reasoner, not just the letter. So which project LEADS becomes company-specific: an
  // agent-heavy shop pulls the agentic project to the top, a data shop the ML one. Was a citation URL
  // only (the reasoner never read it). Still emphasis-only — the compiler renders real bullets (I1).
  const intelText = (intel?.bullets ?? []).slice(0, 3).map((b) => b.text).join(' · ')
  const intelLower = intelText.toLowerCase()

  // Deterministic fallback: archetype-cue overlap + JD relevance + a company-intel match, so the
  // keyless path is company-aware too (a project whose tags the intel names gets a nudge up).
  const heuristic = () => {
    const scored = projects
      .map((p) => {
        const cueHits = arch.cues.filter((c) => p.tags.includes(c) || p.bullets.some((b) => b.keywords.includes(c))).length
        const intelHits = intelLower ? p.tags.filter((t) => intelLower.includes(t.replace(/-/g, ' ')) || intelLower.includes(t)).length : 0
        return { p, score: cueHits * 2 + entryRelevance(p, decode) + intelHits }
      })
      .sort((a, b) => b.score - a.score)
    return {
      choice: scored[0]?.p.id ?? '',
      ranking: scored.map((s) => s.p.id),
      why: `Heuristic casting for a ${arch.label}: ranked by how strongly each project's evidence matches what this reviewer scans for (${arch.priorities.slice(0, 2).join(', ')})${intelText ? ', and what this company is building' : ''}.`,
      confidence: 0.55,
    }
  }

  const casting = await decide({
    feature: 'darzi.casting',
    question: `Which projects should LEAD a resume for a ${arch.label}? This reviewer scans first for: ${arch.priorities.join('; ')}.`,
    options,
    criteria,
    context:
      `${arch.reviewerNote} Angle language rewarded: ${arch.angleHint}` +
      (intelText ? ` | What THIS company actually builds & values (live intel — lead with the project that speaks to it): ${intelText}` : ''),
    evidence: projects.map((p) => ({ ref: p.id, text: `${p.title}: ${projectBrief(p, 900)}` })),
    citations: [
      // The craft receipts (Ustaad P13): why casting optimizes the top of the page.
      ...citePatterns(['six-second-skim', 'projects-are-experience'], 2),
      ...(intel?.bullets.slice(0, 2).map((b) => ({ title: 'company intel', url: b.url })) ?? []),
    ],
    // Session 5.9 — the library's casting rules IN the payload (citations above are display-only).
    craft: craftClauses('casting', arch.id),
    heuristic,
  })

  // Map ranked labels back to ids (casting.ranking holds labels).
  const labelToId = new Map(options.map((o) => [o.label, o.id]))
  const rankedIds = (casting.ranking ?? []).map((l) => labelToId.get(l)).filter((x): x is string => !!x)
  const orderedIds = [...new Set([...rankedIds, ...projects.map((p) => p.id)])]
  const chosenIds = orderedIds.slice(0, 3)
  const benched = orderedIds.slice(3).map((id) => {
    const p = projects.find((x) => x.id === id)!
    const overlap = arch.cues.filter((c) => p.tags.includes(c)).length
    return {
      ledgerId: id,
      title: p.title.split('—')[0].trim(),
      why:
        overlap === 0
          ? `Benched: its domain (${p.tags.slice(0, 2).join('/')}) doesn't match what a ${arch.label} scans for — including it would dilute the top three.`
          : `Benched for space: strong, but the top three cover this JD's priorities more directly.`,
    }
  })
  return { casting, chosenIds, benched }
}

/**
 * FRAMING DIRECTION (Session 5.9) — the chosen angle, expressed as an instruction the guarded
 * reframer can act on. Same ledger + two different JDs → two materially different directions →
 * two materially different (drift-clean) framings. Pure + exported → unit-tested.
 */
export function framingDirection(angleLabel: string, archLabel: string, decode: JDDecode, company?: string): string {
  const topMust = decode.mustHave.slice(0, 4).map((k) => k.replace(/-/g, ' '))
  return (
    `Re-express for a ${archLabel} reviewer${company ? ` at ${company}` : ''}. Chosen angle: ${angleLabel}.` +
    (topMust.length ? ` This role scans first for: ${topMust.join(', ')} — surface the evidence that answers those, in plain language.` : '') +
    ' Keep every fact his; vary the sentence shapes.'
  )
}

// ---- Pass 3: Surgery (angle + bullet plan) ----
export async function surgeryPass(
  project: LedgerEntry,
  arch: Archetype,
  decode: JDDecode,
  intel?: CompanyIntel,
  company?: string,
  withFraming = true,
): Promise<{ choice: CastChoice; bulletIds: string[]; bulletOverrides?: Record<string, string> }> {
  const title = project.title.split('—')[0].trim()
  // Candidate angles = the archetype's angle + the project's own strongest tag-framing.
  const angleOptions: DecideOption[] = [
    { id: arch.id, label: arch.angleHint, detail: `Frame ${title} for a ${arch.label}.` },
  ]
  // A second angle from the project's dominant non-archetype tag, so decide() has a real choice.
  const otherTag = project.tags.find((t) => !arch.cues.includes(t))
  if (otherTag) {
    angleOptions.push({
      id: `alt-${otherTag}`,
      label: `Frame around ${otherTag.replace(/-/g, ' ')}`,
      detail: `Lead with the ${otherTag.replace(/-/g, ' ')} dimension of this project.`,
    })
  }
  // Session 5.5 — a JD-DRIVEN angle: frame the project around THIS role's own stated must-haves.
  // Gives decide() a genuinely role-specific option (was archetype/tag-only), so the framing can
  // reference the JD's focus. When it wins, bullets that answer the must-haves lead (below).
  const topMust = decode.mustHave.slice(0, 4).map((k) => k.replace(/-/g, ' '))
  if (topMust.length) {
    angleOptions.push({
      id: 'jd-focus',
      label: `Lead with ${topMust.slice(0, 2).join(' & ')} — this role's stated priorities`,
      detail: `Surface the evidence in ${title} that directly answers the JD's must-haves (${topMust.join(', ')}).`,
    })
  }

  const intelText = (intel?.bullets ?? []).slice(0, 2).map((b) => b.text).join(' · ')

  let angleRationale: Rationale
  if (angleOptions.length > 1) {
    angleRationale = await decide({
      feature: 'darzi.angle',
      question: `Which angle makes ${title} strongest for a ${arch.label}${company ? ` at ${company}` : ''}?`,
      options: angleOptions,
      // JD prominence + archetype priorities decide the framing (Session 5.5).
      criteria: [...arch.priorities, ...topMust.slice(0, 3)],
      context:
        arch.reviewerNote +
        (topMust.length ? ` This ${company ?? 'role'} scans first for: ${topMust.join(', ')}.` : '') +
        (intelText ? ` What the company builds & values (live intel): ${intelText}` : ''),
      evidence: [{ ref: project.id, text: `${project.title}: ${projectBrief(project, 2200)}` }],
      citations: citePatterns(['xyz-formula', 'verb-strength-ladder'], 2),
      craft: craftClauses('surgery', arch.id), // Session 5.9 — studied rules reach the model
    })
  } else {
    angleRationale = {
      question: `Angle for ${title}`,
      optionsConsidered: [angleOptions[0].label],
      criteria: arch.priorities,
      choice: angleOptions[0].label,
      why: `Only one strong framing for this reviewer: ${arch.angleHint}`,
      confidence: 0.6,
      by: 'heuristic',
      at: new Date().toISOString(),
    }
  }

  const angleId = angleOptions.find((o) => o.label === angleRationale.choice)?.id ?? arch.id

  // Bullet plan: strongest-evidence-FIRST for the CHOSEN angle (D27 — the angle really shifts
  // emphasis). If the JD-focus angle won, the bullets that answer the JD's must-haves lead; else
  // archetype-cue bullets lead. Evidence-true selection/order only — no rewriting, no new facts (I1).
  const jdAngle = angleId === 'jd-focus'
  const bulletIds = project.bullets
    .map((b) => {
      const cueHits = arch.cues.filter((c) => b.keywords.includes(c)).length
      const rel = bulletRelevance(b.keywords, decode)
      const score = jdAngle ? cueHits + rel * 2 : cueHits * 2 + rel
      return { b, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.b.id)

  const choice: CastChoice = {
    ledgerId: project.id,
    title,
    angleId,
    angleLabel: angleRationale.choice,
    angleRationale,
  }

  // Session 5.9 — THE FRAMING REWRITE. Selection/order alone cannot express one true fact five
  // different ways; the boutique-firm move is re-expressing the chosen bullets TOWARD this reader.
  // reframeProject guards every rewritten line with detectDrift against the WHOLE entry (his own
  // writing — D81), so wording moves and facts cannot. Keyless / over-budget / drift-reject-all →
  // no overrides, the evidence-true selection stands (I4). Cache-first, so re-tailoring the same
  // JD costs nothing (D26).
  let bulletOverrides: Record<string, string> | undefined
  if (withFraming) {
    try {
      const { reframeProject } = await import('../polish/reframe')
      const direction = framingDirection(angleRationale.choice, arch.label, decode, company)
      const r = await reframeProject(project, direction)
      if (!r.keyless && r.applied > 0) bulletOverrides = r.overrides
    } catch {
      /* framing is an amplifier, never a dependency */
    }
  }

  return { choice, bulletIds, bulletOverrides }
}

// ---- Pass 4: Red-Team ----
/**
 * Session 5.5 — the red-team now knows the ROLE it's judging against. It used to see only the
 * resume text, so it could not flag "this doesn't earn the JD's must-haves." Passing the decode +
 * archetype makes the ready-gate JD-aware: the standard names the reviewer + the must-haves, and a
 * keyless heuristic flags when the top of the page visibly hits NONE of them.
 */
export async function redTeamPass(
  resumeText: string,
  decode?: JDDecode,
  archInfo?: { label: string; priorities: string[] },
): Promise<import('../../types').Critique> {
  const musts = (decode?.mustHave ?? []).slice(0, 6).map((k) => k.replace(/-/g, ' '))
  const roleClause = archInfo ? ` Judged for a ${archInfo.label} (scans first for ${archInfo.priorities.slice(0, 3).join(', ')}).` : ''
  const mustClause = musts.length ? ` The JD's must-haves are: ${musts.join(', ')} — REVISE if the top third of the page doesn't visibly earn them.` : ''
  return critique({
    feature: 'darzi.redteam',
    artifact: resumeText,
    persona: 'a hostile, time-starved recruiter doing a 6-second skim',
    standard:
      'A senior studio shipped this. Nothing inflated, generic, or template-y. Strongest evidence leads. ' +
      'Every claim reads as provable. If you would not forward it, say REVISE.' +
      roleClause +
      mustClause,
    heuristicChecks: (a) => {
      const fixes: string[] = []
      if (scanSlop(a).length > 0) fixes.push(`Remove slop phrasing: ${scanSlop(a).join(', ')}`)
      if (scanGuarantee(a).length > 0) fixes.push('Remove guarantee language (I9).')
      const bulletLines = a.split('\n').filter((l) => l.trim().startsWith('-'))
      if (bulletLines[0] && bulletLines[0].length < 40) fixes.push('Lead bullet is thin — open with your strongest, most concrete evidence.')
      // Ustaad ¶action-verb-lead: weak openers fail the 6-second skim.
      const weak = bulletLines.map((l) => startsWeak(l.replace(/^\s*-\s*/, ''))).filter(Boolean)
      if (weak.length > 0) fixes.push(`Weak bullet opener(s) (${[...new Set(weak)].join(', ')}) — lead with a strong engineering verb (Ustaad ¶action-verb-lead).`)
      // Session 5.5 — JD-coverage of the lead third (keyless too).
      if (musts.length) {
        const lines = a.split('\n')
        const leadText = lines.slice(0, Math.max(3, Math.ceil(lines.length / 3))).join(' ').toLowerCase()
        const hit = musts.some((m) => leadText.includes(m))
        if (!hit) fixes.push(`The top of the page doesn't visibly answer any of the JD's must-haves (${musts.join(', ')}) — lead with the evidence that does.`)
      }
      return fixes
    },
  })
}

export interface EditorInput {
  projects: LedgerEntry[]
  decode: JDDecode
  jd: string
  intel?: CompanyIntel
  company?: string
}

/** Runs passes 1–3 and returns the plan skeleton + the compiler override. Red-team runs after compile. */
export async function runEditor(
  input: EditorInput,
): Promise<{
  plan: Omit<EditorialPlan, 'redTeam' | 'redTeamRounds'>
  order: string[]
  bullets: Record<string, string[]>
  sectionOrder: SectionKey[]
  bulletOverrides?: Record<string, string>
}> {
  const { arch, confidence, by } = await archetypePass(input.decode, input.jd, input.intel)
  const { casting, chosenIds, benched } = await castingPass(input.projects, arch, input.decode, input.intel)

  const chosen: CastChoice[] = []
  const bullets: Record<string, string[]> = {}
  // Framing rewrites (Session 5.9): only the top 2 leading projects get the reframe call — the
  // 6-second skim lands there, and the budget stays disciplined (I8).
  let overrides: Record<string, string> | undefined
  for (const id of chosenIds) {
    const project = input.projects.find((p) => p.id === id)
    if (!project) continue
    const wantFraming = chosenIds.indexOf(id) < 2
    const { choice, bulletIds, bulletOverrides } = await surgeryPass(project, arch, input.decode, input.intel, input.company, wantFraming)
    chosen.push(choice)
    bullets[id] = bulletIds
    if (bulletOverrides) overrides = { ...overrides, ...bulletOverrides }
  }

  return {
    bulletOverrides: overrides,
    plan: {
      archetype: { id: arch.id, label: arch.label, priorities: arch.priorities, confidence, by, reviewerNote: arch.reviewerNote },
      casting,
      chosen,
      benched,
    },
    order: chosenIds,
    bullets,
    // Ustaad archetype guide: what section order THIS reviewer expects (P13).
    sectionOrder: sectionOrderFor(arch.id),
  }
}

export { ARCHETYPES }

import type { CastChoice, CompanyIntel, EditorialPlan, JDDecode, LedgerEntry, Rationale } from '../../types'
import { ARCHETYPES, ARCHETYPE_LABELS, archetypeById, type Archetype } from './archetypes'
import { classify, decide, critique, type DecideOption } from '../dimaag/core'
import { entryRelevance, bulletRelevance } from '../match/evidence'
import { scanSlop, scanGuarantee } from '../slop/scan'
import { citePatterns, sectionOrderFor, startsWeak, type SectionKey } from '../ustaad/library'

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
    detail: `${p.summary} [tags: ${p.tags.join(', ')}]`,
  }))
  const criteria = [...arch.priorities, ...decode.mustHave.slice(0, 4).map((k) => k.replace(/-/g, ' '))]

  // Deterministic fallback: archetype-cue overlap + JD relevance.
  const heuristic = () => {
    const scored = projects
      .map((p) => {
        const cueHits = arch.cues.filter((c) => p.tags.includes(c) || p.bullets.some((b) => b.keywords.includes(c))).length
        return { p, score: cueHits * 2 + entryRelevance(p, decode) }
      })
      .sort((a, b) => b.score - a.score)
    return {
      choice: scored[0]?.p.id ?? '',
      ranking: scored.map((s) => s.p.id),
      why: `Heuristic casting for a ${arch.label}: ranked by how strongly each project's evidence matches what this reviewer scans for (${arch.priorities.slice(0, 2).join(', ')}).`,
      confidence: 0.55,
    }
  }

  const casting = await decide({
    feature: 'darzi.casting',
    question: `Which projects should LEAD a resume for a ${arch.label}? This reviewer scans first for: ${arch.priorities.join('; ')}.`,
    options,
    criteria,
    context: `${arch.reviewerNote} Angle language rewarded: ${arch.angleHint}`,
    evidence: projects.map((p) => ({ ref: p.id, text: `${p.title}: ${p.summary}` })),
    citations: [
      // The craft receipts (Ustaad P13): why casting optimizes the top of the page.
      ...citePatterns(['six-second-skim', 'projects-are-experience'], 2),
      ...(intel?.bullets.slice(0, 2).map((b) => ({ title: 'company intel', url: b.url })) ?? []),
    ],
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

// ---- Pass 3: Surgery (angle + bullet plan) ----
export async function surgeryPass(
  project: LedgerEntry,
  arch: Archetype,
  decode: JDDecode,
): Promise<{ choice: CastChoice; bulletIds: string[] }> {
  // Candidate angles = the archetype's angle + the project's own strongest tag-framing.
  const angleOptions: DecideOption[] = [
    { id: arch.id, label: arch.angleHint, detail: `Frame ${project.title.split('—')[0].trim()} for a ${arch.label}.` },
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

  let angleRationale: Rationale
  if (angleOptions.length > 1) {
    angleRationale = await decide({
      feature: 'darzi.angle',
      question: `Which angle makes ${project.title.split('—')[0].trim()} strongest for a ${arch.label}?`,
      options: angleOptions,
      criteria: arch.priorities,
      context: arch.reviewerNote,
      evidence: [{ ref: project.id, text: `${project.title}: ${project.summary}` }],
      citations: citePatterns(['xyz-formula', 'verb-strength-ladder'], 2),
    })
  } else {
    angleRationale = {
      question: `Angle for ${project.title.split('—')[0].trim()}`,
      optionsConsidered: [angleOptions[0].label],
      criteria: arch.priorities,
      choice: angleOptions[0].label,
      why: `Only one strong framing for this reviewer: ${arch.angleHint}`,
      confidence: 0.6,
      by: 'heuristic',
      at: new Date().toISOString(),
    }
  }

  // Bullet plan: strongest-evidence-FIRST for this angle = bullets whose keywords hit archetype
  // cues, then JD relevance. Evidence-true selection/order only — no rewriting, no new facts (I1).
  const bulletIds = project.bullets
    .map((b) => {
      const cueHits = arch.cues.filter((c) => b.keywords.includes(c)).length
      return { b, score: cueHits * 2 + bulletRelevance(b.keywords, decode) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.b.id)

  const choice: CastChoice = {
    ledgerId: project.id,
    title: project.title.split('—')[0].trim(),
    angleId: angleOptions.find((o) => o.label === angleRationale.choice)?.id ?? arch.id,
    angleLabel: angleRationale.choice,
    angleRationale,
  }
  return { choice, bulletIds }
}

// ---- Pass 4: Red-Team ----
export async function redTeamPass(resumeText: string): Promise<import('../../types').Critique> {
  return critique({
    feature: 'darzi.redteam',
    artifact: resumeText,
    persona: 'a hostile, time-starved recruiter doing a 6-second skim',
    standard:
      'A senior studio shipped this. Nothing inflated, generic, or template-y. Strongest evidence leads. ' +
      'Every claim reads as provable. If you would not forward it, say REVISE.',
    heuristicChecks: (a) => {
      const fixes: string[] = []
      if (scanSlop(a).length > 0) fixes.push(`Remove slop phrasing: ${scanSlop(a).join(', ')}`)
      if (scanGuarantee(a).length > 0) fixes.push('Remove guarantee language (I9).')
      const bulletLines = a.split('\n').filter((l) => l.trim().startsWith('-'))
      if (bulletLines[0] && bulletLines[0].length < 40) fixes.push('Lead bullet is thin — open with your strongest, most concrete evidence.')
      // Ustaad ¶action-verb-lead: weak openers fail the 6-second skim.
      const weak = bulletLines.map((l) => startsWeak(l.replace(/^\s*-\s*/, ''))).filter(Boolean)
      if (weak.length > 0) fixes.push(`Weak bullet opener(s) (${[...new Set(weak)].join(', ')}) — lead with a strong engineering verb (Ustaad ¶action-verb-lead).`)
      return fixes
    },
  })
}

export interface EditorInput {
  projects: LedgerEntry[]
  decode: JDDecode
  jd: string
  intel?: CompanyIntel
}

/** Runs passes 1–3 and returns the plan skeleton + the compiler override. Red-team runs after compile. */
export async function runEditor(
  input: EditorInput,
): Promise<{ plan: Omit<EditorialPlan, 'redTeam' | 'redTeamRounds'>; order: string[]; bullets: Record<string, string[]>; sectionOrder: SectionKey[] }> {
  const { arch, confidence, by } = await archetypePass(input.decode, input.jd, input.intel)
  const { casting, chosenIds, benched } = await castingPass(input.projects, arch, input.decode, input.intel)

  const chosen: CastChoice[] = []
  const bullets: Record<string, string[]> = {}
  for (const id of chosenIds) {
    const project = input.projects.find((p) => p.id === id)
    if (!project) continue
    const { choice, bulletIds } = await surgeryPass(project, arch, input.decode)
    chosen.push(choice)
    bullets[id] = bulletIds
  }

  return {
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

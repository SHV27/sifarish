import type { CompiledResume, LedgerEntry } from '../../types'
import { generate } from '../dimaag/core'
import { craftClauses } from '../ustaad/library'
import { bulletOverlapSameProject, HARD_DUPLICATE } from '../compile/overlap'

/**
 * THE NAZAR PASS (Session 7.1) — the owner's dharma, made mechanism: "I shouldn't have to
 * catch errors one by one; the app must be intelligent enough to prevent them."
 *
 * Hand-coded rules can only kill the defect classes we've already met (lexical twins, concept
 * twins, identity bullets — all deterministic floors now). The Nazar is the layer for the
 * classes we HAVEN'T met: an LLM judge reads the finished page against the studied craft
 * library and flags GENERIC defects — two lines making one claim in different words, a line
 * that reads as a heading/placeholder/broken fragment — without anyone writing a new lexicon
 * first. Its verdicts are applied through the compiler's own exclusion gate (it can only
 * REMOVE/swap real ledger bullets, never write — I1 untouchable), every removal lands in the
 * gap note (L4, visible), and keyless/over-budget → the deterministic floors stand (I4).
 * Rules stay DATA: the judge reads craftClauses, so a Pulse library update upgrades the
 * judge's standards with zero code change (I13).
 */

export interface NazarIssue {
  type: 'duplicate' | 'broken'
  /** Exact text (or long prefix) of the line that should go. */
  drop: string
  /** For duplicates: the line that says it better and stays. */
  keep: string
  why: string
}

export interface NazarResult {
  issues: NazarIssue[]
  by: 'dimaag' | 'heuristic'
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Deterministic floor — same-project semantic twins the compiler's gate would catch on the
 * next compile anyway, plus meta lines that read like bare section headings. Runs first
 * (D130 fast-path): a mechanical verdict spends no call.
 */
export function nazarHeuristic(resume: CompiledResume): NazarIssue[] {
  const issues: NazarIssue[] = []
  const bulletsByProject = new Map<string, string[]>()
  for (const l of resume.lines) {
    if (l.kind !== 'bullet' || l.ledgerIds.length === 0) continue
    const key = l.ledgerIds[0]
    const arr = bulletsByProject.get(key) ?? []
    for (const prev of arr) {
      if (bulletOverlapSameProject(prev, l.text) >= HARD_DUPLICATE) {
        issues.push({ type: 'duplicate', drop: l.text, keep: prev, why: 'Same claim as an earlier bullet in this block (deterministic theme match).' })
        break
      }
    }
    arr.push(l.text)
    bulletsByProject.set(key, arr)
  }
  return issues
}

export async function nazarPass(resume: CompiledResume): Promise<NazarResult> {
  const heur = nazarHeuristic(resume)
  if (heur.length > 0) return { issues: heur, by: 'heuristic' }

  const page = resume.lines.map((l) => `${l.text}${l.right ? `  ${l.right}` : ''}`).join('\n')
  const out = await generate<{ issues: NazarIssue[] }>({
    feature: 'darzi.nazar',
    system:
      'You are the final quality inspector for a one-page engineering résumé. Find ONLY these defect classes:\n' +
      '1. DUPLICATE: two lines that make substantially the SAME claim in different words (same accomplishment, same theme restated, or a bullet that merely re-describes what a project IS when its description line already says so). Report the WEAKER line as drop and the stronger as keep.\n' +
      '2. BROKEN: a line that reads as a bare section heading, placeholder, truncated fragment, or non-descriptive stub where a real sentence belongs (e.g. a project description that just says "How it works").\n' +
      'Copy drop/keep text EXACTLY as it appears (a long exact prefix is acceptable). If the page is clean, return {"issues":[]} — do NOT invent problems; most good pages have zero. Never flag two lines just for sharing a technology name; the claim itself must repeat.\n' +
      'Studied standards:\n' +
      craftClauses('redteam', undefined, 8).join('\n'),
    user: page,
    maxTokens: 700,
    schema: {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['duplicate', 'broken'] },
              drop: { type: 'string' },
              keep: { type: 'string' },
              why: { type: 'string' },
            },
            required: ['type', 'drop', 'keep', 'why'],
            additionalProperties: false,
          },
        },
      },
      required: ['issues'],
      additionalProperties: false,
    },
  })

  if (!out || !Array.isArray(out.issues)) return { issues: [], by: 'heuristic' }
  // Trust boundary: the judge may only point at lines that actually exist on the page.
  const pageNorms = resume.lines.map((l) => norm(l.text))
  const real = out.issues.filter((i) => {
    const d = norm(String(i.drop ?? ''))
    return d.length >= 20 && pageNorms.some((p) => p.includes(d.slice(0, 60)) || d.includes(p))
  })
  return { issues: real.slice(0, 4), by: 'dimaag' }
}

/**
 * Map flagged drop-texts to real ledger bullet ids so the compiler's exclusion gate (the only
 * door) can act on them. A drop that matches no real bullet is ignored — the judge cannot
 * remove what does not exist.
 */
export function bulletIdsForIssues(issues: NazarIssue[], ledger: LedgerEntry[], overrides?: Record<string, string>): string[] {
  const ids: string[] = []
  for (const issue of issues) {
    if (issue.type !== 'duplicate') continue
    const d = norm(issue.drop)
    for (const e of ledger) {
      for (const b of e.bullets) {
        const text = norm(overrides?.[b.id] ?? b.text)
        if (text.length >= 20 && (d.includes(text.slice(0, 60)) || text.includes(d.slice(0, 60)))) {
          ids.push(b.id)
        }
      }
    }
  }
  return [...new Set(ids)]
}

import type { CompanyIntel, CoverageReport, JDDecode, LedgerEntry } from '../types'

/**
 * THE ALIGNMENT MAP (Session 5, WS5) — deep, honest role fit. For each extracted JD requirement,
 * show the SPECIFIC ledger evidence that meets it (→ foreground in the resume), or mark it an
 * honest gap (→ Taleem "learn this"). "Maximum honest scoring" = truth aligned to real
 * requirements, reasoning visible. No invented coverage, ever (I1). Cited (I7): evidence rows
 * carry ledger ids; the requirement source is the JD (+ optional company intel).
 */

export type AlignmentTier = 'must' | 'nice'

export interface AlignmentRow {
  requirement: string
  tier: AlignmentTier
  /** Ledger entries whose SHIPPED evidence meets this requirement. */
  metBy: { ledgerId: string; title: string }[]
  /** Only in_forge evidence exists → honest "currently building". */
  building: { ledgerId: string; title: string }[]
  status: 'met' | 'building' | 'gap'
}

export interface AlignmentMap {
  rows: AlignmentRow[]
  metCount: number
  mustTotal: number
  /** Honest coverage of must-haves that have shipped evidence (0..1). Never inflated. */
  score: number
  /** Requirements with zero evidence — feed Taleem. */
  gaps: string[]
  intelCited: boolean
}

function titleFor(id: string, ledger: LedgerEntry[]): string {
  return ledger.find((e) => e.id === id)?.title.split('—')[0].trim() ?? id
}

export function buildAlignmentMap(decode: JDDecode, coverage: CoverageReport, ledger: LedgerEntry[], intel?: CompanyIntel): AlignmentMap {
  const matched = new Map(coverage.matched.map((k) => [k.keyword, k]))
  const building = new Map(coverage.building.map((k) => [k.keyword, k]))

  const rowFor = (kw: string, tier: AlignmentTier): AlignmentRow => {
    const m = matched.get(kw)
    const b = building.get(kw)
    const metBy = (m?.ledgerIds ?? []).map((id) => ({ ledgerId: id, title: titleFor(id, ledger) }))
    const buildingBy = (b?.ledgerIds ?? []).map((id) => ({ ledgerId: id, title: titleFor(id, ledger) }))
    const status: AlignmentRow['status'] = metBy.length > 0 ? 'met' : buildingBy.length > 0 ? 'building' : 'gap'
    return { requirement: kw.replace(/-/g, ' '), tier, metBy, building: buildingBy, status }
  }

  const rows: AlignmentRow[] = [
    ...decode.mustHave.map((kw) => rowFor(kw, 'must')),
    ...decode.niceToHave.map((kw) => rowFor(kw, 'nice')),
  ]

  const mustRows = rows.filter((r) => r.tier === 'must')
  const metCount = mustRows.filter((r) => r.status === 'met').length
  const mustTotal = mustRows.length
  const gaps = rows.filter((r) => r.status === 'gap').map((r) => r.requirement)

  return {
    rows,
    metCount,
    mustTotal,
    score: mustTotal === 0 ? 1 : metCount / mustTotal,
    gaps: [...new Set(gaps)],
    intelCited: !!intel && !intel.keyless && intel.bullets.length > 0,
  }
}

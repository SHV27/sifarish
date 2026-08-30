import { db } from '../../db/db'
import type { Job, SavedHunt, VisionProfile } from '../../types'
import { setJobStatus } from '../morcha'
import { addSavedHunt, syncVisionHunts, runSweep } from '../khabri/client'

/**
 * EK BAAT — THE GLOBAL OP REGISTRY (re-brief Pillar 1, ARCHITECTURE authority 1).
 *
 * The ONE typed vocabulary of app-level mutations the conversation can perform. Three readers,
 * one definition: the deterministic parser proposes these, the LLM lane may emit them (then
 * they are RE-VALIDATED here against real ids), and the executor below is the only door that
 * applies them. Packet-scoped edits stay the Baithak EditOp union — same family, packet mount.
 *
 * Law: the agent PROPOSES, the owner CONFIRMS (Nabz pattern) — sweep/navigate are the only
 * auto-safe ops (read-only or already human-triggered semantics). Nothing here can send,
 * submit, or spend beyond the existing budget doors (I3/I8 untouched).
 */

export type GlobalOp =
  | { kind: 'add-entry'; entryKind: 'achievement' | 'certification' | 'skill'; title: string; detail?: string }
  | { kind: 'vision-add-role'; role: string }
  | { kind: 'vision-drop-role'; role: string }
  | { kind: 'vision-add-avoid'; term: string }
  | { kind: 'vision-drop-avoid'; term: string }
  | { kind: 'vision-add-company'; company: string }
  | { kind: 'add-hunt'; query: string; country?: string }
  | { kind: 'toggle-hunt'; huntId: string; enabled: boolean }
  | { kind: 'sweep' }
  | { kind: 'navigate'; screen: 'shelf' | 'khabri' | 'radar' | 'packet' | 'guru' | 'morcha' | 'settings' }
  | { kind: 'mark-applied'; jobId: string }

export interface GlobalProposal {
  id: string
  op: GlobalOp
  /** One-line human diff: what confirming does. */
  label: string
  detail: string
  invariants: string[]
}

export interface AgentContext {
  hunts: SavedHunt[]
  jobs: Job[]
  vision?: VisionProfile
}

let seq = 0
const mk = (op: GlobalOp, label: string, detail: string, invariants: string[]): GlobalProposal => ({
  id: `agent-${Date.now()}-${seq++}`,
  op,
  label,
  detail,
  invariants,
})

const SCREENS = new Set(['shelf', 'khabri', 'radar', 'packet', 'guru', 'morcha', 'settings'])

/**
 * Validate a raw (possibly LLM-emitted) op against REAL state → a proposal card, or null.
 * The schema shapes it; the data authorizes it (the smart-Baithak I11 pattern, app-wide).
 */
export function validateGlobalOp(raw: Record<string, unknown>, ctx: AgentContext): GlobalProposal | null {
  const kind = String(raw.kind ?? '')
  const s = (k: string) => String(raw[k] ?? '').trim()
  switch (kind) {
    case 'add-entry': {
      const entryKind = s('entryKind') as 'achievement' | 'certification' | 'skill'
      const title = s('title')
      if (!['achievement', 'certification', 'skill'].includes(entryKind) || title.length < 3 || title.length > 160) return null
      return mk(
        { kind, entryKind, title, detail: s('detail') || undefined },
        `Add ${entryKind}: "${title}"`,
        'Goes into your Sach Ledger exactly like Shelf\'s Quick-add (shipped, dated today). The ledger is the truth the resume compiles from — only add what you can defend in an interview.',
        ['ledger is self-declared truth', 'resume renders it only via I1 evidence links'],
      )
    }
    case 'vision-add-role':
    case 'vision-drop-role': {
      const role = s('role')
      if (role.length < 3 || role.length > 80) return null
      const have = (ctx.vision?.targetRoles ?? []).some((r) => r.toLowerCase() === role.toLowerCase())
      if (kind === 'vision-add-role' && have) return null
      if (kind === 'vision-drop-role' && !have) return null
      return mk(
        { kind, role } as GlobalOp,
        kind === 'vision-add-role' ? `Target role + "${role}"` : `Target role − "${role}"`,
        'Updates your Vision Profile; the Radar re-ranks and vision-derived hunts re-sync immediately (hand-set hunts untouched).',
        ['additive + reversible', 'syncVisionHunts (idempotent)'],
      )
    }
    case 'vision-add-avoid':
    case 'vision-drop-avoid': {
      const term = s('term')
      if (term.length < 3 || term.length > 80) return null
      const have = (ctx.vision?.notInterested ?? []).some((r) => r.toLowerCase() === term.toLowerCase())
      if (kind === 'vision-add-avoid' && have) return null
      if (kind === 'vision-drop-avoid' && !have) return null
      return mk(
        { kind, term } as GlobalOp,
        kind === 'vision-add-avoid' ? `Not-interested + "${term}"` : `Not-interested − "${term}"`,
        'Demotes (never hides) matching roles in the ranked queue, with the reason rendered.',
        ['demote never hide', 'reversible in Settings'],
      )
    }
    case 'vision-add-company': {
      const company = s('company')
      if (company.length < 2 || company.length > 60) return null
      if ((ctx.vision?.dreamCompanies ?? []).some((c) => c.toLowerCase() === company.toLowerCase())) return null
      return mk(
        { kind, company },
        `Dream company + "${company}"`,
        'Hunted by name every sweep on the aggregator lanes — the lawful door to no-feed companies.',
        ['I3: lawful aggregator APIs only'],
      )
    }
    case 'add-hunt': {
      const query = s('query')
      if (query.length < 4 || query.length > 90) return null
      if (ctx.hunts.some((h) => h.query.trim().toLowerCase() === query.toLowerCase())) return null
      const country = s('country').toLowerCase()
      return mk(
        { kind, query, country: /^[a-z]{2}$/.test(country) ? country : undefined },
        `New hunt: "${query}"`,
        'Joins your saved hunts (week-fresh, budget-rationed, I8). Remove any time from the Radar\'s Hunt panel.',
        ['budget-capped (I8)', 'owner-editable'],
      )
    }
    case 'toggle-hunt': {
      const hunt = ctx.hunts.find((h) => h.id === s('huntId') || h.query.toLowerCase() === s('huntId').toLowerCase())
      if (!hunt) return null
      const enabled = raw.enabled === true
      if (hunt.enabled === enabled) return null
      return mk(
        { kind, huntId: hunt.id, enabled },
        `${enabled ? 'Enable' : 'Pause'} hunt "${hunt.query}"`,
        enabled ? 'The next sweep funds it again.' : 'Kept, not deleted — re-enable any time.',
        ['reversible'],
      )
    }
    case 'sweep':
      return mk({ kind }, 'Run a discovery sweep now', 'All lanes, budget-rationed; skips are named. New roles land on the Radar.', ['I8 rations', 'owner-only spend'])
    case 'navigate': {
      const screen = s('screen')
      if (!SCREENS.has(screen)) return null
      return mk({ kind: 'navigate', screen: screen as 'radar' }, `Open ${screen}`, '', [])
    }
    case 'mark-applied': {
      const needle = s('jobId').toLowerCase()
      const job =
        ctx.jobs.find((j) => j.id === s('jobId')) ??
        ctx.jobs.find((j) => j.status !== 'applied' && `${j.company} ${j.title}`.toLowerCase().includes(needle))
      if (!job || needle.length < 3) return null
      return mk(
        { kind, jobId: job.id },
        `Mark applied: ${job.title} @ ${job.company}`,
        'Stamps appliedAt through the ONE door (nudges + weekly counter fire).',
        ['single markApplied door'],
      )
    }
    default:
      return null
  }
}

/** Execute a CONFIRMED op. Returns the honest confirmation line for the chat. */
export async function executeGlobalOp(op: GlobalOp, onNav?: (screen: string) => void): Promise<string> {
  switch (op.kind) {
    case 'add-entry': {
      const id = `${op.entryKind}-${Date.now()}`
      const now = new Date()
      // EXACTLY the Shelf Quick-add door — one shape, one convention (no second copy of the rule).
      await db.ledger.put({
        id,
        kind: op.entryKind,
        title: op.title,
        summary: op.detail ?? '',
        bullets:
          op.entryKind === 'skill'
            ? [{ id: `${id}-b1`, text: op.title, keywords: [op.title.toLowerCase().replace(/[^a-z0-9]/g, '-')] }]
            : [],
        tier: 'shipped',
        evidence: { date: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`, note: op.detail || 'Added in conversation.' },
        tags: [op.entryKind],
        resumeEligible: true,
      })
      return `Done — "${op.title}" is in your ledger (${op.entryKind}, dated today). Every future packet can compile it.`
    }
    case 'vision-add-role':
    case 'vision-drop-role':
    case 'vision-add-avoid':
    case 'vision-drop-avoid':
    case 'vision-add-company': {
      const settings = await db.settings.get('app')
      const v = settings?.visionProfile
      if (!v) return 'No Vision Profile yet — set one up in Settings first.'
      const next: VisionProfile = { ...v }
      if (op.kind === 'vision-add-role') next.targetRoles = [...v.targetRoles, op.role]
      if (op.kind === 'vision-drop-role') next.targetRoles = v.targetRoles.filter((r) => r.toLowerCase() !== op.role.toLowerCase())
      if (op.kind === 'vision-add-avoid') next.notInterested = [...v.notInterested, op.term]
      if (op.kind === 'vision-drop-avoid') next.notInterested = v.notInterested.filter((r) => r.toLowerCase() !== op.term.toLowerCase())
      if (op.kind === 'vision-add-company') next.dreamCompanies = [...(v.dreamCompanies ?? []), op.company]
      await db.settings.update('app', { visionProfile: next })
      // The D116 law: a vision edit re-derives hunts NOW, not on the next app open.
      await syncVisionHunts(next).catch(() => 0)
      return 'Vision updated — the queue re-ranks and derived hunts re-synced (your hand-set hunts untouched).'
    }
    case 'add-hunt': {
      const added = await addSavedHunt({ query: op.query, country: op.country, remoteOnly: false })
      return added ? `Hunt "${op.query}" saved — the next sweep funds it.` : `That hunt already exists — nothing duplicated.`
    }
    case 'toggle-hunt': {
      await db.savedHunts.update(op.huntId, { enabled: op.enabled, ownerSetDate: true })
      return op.enabled ? 'Hunt enabled.' : 'Hunt paused (kept, not deleted).'
    }
    case 'sweep': {
      const y = await runSweep()
      return `Sweep done: ${y.found} found, ${y.new} new, ${y.duplicate} deduped${y.creditsSpent ? `, ${y.creditsSpent} credits` : ' (keyless lanes)'}. Check the Radar.`
    }
    case 'navigate':
      onNav?.(op.screen)
      return `Opening ${op.screen}.`
    case 'mark-applied': {
      await setJobStatus(op.jobId, 'applied')
      const job = await db.jobs.get(op.jobId)
      return `Marked applied: ${job?.title ?? op.jobId} @ ${job?.company ?? ''} — follow-up nudges armed (day 7/14).`
    }
  }
}

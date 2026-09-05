import { db } from '../../db/db'
import type { EditOp, Job, LedgerEntry, SavedHunt, VisionProfile } from '../../types'
import { setJobStatus } from '../morcha'
import { addSavedHunt, syncVisionHunts, runSweep } from '../khabri/client'
import { absorbFact, ensureSection, findEntry, inferKind, labelFor, splitFact } from '../dossier/absorb'

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
  /** v2 THE DOSSIER — a fact of ANY kind, said out loud; the kind is inferred, the section created on demand. */
  | { kind: 'add-fact'; factKind: string; text: string; detail?: string }
  | { kind: 'create-section'; sectionKind: string; label: string }
  /** in_forge → shipped ("I know LoRA now"): the dated momentum line becomes a fact. */
  | { kind: 'promote-entry'; entryId: string }
  /** resumeEligible flip on a skill he once benched ("allow React on my résumé"). */
  | { kind: 'set-skill-eligible'; entryId: string; eligible: boolean }
  /** Re-read every public README into the projects' context (never touches his bullets). */
  | { kind: 'refresh-readmes' }
  /** v2 R2 — any field of any fact, by talking ("change Braillix's summary to …"). His words, his ledger. */
  | { kind: 'edit-entry'; entryId: string; field: 'title' | 'summary' | 'date' | 'url'; value: string }
  /** Hide a fact from every page (resumeEligible false) / bring it back. Never deleted. */
  | { kind: 'hide-entry'; entryId: string; hide: boolean }
  /** One page only / two pages allowed. */
  | { kind: 'set-page-policy'; policy: 'one' | 'two-ok' }
  /** Rename a section's heading in the registry. */
  | { kind: 'rename-section'; sectionKind: string; label: string }
  /** Study a résumé he pasted — it joins the canon the strategist reads. */
  | { kind: 'add-sample'; text: string }
  /** v2 R2 — a packet-scoped edit (the Baithak's own op) proposed from anywhere; the packet is named. */
  | { kind: 'packet-edit'; jobId: string; edit: EditOp; utterance: string }
  | { kind: 'vision-add-role'; role: string }
  | { kind: 'vision-drop-role'; role: string }
  | { kind: 'vision-add-avoid'; term: string }
  | { kind: 'vision-drop-avoid'; term: string }
  | { kind: 'vision-add-company'; company: string }
  | { kind: 'vision-set-dream'; dream: string }
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
  /** v2 — the dossier, so promote / eligibility ops validate against REAL entries. */
  ledger?: LedgerEntry[]
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
    case 'add-fact': {
      const text = s('text')
      if (text.length < 6 || text.length > 300) return null
      const factKind = (s('factKind') || inferKind(text)).toLowerCase().replace(/[^a-z0-9-]/g, '-')
      if (!factKind) return null
      const { title } = splitFact(text)
      return mk(
        { kind, factKind, text, detail: s('detail') || undefined },
        `Add to your dossier (${labelFor(factKind)}): "${title.slice(0, 80)}"`,
        `Lands in your Sach Ledger as kind "${factKind}" (a section is created if none exists), sworn by you, dated today. The strategist decides per posting whether it plays — "${title.slice(0, 40)}" may be the strongest line for one company and benched for another.`,
        ['sworn by owner (I1)', 'section created on demand', 'played/benched per posting with a reason'],
      )
    }
    case 'create-section': {
      const sectionKind = s('sectionKind').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const label = s('label') || labelFor(sectionKind)
      if (sectionKind.length < 3 || sectionKind.length > 40) return null
      return mk({ kind, sectionKind, label }, `Create section "${label}"`, 'A new kind in the registry; facts you add under it render as their own titled section when played.', ['registry is data', 'compiler renders any kind'])
    }
    case 'promote-entry': {
      const needle = s('entryId')
      const e = (ctx.ledger ?? []).find((x) => x.id === needle) ?? findEntry((ctx.ledger ?? []).filter((x) => x.tier === 'in_forge'), needle)
      if (!e || e.tier !== 'in_forge') return null
      return mk(
        { kind, entryId: e.id },
        `Promote "${e.title.split(/ — /)[0]}" to shipped`,
        'It leaves the dated "Currently Building" line and becomes a fact the page can play — only say so if you can defend it in an interview.',
        ['tier honesty (I2)', 'sworn by owner'],
      )
    }
    case 'set-skill-eligible': {
      const needle = s('entryId')
      const eligible = raw.eligible === true
      const e = (ctx.ledger ?? []).find((x) => x.id === needle) ?? findEntry((ctx.ledger ?? []).filter((x) => x.kind === 'skill'), needle)
      if (!e || e.kind !== 'skill' || e.resumeEligible === eligible) return null
      return mk(
        { kind, entryId: e.id, eligible },
        eligible ? `Allow "${e.title}" on the page` : `Keep "${e.title}" off the page`,
        eligible ? 'Skills rows and project stacks may show it again (it was marked not-interview-safe before).' : 'Stays evidence for matching; never rendered.',
        ['his call outranks the README (D59)'],
      )
    }
    case 'refresh-readmes':
      return mk({ kind }, 'Re-read your GitHub READMEs', 'Every project with a repo link gets its README context refreshed (features, stack, prose); your bullets and titles are never touched.', ['context only', 'keyless for public repos'])
    case 'edit-entry': {
      const e = (ctx.ledger ?? []).find((x) => x.id === s('entryId')) ?? findEntry(ctx.ledger ?? [], s('entryId'))
      const field = s('field') as 'title' | 'summary' | 'date' | 'url'
      const value = s('value')
      if (!e || !['title', 'summary', 'date', 'url'].includes(field) || value.length < 2 || value.length > 600) return null
      return mk(
        { kind, entryId: e.id, field, value },
        `${e.title.split(/ — /)[0]} — ${field} → "${value.slice(0, 70)}${value.length > 70 ? '…' : ''}"`,
        'Edits your Sach Ledger exactly like the Shelf editor — your words, your truth. Every packet recompiles from it.',
        ['ledger is self-declared truth', 'reversible in the Shelf'],
      )
    }
    case 'hide-entry': {
      const e = (ctx.ledger ?? []).find((x) => x.id === s('entryId')) ?? findEntry(ctx.ledger ?? [], s('entryId'))
      const hide = raw.hide !== false
      if (!e || e.resumeEligible === !hide) return null
      return mk(
        { kind, entryId: e.id, hide },
        hide ? `Hide "${e.title.split(/ — /)[0]}" from every page` : `Bring "${e.title.split(/ — /)[0]}" back`,
        hide ? 'Stays in your dossier as evidence; never rendered until you bring it back. Nothing is deleted.' : 'Renders again wherever a plan plays it.',
        ['never deleted', 'reversible'],
      )
    }
    case 'set-page-policy': {
      const policy = s('policy') === 'one' ? 'one' : 'two-ok'
      return mk({ kind, policy }, policy === 'one' ? 'One page only' : 'A second page is allowed', policy === 'one' ? 'The solver tightens spacing, trims descriptions and the summary, and only then declares a bench — never a silent drop.' : 'Spacing tightens first; page 2 only before any true fact would be dropped.', ['page policy is data'])
    }
    case 'rename-section': {
      const sectionKind = s('sectionKind').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const label = s('label')
      if (sectionKind.length < 3 || label.length < 2 || label.length > 40) return null
      return mk({ kind, sectionKind, label }, `Section "${sectionKind}" → heading "${label}"`, 'The registry label changes; every page renders the new heading.', ['registry is data'])
    }
    case 'add-sample': {
      const text = s('text')
      if (text.length < 200) return null
      return mk({ kind, text }, `Study this résumé (${Math.round(text.length / 100) / 10}k chars)`, 'Joins the canon the strategist reads — register and density are learned from it; its facts never enter your pages.', ['style reference only', 'never his facts'])
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
    case 'vision-set-dream': {
      const dream = s('dream')
      if (dream.length < 20 || dream.length > 900) return null
      return mk(
        { kind, dream },
        'Rewrite your vision statement',
        `"${dream.slice(0, 140)}${dream.length > 140 ? '…' : ''}" — this text DRIVES ranking, derived hunts, the resume headline's voice, and the letters. Confirming replaces the current dream (roles/avoids stay).`,
        ['re-ranks the queue', 'hunts re-derive (hand-set untouched)', 'headline re-voices'],
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
    case 'add-fact': {
      const e = await absorbFact({ text: op.text, kind: op.factKind, detail: op.detail })
      return `Done — "${e.title}" is in your dossier under ${labelFor(e.kind)} (sworn by you, dated ${e.evidence?.date}). Every future packet weighs it; the board says why it plays or sits.`
    }
    case 'create-section': {
      const created = await ensureSection(op.sectionKind, op.label)
      return created ? `Section "${op.label}" created — tell me facts for it any time.` : `Section "${op.label}" already exists.`
    }
    case 'promote-entry': {
      const e = await db.ledger.get(op.entryId)
      if (!e) return 'That entry is gone.'
      const now = new Date()
      await db.ledger.update(op.entryId, {
        tier: 'shipped',
        forgeEta: undefined,
        evidence: { ...(e.evidence ?? { note: '' }), date: e.evidence?.date ?? `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`, note: `${e.evidence?.note ?? ''} Promoted to shipped by the owner in conversation.`.trim() },
        sworn: 'owner',
      })
      return `"${e.title.split(/ — /)[0]}" is shipped now — it leaves the Currently Building line and can play on the page.`
    }
    case 'set-skill-eligible': {
      await db.ledger.update(op.entryId, { resumeEligible: op.eligible })
      const e = await db.ledger.get(op.entryId)
      return op.eligible ? `"${e?.title}" may appear on the page again.` : `"${e?.title}" stays off the page.`
    }
    case 'edit-entry': {
      const e = await db.ledger.get(op.entryId)
      if (!e) return 'That entry is gone.'
      if (op.field === 'title') await db.ledger.update(op.entryId, { title: op.value })
      else if (op.field === 'summary') await db.ledger.update(op.entryId, { summary: op.value })
      else if (op.field === 'date') await db.ledger.update(op.entryId, { evidence: { ...(e.evidence ?? { note: '' }), date: op.value } })
      else await db.ledger.update(op.entryId, { evidence: { ...(e.evidence ?? { date: '', note: '' }), url: op.value } })
      return `Done — ${e.title.split(/ — /)[0]}'s ${op.field} updated. Packets recompile from the ledger.`
    }
    case 'hide-entry': {
      await db.ledger.update(op.entryId, { resumeEligible: !op.hide })
      const e = await db.ledger.get(op.entryId)
      return op.hide ? `"${e?.title.split(/ — /)[0]}" is hidden from every page (still in your dossier).` : `"${e?.title.split(/ — /)[0]}" is back.`
    }
    case 'set-page-policy': {
      await db.settings.update('app', { pagePolicy: op.policy })
      return op.policy === 'one' ? 'One page only, from the next compile.' : 'A second page is allowed before any true fact is dropped.'
    }
    case 'rename-section': {
      await ensureSection(op.sectionKind, op.label)
      return `Section "${op.sectionKind}" now reads "${op.label}".`
    }
    case 'add-sample': {
      const { addSample } = await import('../ustaad/canon')
      const sm = await addSample(op.text)
      return `Studied — ${sm.shape}. The strategist reads it with the canon from the next packet.`
    }
    case 'packet-edit': {
      const packet = (await db.packets.where('jobId').equals(op.jobId).toArray())[0]
      if (!packet) return 'That packet is gone — open the role and tailor it again.'
      const { applyEdit } = await import('../baithak/execute')
      const r = await applyEdit(packet, op.edit, op.utterance)
      return r.note
    }
    case 'refresh-readmes': {
      const { refreshProjectContexts } = await import('../dossier/readme')
      const r = await refreshProjectContexts()
      return `Re-read ${r.refreshed} README${r.refreshed === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} unchanged/unavailable` : ''} — the strategist now reads the latest words you wrote.`
    }
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
    case 'vision-add-company':
    case 'vision-set-dream': {
      const settings = await db.settings.get('app')
      const v = settings?.visionProfile
      if (!v) return 'No Vision Profile yet — set one up in Settings first.'
      const next: VisionProfile = { ...v }
      if (op.kind === 'vision-add-role') next.targetRoles = [...v.targetRoles, op.role]
      if (op.kind === 'vision-drop-role') next.targetRoles = v.targetRoles.filter((r) => r.toLowerCase() !== op.role.toLowerCase())
      if (op.kind === 'vision-add-avoid') next.notInterested = [...v.notInterested, op.term]
      if (op.kind === 'vision-drop-avoid') next.notInterested = v.notInterested.filter((r) => r.toLowerCase() !== op.term.toLowerCase())
      if (op.kind === 'vision-add-company') next.dreamCompanies = [...(v.dreamCompanies ?? []), op.company]
      if (op.kind === 'vision-set-dream') next.dream = op.dream
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

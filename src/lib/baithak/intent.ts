import type { BaithakParse, EditOp, LedgerEntry, Packet, ProposedEdit } from '../../types'
import { citePatterns, patternById } from '../ustaad/library'

/**
 * DARZI BAITHAK — intent parsing (P14). Natural language (English + Hinglish) becomes
 * PROPOSED structured EditOps that pass through the SAME deterministic pipeline, fact-drift
 * guard, and gates as any other input (I11). The deterministic parser here is the keyless
 * mode AND the testable core (the D23 architecture, applied to the tailor).
 *
 * The hard rule: conversation can SELECT and ORDER evidence; it can never mint a claim.
 * "add that I know Kubernetes" with no ledger evidence is a refusal + Gap Note — by design.
 */

let opSeq = 0
function proposal(op: EditOp, before: string, after: string, invariants: string[]): ProposedEdit {
  return { id: `edit-${Date.now()}-${opSeq++}`, op, before, after, invariants }
}

export interface BaithakContext {
  packet: Packet
  ledger: LedgerEntry[]
}

const projectName = (e: LedgerEntry) => e.title.split('—')[0].trim()

/** Normalize so "spark core" matches "spark-core" — hyphen vs space was a real miss (Session 5.4). */
const normName = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim()

function findProject(utterance: string, projects: LedgerEntry[]): LedgerEntry | undefined {
  const hay = normName(utterance)
  return projects.find((p) => hay.includes(normName(projectName(p))))
}

function findAllProjects(utterance: string, projects: LedgerEntry[]): LedgerEntry[] {
  const hay = normName(utterance)
  return projects.filter((p) => hay.includes(normName(projectName(p))))
}

const URL_RE = /(https?:\/\/[^\s"']+|[a-z0-9-]+\.(?:vercel\.app|github\.io|netlify\.app|dev|app|com|in)\/?[^\s"']*)/i

// Hinglish + English verb cues
const CUE = {
  bench: /\b(hata|hatao|nikal|nikaal|remove|bench|drop)\b/i,
  promote: /\b(aage|pehle|upar|lead|promote|first|top pe|top par)\b/i,
  link: /\b(link|url)\b/i,
  attach: /\b(daal|attach|laga|lagao|add|le link|ye le)\b/i,
  bullet: /\b(bullet|point|wala point|line)\b/i,
  include: /\b(ghusa|ghusao|daal|add|include|la|lao)\b/i,
  tone: /\b(tone|technical|polish|flow|concise|kas|tight)\b/i,
  explain: /\b(kyun|kyon|kyu|why|explain|samjha|samjhao|reason)\b/i,
  claimAdd: /\b(add that i know|likh de|likh do|bol de|mention kar|daal de)\b|\b(jaanta|jaanti|aata|aati)\s+(hai|hoon|hu)\b/i,
  sectionSkills: /\bskills?\s+(upar|pehle|first|top)\b/i,
  sectionEdu: /\b(education|padhai)\s+(upar|pehle|first|top)\b/i,
  summary: /\b(professional summary|summary|about me|profile|objective|intro)\b/i,
  removeWord: /\b(hata|remove|nikaal|off|bina|without|no)\b/i,
}

/** Search the whole ledger for evidence of a term — title, tags, keywords, bullet text, summary,
 *  AND the deep-read README context (D81's whole-entry boundary, Session 6: a fact he wrote
 *  anywhere about his own work is GENUINE; refusing it is a bug as severe as a fabrication).
 *  Word-boundary match — "rust" must not ride in on "trust". */
export function hasEvidence(term: string, ledger: LedgerEntry[]): boolean {
  const t = term.toLowerCase().trim()
  if (t.length < 2) return false
  const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
  const hits = (s?: string) => !!s && re.test(s)
  return ledger.some(
    (e) =>
      hits(e.title) ||
      e.tags.some((x) => hits(x)) ||
      e.bullets.some((b) => hits(b.text) || b.keywords.some((x) => hits(x))) ||
      hits(e.summary) ||
      hits(e.context?.problem) ||
      (e.context?.features ?? []).some((x) => hits(x)) ||
      hits(e.context?.readme),
  )
}

/** Extract the claimed skill from an adversarial "add that I know X" style utterance. */
function extractClaim(utterance: string): string | null {
  const m1 = /add that i know ([a-z0-9+#. _-]+)/i.exec(utterance)
  if (m1) return m1[1].trim().replace(/[.!?]$/, '')
  const m2 = /\b([a-z0-9+#.-]{2,})\s+(?:bhi\s+)?(?:jaanta|jaanti|aata|aati)\s+(?:hai|hoon|hu)\b/i.exec(utterance)
  if (m2) return m2[1].trim()
  const m3 = /(?:likh de|likh do|mention kar|daal de)\s+(?:ki\s+)?(?:mujhe\s+)?([a-z0-9+#. -]{2,}?)(?:\s+(?:aata|aati|jaanta)\b|$)/i.exec(utterance)
  if (m3) return m3[1].trim()
  return null
}

export function parseUtterance(utterance: string, ctx: BaithakContext): BaithakParse {
  const { packet, ledger } = ctx
  const projects = ledger.filter((e) => e.kind === 'project' && e.tier === 'shipped' && e.resumeEligible)
  const chosen = new Set(packet.editorial?.chosen.map((c) => c.ledgerId) ?? [])
  const proposals: ProposedEdit[] = []
  const u = utterance.trim()

  // --- 0 · Explain: the Baithak knows the library and cites its own choices ---
  if (CUE.explain.test(u) && !CUE.bench.test(u) && !CUE.include.test(u)) {
    const named = findProject(u, projects)
    if (named && packet.editorial) {
      const cast = packet.editorial.chosen.find((c) => c.ledgerId === named.id)
      const benched = packet.editorial.benched.find((b) => b.ledgerId === named.id)
      const reason = cast ? `${cast.angleRationale.why}` : benched ? benched.why : 'Not part of this compile.'
      return {
        reply: `${projectName(named)}: ${reason} The 6-second skim gives almost all fixation time to the top of the page — that's why casting order matters (Ustaad ¶six-second-skim).`,
        proposals: [],
        citations: citePatterns(['six-second-skim'], 2),
        by: 'deterministic',
      }
    }
    const xyz = patternById('xyz-formula')
    return {
      reply: `Every choice here has a receipt. Bullets follow "${xyz?.rule ?? 'outcome first, measurement explicit'}" because it forces metrics into every line (Ustaad ¶xyz-formula); casting puts the strongest evidence in the top third because recruiters average 7.4 seconds on the first skim (¶six-second-skim). Ask about any specific project and I'll show its rationale.`,
      proposals: [],
      citations: citePatterns(['xyz-formula', 'six-second-skim'], 3),
      by: 'deterministic',
    }
  }

  // --- 1 · Adversarial claim: refusal is the feature (I11/I1) ---
  const claim = extractClaim(u)
  if (claim && !hasEvidence(claim, ledger)) {
    return {
      reply:
        `Nahi — "${claim}" ka koi evidence ledger mein nahi hai, aur main bina saboot ke ek shabd nahi likhta (I1). ` +
        `Do honest raaste: (1) agar tumne sach mein ${claim} use kiya hai, ledger mein entry banao evidence ke saath; ` +
        `(2) agar seekh rahe ho, in-forge entry banao — woh dated "Currently Building" line mein aayega (I2). Recruiters fabrication hunt karte hain; yahi refusal tumhara edge hai.`,
      proposals: [],
      refused: { term: claim, gapNote: `"${claim}" requested in Baithak but has zero ledger evidence — add real work or an in-forge entry.` },
      by: 'deterministic',
    }
  }

  // --- 2 · Attach link (probe-gated at execution) ---
  if (CUE.link.test(u) && (CUE.attach.test(u) || URL_RE.test(u))) {
    const named = findProject(u, projects)
    const urlMatch = URL_RE.exec(u.replace(/\b(link|url)\b/gi, ''))
    if (named) {
      const url = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : `https://${urlMatch[1]}`) : named.evidence?.url
      if (url) {
        proposals.push(
          proposal(
            { kind: 'attach-link', ledgerId: named.id, url },
            named.evidence?.url ? `${projectName(named)} links to ${named.evidence.url}` : `${projectName(named)} has no live link on the page`,
            `${projectName(named)} links to ${url} (attached only if the liveness probe passes)`,
            ['I1 evidence link', 'dead-link probe'],
          ),
        )
        return {
          reply: `Theek — ${projectName(named)} pe ye link laga doonga, pehle zinda hai ya nahi check karke. A dead link can never enter a packet.`,
          proposals,
          by: 'deterministic',
        }
      }
      return {
        reply: `${projectName(named)} ke liye link chahiye — URL paste kar do isi message mein (e.g. "GLOAMING ka link daal https://…"). Main pehle liveness probe karunga.`,
        proposals: [],
        by: 'deterministic',
      }
    }
  }

  // --- 3 · Bench / promote (can co-occur: "SUTRADHAR hata, MUNSHI aage kar") ---
  //
  // "add sifarish" / "sifarish daal" for a project that IS in the ledger but benched = PROMOTE it.
  // The old parser only treated aage/pehle/lead as promote, so "add [my flagship]" fell through to
  // the smart layer, which — seeing an aside like "with help of Claude" — refused as if the whole
  // project were unevidenced. But sifarish IS in his ledger; promoting a real, benched project is
  // never a fabrication (Session 5.4, owner-reported).
  const namedAll = findAllProjects(u, projects)
  if (namedAll.length > 0 && (CUE.bench.test(u) || CUE.promote.test(u) || CUE.include.test(u))) {
    for (const p of namedAll) {
      const name = projectName(p)
      // Which verb applies to THIS project? Look at the clause around its name.
      const idx = normName(u).indexOf(normName(name))
      const clause = u.slice(Math.max(0, idx - 12), idx + name.length + 24)
      const benchHere = CUE.bench.test(clause)
      // "add/daal/include" a benched project reads as "put it on the resume" → promote.
      const promoteHere = CUE.promote.test(clause) || CUE.include.test(clause)
      if (benchHere && chosen.has(p.id)) {
        proposals.push(
          proposal(
            { kind: 'bench-project', ledgerId: p.id },
            `${name} is in the cast lineup`,
            `${name} benched — only the cast lineup renders (benched-means-benched)`,
            ['casting override', 'red-team re-runs', 'one-page re-solves'],
          ),
        )
      } else if (promoteHere && !chosen.has(p.id)) {
        proposals.push(
          proposal(
            { kind: 'promote-project', ledgerId: p.id },
            `${name} is benched`,
            `${name} joins the cast lineup (leads the page)`,
            ['casting override', 'red-team re-runs', 'one-page re-solves'],
          ),
        )
      } else if (promoteHere && chosen.has(p.id)) {
        proposals.push(
          proposal(
            { kind: 'promote-project', ledgerId: p.id },
            `${name} is in the lineup`,
            `${name} moves to the front of the lineup`,
            ['casting order', 'red-team re-runs'],
          ),
        )
      }
    }
    if (proposals.length > 0) {
      return {
        reply: `Samajh gaya — ${proposals.length} change propose kar raha hoon. Diff cards dekho, ✓ karo toh compiler se guzrenge (I11: main propose karta hoon, compiler dispose karta hai).`,
        proposals,
        by: 'deterministic',
      }
    }
  }

  // --- 4 · Lead with a specific ledger bullet ("hash-chain wala point ghusa") ---
  if (CUE.bullet.test(u) && CUE.include.test(u)) {
    const named = findProject(u, projects) ?? projects.find((p) => chosen.has(p.id))
    if (named) {
      const hay = u.toLowerCase()
      const hit = named.bullets.find(
        (b) =>
          b.keywords.some((k) => hay.includes(k.toLowerCase().replace(/-/g, ' ')) || hay.includes(k.toLowerCase())) ||
          b.text
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.length > 5 && hay.includes(w)),
      )
      if (hit) {
        proposals.push(
          proposal(
            { kind: 'lead-bullet', ledgerId: named.id, bulletId: hit.id },
            `${projectName(named)}'s bullet order is the surgery pass's pick`,
            `"${hit.text.slice(0, 70)}…" leads ${projectName(named)}'s bullets`,
            ['I1 (existing ledger bullet — nothing minted)', 'one-page re-solves'],
          ),
        )
        return {
          reply: `Mil gaya — woh bullet ledger mein hai, isliye legal hai. ${projectName(named)} mein sabse upar le aata hoon (✓ karo).`,
          proposals,
          by: 'deterministic',
        }
      }
      return {
        reply: `${projectName(named)} ke ledger bullets mein aisa koi point nahi mila. Main sirf ledger ke bullets chun aur order kar sakta hoon — naya point chahiye toh pehle ledger mein likho evidence ke saath (I11).`,
        proposals: [],
        by: 'deterministic',
      }
    }
  }

  // --- 5 · Section order ---
  if (CUE.sectionSkills.test(u) || CUE.sectionEdu.test(u)) {
    const order: NonNullable<Packet['editorial']>['sectionOrder'] = CUE.sectionSkills.test(u)
      ? ['skills', 'projects', 'forge', 'education', 'achievements', 'certs']
      : ['education', 'skills', 'projects', 'forge', 'achievements', 'certs']
    proposals.push(
      proposal(
        { kind: 'set-section-order', sectionOrder: order! },
        'Current section order',
        `${order![0]} leads the page`,
        ['structure only — content untouched', 'one-page re-solves'],
      ),
    )
    return { reply: 'Section order badal deta hoon — content wahi rahega, sirf tarteeb badlegi.', proposals, by: 'deterministic' }
  }

  // --- 6 · Professional summary (his example — now handled smartly, even keyless) ---
  if (CUE.summary.test(u)) {
    const on = !CUE.removeWord.test(u)
    proposals.push(
      proposal(
        { kind: 'set-summary', on },
        on ? 'No professional summary line' : 'Resume has a professional summary',
        on
          ? 'A targeted, evidence-dense summary at the top — compiled from your headline, strongest shipped project, top JD-matched skills, and honest momentum'
          : 'Professional summary removed',
        on ? ['I1 (every clause traces to real ledger evidence — nothing minted)', 'Ustaad ¶headline-mirrors-role'] : ['content only'],
      ),
    )
    return {
      reply: on
        ? 'Haan — ek professional summary bana deta hoon jo tumhare truth se compile hoti hai (headline + sabse strong shipped project + top skills + honest momentum). Ye generic objective nahi, evidence-dense hai — recruiter ka pehla 6-second fixation isi pe padta hai. ✓ karo.'
        : 'Summary hata deta hoon.',
      proposals,
      by: 'deterministic',
      handled: true,
    }
  }

  // --- 7 · Tone / polish ---
  if (CUE.tone.test(u)) {
    proposals.push(
      proposal(
        { kind: 'polish-tone' },
        'Compiled phrasing as-is',
        'One guarded polish pass — flow only; every line re-checked by the fact-drift guard',
        ['I1 fact-drift guard', 'slop-scan', 'I9 scan'],
      ),
    )
    return {
      reply: 'Polish pass chala doonga — sirf phrasing, facts frozen. Jo line naya fact ugalti hai, guard usse reject kar deta hai.',
      proposals,
      by: 'deterministic',
      handled: true,
    }
  }

  // --- 8 · Fallback: NOT handled deterministically → the smart LLM layer may take over ---
  return {
    reply:
      'Main ye kar sakta hoon: "professional summary daal" · "GLOAMING aage kar" (casting) · "SUTRADHAR hata" (bench) · ' +
      '"DARYA ka link daal https://…" (probe-gated) · "hash-chain wala point ghusa" (ledger bullet lead) · "skills upar" (section order) · ' +
      '"thoda technical tone" (guarded polish) · "ye kyun chuna?" (rationale). Jo ledger mein nahi hai, woh main nahi likh sakta.',
    proposals: [],
    by: 'deterministic',
    handled: false,
  }
}

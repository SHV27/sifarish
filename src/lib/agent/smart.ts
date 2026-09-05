import { db } from '../../db/db'
import type { GuruMessage } from '../../types'
import { meteredCallsAllowed, meteredHeaders } from '../apiGuard'
import { allowedThisRun } from '../budget'
import { recordUsage } from '../dimaag/core'
import type { AgentContext, GlobalProposal } from './ops'
import { validateGlobalOp } from './ops'

/**
 * EK BAAT — the LLM op lane (global scope). When the honesty router says freeform AND the
 * deterministic parser didn't match AND the utterance smells like an ACTION, this maps it to
 * GLOBAL ops via /api/dimaag structured output (json_schema, D74; strict-mode field law, D80).
 * Every emitted op is RE-VALIDATED against real state by the registry before it becomes a
 * card. Keyless/over-budget → null (the Guru streams honest prose instead — I4).
 */

const ACTIONISH =
  /\b(add|create|jodo|daal|likh|remove|hata|drop|delete|nikaal|mark|set|change|update|badal|pause|stop|enable|disable|hunt|track|target|not interested|dream compan|apply (kar|ho)|open|kholo)\b/i

export function looksActionish(text: string): boolean {
  return ACTIONISH.test(text)
}

interface LlmGlobalResult {
  reply?: string
  ops?: Record<string, unknown>[]
}

function systemPrompt(ctx: AgentContext, extra: { ledgerLine: string; identityName?: string }): string {
  return [
    `You are Sifarish — ${extra.identityName ?? 'the owner'}'s job-hunt chief of staff. He talks in Hinglish or English.`,
    'Turn his request into GLOBAL APP OPS (below) plus a short warm reply. If he is only asking a',
    'question, return an EMPTY ops array and answer in "reply".',
    '',
    'HARD RULES: never promise outcomes; never claim skills beyond his ledger; ops are PROPOSALS he',
    'confirms — phrase the reply accordingly. If he asks to put an unevidenced skill on his RESUME,',
    'refuse in the reply and emit no op (the ledger-add op is only for things he himself asserts).',
    '',
    'Available ops (set unused fields to null):',
    '- {"kind":"add-entry","entryKind":"achievement"|"certification"|"skill","title":"…","detail":"…"}',
    '- {"kind":"add-fact","factKind":"experience"|"achievement"|"position"|"publication"|"sports"|"language"|"certification"|"<any short kind>","text":"<the fact in his words>","detail":"…"} — ANY true fact about him; a section is created if new',
    '- {"kind":"create-section","sectionKind":"<slug>","label":"…"} · {"kind":"promote-entry","entryId":"<title words of an in_forge entry>"} · {"kind":"set-skill-eligible","entryId":"<skill title>","eligible":true|false} · {"kind":"refresh-readmes"}',
    '- {"kind":"edit-entry","entryId":"<title words>","field":"title"|"summary"|"date"|"url","value":"…"} · {"kind":"hide-entry","entryId":"<title words>","hide":true|false} · {"kind":"set-page-policy","policy":"one"|"two-ok"} · {"kind":"rename-section","sectionKind":"<slug>","label":"…"} · {"kind":"add-sample","text":"<a résumé he pasted>"}',
    '- {"kind":"vision-add-role","role":"…"} · {"kind":"vision-drop-role","role":"…"}',
    '- {"kind":"vision-add-avoid","term":"…"} · {"kind":"vision-drop-avoid","term":"…"}',
    '- {"kind":"vision-add-company","company":"…"} · {"kind":"vision-set-dream","dream":"<his full vision text, verbatim>"}',
    '- {"kind":"add-hunt","query":"…","country":"in"|null} · {"kind":"toggle-hunt","huntId":"…","enabled":true|false}',
    '- {"kind":"sweep"} · {"kind":"navigate","screen":"radar"|…} · {"kind":"mark-applied","jobId":"<company or title words>"}',
    '',
    `His target roles: ${(ctx.vision?.targetRoles ?? []).join(', ') || '(none set)'}.`,
    `Not interested: ${(ctx.vision?.notInterested ?? []).join(', ') || '(none)'}.`,
    `Saved hunts: ${ctx.hunts.map((h) => `${h.id}:"${h.query}"${h.enabled ? '' : ' (paused)'}`).join(' · ').slice(0, 900) || '(none)'}.`,
    `Pipeline (id → role): ${ctx.jobs
      .filter((j) => j.status !== 'found')
      .slice(0, 40)
      .map((j) => `${j.company} — ${j.title} [${j.status}]`)
      .join(' · ')
      .slice(0, 1200) || '(nothing in motion)'}.`,
    `Ledger summary: ${extra.ledgerLine.slice(0, 1200)}`,
  ].join('\n')
}

export async function smartGlobal(
  history: GuruMessage[],
  utterance: string,
  ctx: AgentContext,
): Promise<{ reply: string; proposals: GlobalProposal[] } | null> {
  if (!meteredCallsAllowed()) return null
  if ((await allowedThisRun('dimaag')) <= 0) return null

  const identity = await db.identity.get('me').catch(() => undefined)
  const ledger = await db.ledger.toArray().catch(() => [])
  const ledgerLine = ledger
    .filter((e) => e.resumeEligible)
    .map((e) => `${e.title} [${e.kind}/${e.tier}]`)
    .join(' · ')

  const convo = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'OWNER' : 'YOU'}: ${m.content.slice(0, 300)}`)
    .join('\n')

  let data: { keyless?: boolean; result?: LlmGlobalResult; tokens?: number; model?: string } | null = null
  try {
    const res = await fetch('/api/dimaag', {
      method: 'POST',
      headers: meteredHeaders(),
      body: JSON.stringify({
        tier: 'reasoning',
        system: systemPrompt(ctx, { ledgerLine, identityName: identity?.name?.split(' ')[0] }),
        user: convo ? `Conversation:\n${convo}\n\nOWNER (now): ${utterance.slice(0, 500)}` : utterance.slice(0, 500),
        maxTokens: 1200,
        // D74/D80: json_schema always; every property required; optionals are nullable unions.
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            ops: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string' },
                  entryKind: { type: ['string', 'null'] },
                  title: { type: ['string', 'null'] },
                  detail: { type: ['string', 'null'] },
                  role: { type: ['string', 'null'] },
                  dream: { type: ['string', 'null'] },
                  term: { type: ['string', 'null'] },
                  company: { type: ['string', 'null'] },
                  query: { type: ['string', 'null'] },
                  country: { type: ['string', 'null'] },
                  huntId: { type: ['string', 'null'] },
                  enabled: { type: ['boolean', 'null'] },
                  screen: { type: ['string', 'null'] },
                  jobId: { type: ['string', 'null'] },
                  // R3 (hunter-caught): the dossier ops the prompt advertises were unexpressible —
                  // additionalProperties:false silently stripped them and the validator nulled the rest.
                  text: { type: ['string', 'null'] },
                  factKind: { type: ['string', 'null'] },
                  sectionKind: { type: ['string', 'null'] },
                  label: { type: ['string', 'null'] },
                  entryId: { type: ['string', 'null'] },
                  field: { type: ['string', 'null'] },
                  value: { type: ['string', 'null'] },
                  hide: { type: ['boolean', 'null'] },
                  policy: { type: ['string', 'null'] },
                  eligible: { type: ['boolean', 'null'] },
                },
                required: ['kind', 'entryKind', 'title', 'detail', 'role', 'dream', 'term', 'company', 'query', 'country', 'huntId', 'enabled', 'screen', 'jobId', 'text', 'factKind', 'sectionKind', 'label', 'entryId', 'field', 'value', 'hide', 'policy', 'eligible'],
                additionalProperties: false,
              },
            },
          },
          required: ['reply', 'ops'],
          additionalProperties: false,
        },
      }),
    })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }
  if (!data || data.keyless || !data.result) {
    await recordUsage('agent.global', 'reasoning', 'fallback').catch(() => {})
    return null
  }
  await recordUsage('agent.global', 'reasoning', 'call', data.tokens ?? 0, data.model)

  const r = data.result
  const proposals = (r.ops ?? [])
    .map((raw) => {
      // Strict-mode nulls → drop before validation so `?? ''` semantics hold.
      const cleaned: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) if (v !== null) cleaned[k] = v
      return validateGlobalOp(cleaned, ctx)
    })
    .filter((p): p is GlobalProposal => p !== null)
    .slice(0, 3)
  return { reply: (r.reply || 'Ye propose kar raha hoon — confirm karo toh apply hoga.').slice(0, 700), proposals }
}

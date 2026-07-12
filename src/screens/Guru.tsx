import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { GuruMessage, Job } from '../types'
import { planTurn, runAction, streamGuru } from '../lib/guru/client'
import { buildApplyPlan } from '../lib/guru/applyPlan'

const GREETING: GuruMessage = {
  role: 'assistant',
  content:
    "Namaste Shaurya. I'm Guru — I know your ledger, your targets, and your pipeline. I can find you roles, " +
    'explain any score, build a step-by-step apply plan, or tell you honestly what to learn next. ' +
    "I only ever claim what's in your ledger, and I never promise outcomes. What do you want to do?",
}

const SUGGESTIONS = [
  'Find me new AI internships',
  'What should I learn next?',
  'Where am I in my hunt?',
  'Build an apply plan',
]

export function Guru({ onOpenPacket }: { onOpenPacket: (jobId: string) => void }) {
  const [messages, setMessages] = useState<GuruMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const jobs = useLiveQuery(() => db.jobs.toArray()) ?? []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const userMsg: GuruMessage = { role: 'user', content: text.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setBusy(true)
    setStreaming('')

    try {
      const { routed, useLLM } = await planTurn(text)

      // Try the LLM voice for non-critical intents; fall back to the router's honest text.
      let finalText: string | null = null
      if (useLLM) {
        finalText = await streamGuru(history, (tok) => setStreaming((s) => s + tok))
      }
      const answer = finalText ?? routed.text
      setStreaming('')
      // Router citations ride along when the deterministic reply stands (I7).
      setMessages((m) => [...m, { role: 'assistant', content: answer, citations: finalText ? undefined : routed.citations }])

      // Execute any routed action (sweep etc.) — client-side only, never an external action.
      if (routed.action === 'sweep') {
        const note = await runAction('sweep')
        if (note) setMessages((m) => [...m, { role: 'assistant', content: note }])
      } else if (routed.action === 'derive_hunts') {
        const settings = await db.settings.get('app')
        if (settings?.visionProfile) {
          const { deriveHunts } = await import('../lib/vision/derive')
          const hunts = deriveHunts(settings.visionProfile)
          const existing = new Set((await db.savedHunts.toArray()).map((h) => h.query.toLowerCase()))
          let added = 0
          for (const h of hunts.slice(0, 6)) {
            if (existing.has(h.query.toLowerCase())) continue
            await db.savedHunts.put({ id: `h-vision-${h.query.toLowerCase().replace(/\W+/g, '-')}`, query: h.query, remoteOnly: h.remoteOnly, datePosted: 'month', enabled: true })
            added += 1
          }
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              content: `Derived from your vision: ${hunts.map((h) => h.query).join(', ')}. I added ${added} new one(s) to your saved hunts — run a sweep in Khabri to work them. (You can toggle any off in Khabri; nothing is permanent.)`,
            },
          ])
        }
      } else if (routed.action === 'open_apply_plan') {
        const tailored = jobs.find((j) => j.status === 'tailored') ?? jobs.find((j) => j.packetId)
        if (tailored) await appendApplyPlan(tailored, setMessages, onOpenPacket)
        else setMessages((m) => [...m, { role: 'assistant', content: 'Tailor a packet first (Radar → Tailor, or paste a JD), then ask me again and I\'ll lay out the full apply plan.' }])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-3">
        <h1 className="font-display font-bold text-2xl text-ink flex items-center gap-2">
          Guru <span className="font-devanagari text-lg text-stamp">गुरु</span>
        </h1>
        <p className="text-xs text-ink-soft">
          Knows your ledger and your goals · claims only what you can prove · never promises outcomes.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {streaming && <Bubble msg={{ role: 'assistant', content: streaming }} live />}
        {busy && !streaming && (
          <div className="flex items-center gap-1.5 text-ink-soft text-sm pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-soft animate-nudge" />
            Guru is thinking…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 my-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs border border-paper-edge bg-paper-raised text-ink px-3 py-1.5 rounded-full hover:bg-ink-wash"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="flex-1 bg-paper-sunken px-4 py-3 rounded-lg text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Guru anything about your hunt…"
          aria-label="Message Guru"
          disabled={busy}
        />
        <button
          className="bg-ink text-paper font-semibold px-5 rounded-lg disabled:opacity-50"
          type="submit"
          disabled={busy || !input.trim()}
        >
          Send
        </button>
      </form>
      <p className="text-[10px] text-ink-faint text-center mt-1.5 font-mono">
        Guru guides — you apply. It never submits, sends, or auto-fills. No tool can guarantee selection.
      </p>
    </div>
  )
}

async function appendApplyPlan(
  job: Job,
  setMessages: React.Dispatch<React.SetStateAction<GuruMessage[]>>,
  onOpenPacket: (jobId: string) => void,
) {
  const packet = await db.packets.where('jobId').equals(job.id).first()
  const ledger = await db.ledger.toArray()
  const plan = buildApplyPlan(job, packet, ledger)
  const text = [
    `Apply plan — ${job.title} @ ${job.company}:`,
    ...plan.steps.map((s) => `${s.n}. ${s.action} — ${s.detail}`),
    '',
    'Likely screening questions (answers drafted from your ledger — edit into your own words):',
    ...plan.screeningAnswers.map((sa) => `Q: ${sa.q}\nA: ${sa.a}`),
  ].join('\n')
  setMessages((m) => [...m, { role: 'assistant', content: text }])
  onOpenPacket(job.id)
}

function Bubble({ msg, live }: { msg: GuruMessage; live?: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? 'bg-ink text-paper rounded-br-sm' : 'dossier text-ink rounded-bl-sm'
        } ${live ? 'opacity-90' : ''}`}
      >
        {msg.content}
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-paper-edge/50 space-y-0.5">
            {msg.citations.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noreferrer" className="block font-mono text-[10px] underline decoration-dotted">
                {c.title} ↗
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

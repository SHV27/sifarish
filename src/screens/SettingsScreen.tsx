import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { RUBRIC_LABELS } from '../lib/radar/rubric'
import type { RubricWeights, VisionProfile } from '../types'
import { ensureBudgets, monthKey } from '../lib/budget'
import { deriveHunts, deriveArchetypes, type DerivedHunt } from '../lib/vision/derive'
import { useState, useEffect } from 'react'
import { getLibrary, staleSources, applyLibraryUpdate } from '../lib/ustaad/library'
import { useDarbaan } from '../components/DarbaanControl'
import { GOOGLE_CLIENT_ID } from '../lib/dak/gis'
import { saveFile } from '../lib/util/download'
import { getApiToken } from '../lib/apiGuard'
import { storagePersisted, autoBackup, restoreFromLatest, requestDurableStorage } from '../db/tijori'
import { hasSyncKey, lastSyncAt, syncConfigured, pushVault, pullVault, clearSyncKey } from '../lib/sync'
import { addSavedHunt, syncVisionHunts, proposeHuntEdits } from '../lib/khabri/client'

const KEY_INFO = [
  { name: 'GROQ_API_KEY', enables: 'Guru chat + resume polish', without: 'Guru uses its deterministic router; resume stays as compiled' },
  { name: 'TAVILY_API_KEY', enables: 'Hiring signals, company intel, market pulse', without: 'Discovery runs on the free lanes; no signal/intel/pulse' },
  { name: 'JSEARCH_API_KEY', enables: 'LinkedIn/Indeed/Glassdoor job aggregation', without: 'Discovery via Hacker News + Remotive + RemoteOK' },
  { name: 'GITHUB_PAT', enables: 'Nabz at 5,000 req/hr', without: 'Nabz at 60 req/hr (still works)' },
]

export function SettingsScreen({ onNav }: { onNav?: (s: 'shelf' | 'khabri' | 'radar' | 'packet' | 'guru' | 'morcha' | 'settings') => void }) {
  const settings = useLiveQuery(() => db.settings.get('app'))
  const watchlist = useLiveQuery(() => db.watchlist.orderBy('id').toArray()) ?? []
  const budgets = useLiveQuery(async () => {
    await ensureBudgets()
    return db.budgets.toArray()
  }) ?? []
  if (!settings) return null

  return (
    <div className="max-w-3xl">
      <h1 className="font-display font-bold text-3xl text-ink mb-6">Settings</h1>

      {settings.visionProfile && <VisionEditor vision={settings.visionProfile} />}

      <section className="dossier p-4 mb-5" aria-label="Keys status">
        <h2 className="font-display font-semibold text-lg text-ink">Keys</h2>
        <p className="text-sm text-ink mt-2 mb-3">
          <span className="stamp stamp-shipped mr-2">Keyless mode works</span>
          Every pillar runs with zero keys. Keys are amplifiers, set server-side on Vercel (never in the
          browser bundle). This panel shows what each unlocks — it never shows a key value.
        </p>
        <div className="space-y-1.5">
          {KEY_INFO.map((k) => (
            <div key={k.name} className="text-xs grid sm:grid-cols-[160px_1fr] gap-x-3 gap-y-0.5 py-1.5 ledger-rule">
              <code className="font-mono text-ink">{k.name}</code>
              <div>
                <p className="text-ink">
                  <span className="text-shipped font-medium">unlocks:</span> {k.enables}
                </p>
                <p className="text-ink-soft">
                  <span className="font-medium">without:</span> {k.without}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dossier p-4 mb-5" aria-label="API budgets">
        <h2 className="font-display font-semibold text-lg text-ink">API budgets (I8 — no silent burn)</h2>
        <p className="text-xs text-ink-soft mt-1 mb-3">Metered usage this month. Sweeps refuse to exceed the monthly cap and degrade to keyless lanes.</p>
        <div className="space-y-3">
          {budgets.map((b) => {
            const pct = b.monthlyCap > 0 ? Math.min(100, Math.round((b.used / b.monthlyCap) * 100)) : 0 // guard 0-cap (bug B3)
            return (
              <div key={b.id}>
                <div className="flex justify-between text-xs text-ink mb-1">
                  <span>{b.label}</span>
                  <span className="font-mono text-ink-soft">
                    {b.used}/{b.monthlyCap} {b.unit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-paper-sunken border border-paper-edge overflow-hidden">
                  <div className={`h-full ${pct > 85 ? 'bg-stamp' : 'bg-shipped'} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <DimaagLedger />

      <DarbaanSection />

      <UstaadSection />

      <section className="dossier p-4 mb-5" aria-label="Dak Khana">
        <h2 className="font-display font-semibold text-lg text-ink">Dak Khana (mail vigilance)</h2>
        <p className="text-xs text-ink-soft mt-1 leading-relaxed">
          Connect from the{' '}
          <button className="font-semibold underline decoration-dotted hover:text-stamp" onClick={() => onNav?.('morcha')}>
            Morcha board →
          </button>
          . Scope is <code className="font-mono">gmail.readonly</code>{' '}
          only — sending is structurally impossible (I3); mail is read in this browser and never touches a server
          of ours. OAuth Client ID (public-safe): <code className="font-mono text-[10px]">{GOOGLE_CLIENT_ID.slice(0, 18)}…</code>
        </p>
      </section>

      {settings.rubricChangelog && settings.rubricChangelog.length > 0 && (
        <section className="dossier p-4 mb-5" aria-label="Rubric changelog">
          <h2 className="font-display font-semibold text-lg text-ink">Rubric changelog</h2>
          <p className="text-xs text-ink-soft mt-1 mb-2">Append-only. The Pulse Loop proposes changes; you confirm each.</p>
          <ul className="space-y-1">
            {settings.rubricChangelog.slice().reverse().slice(0, 8).map((c, i) => (
              <li key={i} className="text-xs text-ink-soft flex gap-2">
                <span className="font-mono text-[10px] text-ink-faint shrink-0">{c.at.slice(0, 10)}</span>
                <span>{c.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dossier p-4 mb-5" aria-label="Scoring rubric">
        <h2 className="font-display font-semibold text-lg text-ink">Scoring rubric</h2>
        <p className="text-xs text-ink-soft mt-1">Weights are points out of 100. Every score in the Radar expands to show its arithmetic.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {(Object.keys(RUBRIC_LABELS) as (keyof RubricWeights)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 text-sm text-ink">
              {RUBRIC_LABELS[k]}
              <input
                type="number"
                min={0}
                max={50}
                className="w-16 bg-paper-sunken px-2 py-1 rounded font-mono text-xs text-right"
                value={settings.rubric[k]}
                onChange={(e) =>
                  db.settings.update('app', { rubric: { ...settings.rubric, [k]: Number(e.target.value) || 0 } })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="dossier p-4 mb-5" aria-label="Weekly quota">
        <h2 className="font-display font-semibold text-lg text-ink">Sniper quota</h2>
        <label className="flex items-center justify-between gap-3 text-sm text-ink mt-2 max-w-xs">
          Applications per week
          <input
            type="number"
            min={1}
            max={30}
            className="w-16 bg-paper-sunken px-2 py-1 rounded font-mono text-xs text-right"
            value={settings.weeklyQuota}
            onChange={(e) => db.settings.update('app', { weeklyQuota: Number(e.target.value) || 10 })}
          />
        </label>
        <p className="text-xs text-ink-soft mt-2">The cap is a feature: few, deep, truthful applications beat spray.</p>
      </section>

      <section className="dossier p-4" aria-label="Watchlist">
        <h2 className="font-display font-semibold text-lg text-ink">Watchlist</h2>
        <p className="text-xs text-ink-soft mt-1">Every token probed live at build; ★ = conviction (worth +{settings.rubric.conviction} points).</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
          {watchlist.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-sm text-ink bg-paper-sunken/60 rounded px-3 py-1.5">
              <input
                type="checkbox"
                checked={w.enabled}
                onChange={(e) => db.watchlist.update(w.id, { enabled: e.target.checked })}
                aria-label={`Enable ${w.company}`}
              />
              <span className="truncate">{w.company}</span>
              <span className="font-mono text-[10px] text-ink-soft">{w.source}</span>
              {/* S5.10 — a company whose feed returned ZERO open roles is DORMANT: visibly so,
                  token kept (they may reopen), and with no jobs it can never eat a queue slot. */}
              {w.lastChecked && w.lastJobCount === 0 && (
                <span className="stamp !text-[8px] text-ink-soft border-paper-edge" title={`No open roles on last scan (${new Date(w.lastChecked).toLocaleDateString()}). Token kept — they may reopen.`}>
                  DORMANT
                </span>
              )}
              <button
                className={`ml-auto ${w.starred ? 'text-forge' : 'text-ink-faint'}`}
                onClick={() => db.watchlist.update(w.id, { starred: !w.starred })}
                aria-label={`${w.starred ? 'Unstar' : 'Star'} ${w.company}`}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** DARBAAN (P16): encrypted backup, restore, and the owner seed — all Owner-Mode-gated. */
function DarbaanSection() {
  const owner = useDarbaan()
  const [pass, setPass] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const doExport = async () => {
    if (!pass) return setNote('Enter your passcode — it derives the encryption key.')
    setBusy(true)
    try {
      const { exportBackup } = await import('../lib/darbaan/backup')
      const text = await exportBackup(pass)
      saveFile(new TextEncoder().encode(text), `sifarish-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
      setNote('Backup exported — encrypted with your passcode (AES-256-GCM). Keep it somewhere safe.')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File) => {
    if (!pass) return setNote('Enter the passcode the backup was encrypted with.')
    setBusy(true)
    try {
      const { importBackup } = await import('../lib/darbaan/backup')
      const r = await importBackup(await file.text(), pass)
      setNote(r.ok ? `Restored: ${Object.entries(r.counts ?? {}).map(([t, n]) => `${t} ${n}`).join(', ')}.` : `Import failed: ${r.reason}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dossier p-4 mb-5" aria-label="Darbaan — owner data">
      <h2 className="font-display font-semibold text-lg text-ink">
        Darbaan <span className="font-devanagari text-sm text-stamp">दरबान</span> · Tijori
      </h2>
      <p className="text-xs text-ink-soft mt-1 leading-relaxed">
        Your real ledger lives in its own owner vault (separate from the demo store — they can never mix).
        It is auto-backed-up after every edit, and durable storage is requested so nothing is evicted.
      </p>
      {!owner ? (
        <p className="mt-2 text-xs font-mono text-ink-soft">🔑 Unlock Owner Mode (header) to manage your vault.</p>
      ) : (
        <>
          <TijoriVault />
          <div className="mt-3 ledger-rule pt-3">
            <p className="text-xs font-medium text-ink mb-1.5">Manual encrypted backup file (extra safety)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                className="text-xs bg-paper-sunken px-3 py-2 rounded w-44"
                placeholder="passcode (encryption key)"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                aria-label="Backup passcode"
              />
              <button className="text-xs font-semibold bg-ink text-paper px-3 py-2 rounded disabled:opacity-50" disabled={busy} onClick={() => void doExport()}>
                Download encrypted backup
              </button>
              <label className="text-xs font-semibold border border-ink text-ink px-3 py-2 rounded cursor-pointer">
                Import backup file
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void doImport(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
          {note && <p className="mt-2 text-[11px] font-mono text-ink-soft">{note}</p>}
          <SyncStatus />
          <ApiTokenField />
        </>
      )}
    </section>
  )
}

/** Tijori vault status: durable-storage state + in-app encrypted snapshots (auto + on-demand). */
function TijoriVault() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const backups = useLiveQuery(() => db.backups.orderBy('at').reverse().toArray()) ?? []
  useEffect(() => {
    void storagePersisted().then(setPersisted)
  }, [])

  const makeBackup = async () => {
    const snap = await autoBackup()
    setNote(snap ? `Snapshot saved (${snap.ledgerCount} ledger entries).` : 'Could not snapshot.')
  }
  const restore = async () => {
    const counts = await restoreFromLatest()
    setNote(counts ? `Restored latest snapshot: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ')}.` : 'No snapshot to restore.')
  }
  const requestDurable = async () => {
    setPersisted(await requestDurableStorage())
  }

  return (
    <div className="mt-3 grid sm:grid-cols-2 gap-3">
      <div className="bg-paper-sunken/60 rounded p-3">
        <p className="text-[11px] text-ink-soft">Storage durability</p>
        {persisted === null ? (
          <p className="text-xs font-mono text-ink-soft">checking…</p>
        ) : persisted ? (
          <p className="text-xs font-mono text-shipped">Persistent ✓ — the browser won't evict your data.</p>
        ) : (
          <div>
            <p className="text-xs font-mono text-stamp">Best-effort — could be evicted.</p>
            <button className="mt-1 text-[11px] font-semibold text-ink underline" onClick={() => void requestDurable()}>
              request durable storage →
            </button>
          </div>
        )}
      </div>
      <div className="bg-paper-sunken/60 rounded p-3">
        <p className="text-[11px] text-ink-soft">Auto-backups kept: <span className="font-mono text-ink">{backups.length}</span></p>
        <p className="text-[10px] text-ink-faint">{backups[0] ? `latest ${new Date(backups[0].at).toLocaleString('en-IN')}` : 'none yet — edit something'}</p>
        <div className="mt-1 flex gap-3">
          <button className="text-[11px] font-semibold text-ink underline" onClick={() => void makeBackup()}>backup now</button>
          <button className="text-[11px] font-semibold text-ink underline disabled:opacity-40" disabled={backups.length === 0} onClick={() => void restore()}>restore latest</button>
        </div>
      </div>
      {note && <p className="sm:col-span-2 text-[11px] font-mono text-ink-soft">{note}</p>}
    </div>
  )
}

/**
 * CROSS-DEVICE SYNC (Session 5.3) — status + manual controls. Server-blind: the cloud holds only
 * ciphertext (AES-256-GCM, key derived from the owner passcode the server never sees). Fully
 * fail-safe — if sync isn't provisioned or a call fails, the app stays local-first and loses nothing.
 */
function SyncStatus() {
  const [provisioned, setProvisioned] = useState<boolean | null>(null)
  const [keyed] = useState<boolean>(hasSyncKey())
  const [last, setLast] = useState<number>(lastSyncAt())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    void syncConfigured().then(setProvisioned)
  }, [])

  const syncNow = async () => {
    setBusy(true)
    setNote('')
    try {
      const pulled = await pullVault()
      const pushed = await pushVault()
      setLast(lastSyncAt())
      setNote(
        pulled.restored
          ? 'Pulled newer data from the cloud and merged it in.'
          : pushed
            ? 'This device is the latest — cloud updated.'
            : 'Already in sync.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 ledger-rule pt-3">
      <p className="text-xs font-medium text-ink">Cross-device sync <span className="font-devanagari text-stamp">तालमेल</span></p>
      <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
        {provisioned === false ? (
          <>Not provisioned on this deployment — your data stays on this device (local-first, never lost).</>
        ) : !keyed ? (
          <>Unlock Owner Mode again (via the gate) to derive this device's sync key, then your ledger follows you everywhere.</>
        ) : (
          <>
            <span className="text-shipped font-semibold">On ✓</span> — open Owner Mode from any device, anywhere,
            and your ledger arrives up to date. The cloud stores only ciphertext it can never read
            (server-blind, AES-256-GCM). {last > 0 ? `Last synced ${new Date(last).toLocaleString('en-IN')}.` : 'Not yet synced on this device.'}
          </>
        )}
      </p>
      {keyed && provisioned !== false && (
        <span className="flex items-center gap-3">
          <button
            className="mt-2 text-[11px] font-semibold bg-ink text-paper px-3 py-1.5 rounded disabled:opacity-50"
            disabled={busy}
            onClick={() => void syncNow()}
          >
            {busy ? 'syncing…' : 'Sync now'}
          </button>
          {/* S5.10 wiring audit: clearSyncKey existed with no path to it — a shared/borrowed
              device needs a way to forget the derived key without touching the vault. */}
          <button
            className="mt-2 text-[11px] text-ink-soft hover:underline"
            onClick={() => {
              clearSyncKey()
              setNote('Sync key forgotten on this device — local data untouched. Unlock Owner Mode again to re-derive it.')
            }}
          >
            forget sync key on this device
          </button>
        </span>
      )}
      {note && <p className="mt-1.5 text-[11px] font-mono text-ink-soft">{note}</p>}
    </div>
  )
}

/** The metered-API guard status (D46) — auto-managed by the owner login, never hand-edited. */
function ApiTokenField() {
  const token = getApiToken()
  return (
    <div className="mt-3 ledger-rule pt-3">
      <p className="text-xs font-medium text-ink">Metered-API guard (D46)</p>
      <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
        {token ? (
          <>
            <span className="text-shipped font-semibold">Active ✓</span> — your owner login issued the API
            token automatically; every Groq/Tavily/JSearch call carries it, and the server refuses to spend
            without it. Demo visitors are structurally keyless.
          </>
        ) : (
          <>
            No API token on this device — metered calls will degrade to the keyless path. Lock and unlock
            Owner Mode again (via the gate) to be issued one.
          </>
        )}{' '}
        The owner code itself lives only in the Vercel env (<code className="font-mono">SIFARISH_OWNER_PASSCODE</code>);
        change it there anytime, then unlock again.
      </p>
    </div>
  )
}

/** USTAAD (P13, I13): the craft library's version, citations, and staleness — visible, never trusted blind. */
function UstaadSection() {
  const lib = getLibrary()
  const stale = staleSources()
  const [updateJson, setUpdateJson] = useState('')
  const [updateNote, setUpdateNote] = useState('')
  const applyUpdate = async () => {
    // S5.10 wiring audit: applyLibraryUpdate was the WRITE half of the I13 loop and no UI ever
    // called it — loadLibraryOverride at boot had nothing to load. This is the owner-confirmed
    // door: paste a Pulse-proposed (or hand-authored) library JSON; it applies only if it
    // validates AND is strictly newer.
    const r = await applyLibraryUpdate(updateJson)
    setUpdateNote(r.ok ? 'Library updated ✓ — the new patterns reach every reasoning pass immediately.' : `Rejected: ${r.reason}.`)
    if (r.ok) setUpdateJson('')
  }
  return (
    <section className="dossier p-4 mb-5" aria-label="Ustaad library">
      <h2 className="font-display font-semibold text-lg text-ink">
        Ustaad Library <span className="font-devanagari text-sm text-stamp">उस्ताद</span>
      </h2>
      <p className="text-xs text-ink-soft mt-1 leading-relaxed">
        All resume-craft knowledge lives as versioned, dated, cited DATA (I13) — Pulse proposes refreshes; you
        confirm. Nothing here is hardcoded folklore.
      </p>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          ['version', lib.version],
          ['updated', lib.updatedAt],
          ['sources', String(lib.sources.length)],
          ['patterns', String(lib.patterns.length)],
        ].map(([label, val]) => (
          <div key={label} className="bg-paper-sunken/60 rounded py-2">
            <div className="font-mono text-xs font-semibold text-ink">{val}</div>
            <div className="text-[10px] text-ink-soft">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-mono">
        {stale.length === 0 ? (
          <span className="text-shipped">All {lib.sources.length} sources verified within 12 months.</span>
        ) : (
          <span className="text-stamp">{stale.length} source(s) stale (&gt;12 months) — flagged, never silently trusted. Pulse has proposed a review.</span>
        )}
      </p>
      <details className="mt-2">
        <summary className="text-[11px] text-ink-soft cursor-pointer hover:text-ink">▸ apply a library update (version-checked, cited-only)</summary>
        <textarea
          className="mt-2 w-full bg-paper-sunken px-2 py-1.5 rounded font-mono text-[10px]"
          rows={4}
          value={updateJson}
          onChange={(e) => setUpdateJson(e.target.value)}
          placeholder='Paste a full library JSON (version must be newer; every pattern must cite a source) — Pulse review proposals point here.'
          aria-label="Library update JSON"
        />
        <button className="mt-1 text-[11px] font-semibold bg-ink text-paper px-3 py-1 rounded disabled:opacity-50" disabled={!updateJson.trim()} onClick={() => void applyUpdate()}>
          Validate & apply
        </button>
        {updateNote && <p className="mt-1 text-[11px] font-mono text-ink-soft">{updateNote}</p>}
      </details>
    </section>
  )
}

function DimaagLedger() {
  const mk = monthKey()
  const rows = useLiveQuery(() => db.dimaagUsage.where('monthKey').equals(mk).toArray(), [mk]) ?? []
  const totals = rows.reduce(
    (t, r) => ({ calls: t.calls + r.calls, tokens: t.tokens + r.tokens, hits: t.hits + r.cacheHits, fb: t.fb + r.fallbacks }),
    { calls: 0, tokens: 0, hits: 0, fb: 0 },
  )
  const totalDecisions = totals.calls + totals.hits + totals.fb
  const hitRate = totalDecisions > 0 ? Math.round((totals.hits / totalDecisions) * 100) : 0

  return (
    <section className="dossier p-4 mb-5" aria-label="Dimaag Ledger">
      <h2 className="font-display font-semibold text-lg text-ink">
        Dimaag Ledger <span className="font-devanagari text-sm text-stamp">दिमाग़</span>
      </h2>
      <p className="text-xs text-ink-soft mt-1 mb-3">
        Every reasoning call this month, by feature. Identical inputs are served from cache (0 cost);
        keyless / over-budget decisions use the deterministic heuristic (0 cost). Optimization is a feature.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-soft">No reasoning yet this month. Tailor a packet or edit your vision to see the Dimaag work.</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            {[
              ['LLM calls', totals.calls, 'text-ink'],
              ['cache hits', totals.hits, 'text-shipped'],
              ['heuristic', totals.fb, 'text-forge'],
              ['tokens', totals.tokens, 'text-ink-soft'],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="bg-paper-sunken/60 rounded py-2">
                <div className={`font-mono font-semibold ${cls}`}>{val as number}</div>
                <div className="text-[10px] text-ink-soft">{label as string}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-soft mb-2">
            Cache hit-rate: <span className="font-mono text-shipped font-semibold">{hitRate}%</span> — reused reasoning that cost nothing.
          </p>
          <div className="space-y-1">
            {rows.slice().sort((a, b) => b.calls - a.calls).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs ledger-rule pt-1">
                <span className="text-ink">{r.feature}</span>
                <span className="font-mono text-ink-soft">
                  {r.calls} call{r.calls === 1 ? '' : 's'} · {r.cacheHits} cached · {r.fallbacks} heuristic · {r.tokens} tok
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// Session 5.8 — an edited vision used to re-rank the queue immediately (live query) but the NEW
// hunt queries it implies waited for the next app open (syncVisionHunts only ran in autopilot).
// Now every vision edit re-reconciles hunts after a short debounce. Additive + idempotent by
// construction (syncVisionHunts never touches a hunt he set by hand), so firing it on keystrokes
// is safe; deterministic + zero budget, zero key.
let visionHuntTimer: ReturnType<typeof setTimeout> | undefined

function VisionEditor({ vision }: { vision: VisionProfile }) {
  const save = async (patch: Partial<VisionProfile>) => {
    const next = { ...vision, ...patch }
    await db.settings.update('app', { visionProfile: next })
    clearTimeout(visionHuntTimer)
    visionHuntTimer = setTimeout(() => {
      // Add what the new vision implies AND propose retiring what it no longer does (S5.10 —
      // both halves of D99; the retirement is a Pulse brief he confirms, never a silent change).
      syncVisionHunts(next)
        .then(() => proposeHuntEdits(next))
        .catch(() => {})
    }, 1500)
  }
  return (
    <section className="dossier p-4 mb-5" aria-label="Vision profile">
      <h2 className="font-display font-semibold text-lg text-ink">Vision Profile</h2>
      <p className="text-xs text-ink-soft mt-1 mb-3">
        What you actually want. Guru reads this to guide you — the more honest it is, the sharper the guidance.
      </p>
      <label className="block text-xs font-medium text-ink mb-1">Your dream, in a sentence</label>
      <textarea
        className="w-full bg-paper-sunken px-3 py-2 rounded text-xs mb-3"
        rows={2}
        value={vision.dream}
        onChange={(e) => save({ dream: e.target.value })}
        aria-label="Dream statement"
      />
      {/* Session 5.5 (bug B2): the Vision Lens's STRONGEST ranking levers — the roles you actually want
          (title match, the biggest boost) and the lanes you don't (a real penalty) — were frozen at the
          seed with no way to edit them. This is exactly what LinkedIn ranks on; now you tune it. */}
      <label className="block text-xs font-medium text-ink mb-1">Target roles — the titles you actually want (one per line)</label>
      <textarea
        className="w-full bg-paper-sunken px-3 py-2 rounded text-xs mb-1 font-mono"
        rows={3}
        value={(vision.targetRoles ?? []).join('\n')}
        onChange={(e) => save({ targetRoles: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        aria-label="Target roles"
        placeholder={'Agentic AI Engineer\nApplied AI Engineer\nLLM Engineer'}
      />
      <p className="text-[11px] text-ink-soft mb-3">The Radar ranks a role higher when its title matches one of these — the single biggest signal in the score.</p>
      <label className="block text-xs font-medium text-ink mb-1">Not interested in — lanes to push DOWN (one per line)</label>
      <textarea
        className="w-full bg-paper-sunken px-3 py-2 rounded text-xs mb-3 font-mono"
        rows={2}
        value={(vision.notInterested ?? []).join('\n')}
        onChange={(e) => save({ notInterested: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        aria-label="Not interested"
        placeholder={'Pure frontend\nNon-AI QA / support\nGeneric SDE / mass-MNC'}
      />
      {/* Session 6 (P7): per-company aggregator hunts — the lawful reach into companies whose ATS
          has no public feed (their postings ARE on LinkedIn/Indeed, which JSearch indexes). */}
      <label className="block text-xs font-medium text-ink mb-1">Dream companies — hunted by name every sweep (one per line)</label>
      <textarea
        className="w-full bg-paper-sunken px-3 py-2 rounded text-xs mb-1 font-mono"
        rows={2}
        value={(vision.dreamCompanies ?? []).join('\n')}
        onChange={(e) => save({ dreamCompanies: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        aria-label="Dream companies"
        placeholder={'Netomi\nWeekday\nWingify'}
      />
      <p className="text-[11px] text-ink-soft mb-3">
        Each name becomes a per-company hunt on the aggregator lanes — the door to companies whose career
        sites publish no public feed. Their postings reach the Radar the sweep they appear.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-ink">
          Stipend floor (₹/month)
          <input
            type="number"
            className="mt-1 w-full bg-paper-sunken px-2 py-1 rounded font-mono text-xs"
            value={vision.compFloorStipend}
            onChange={(e) => save({ compFloorStipend: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-xs text-ink">
          PPO floor (LPA)
          <input
            type="number"
            className="mt-1 w-full bg-paper-sunken px-2 py-1 rounded font-mono text-xs"
            value={vision.ppoFloorLpa}
            onChange={(e) => save({ ppoFloorLpa: Number(e.target.value) || 0 })}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink mt-3">
        <input type="checkbox" checked={vision.remoteInternational} onChange={(e) => save({ remoteInternational: e.target.checked })} />
        Open to remote-international
      </label>
      <label className="flex items-center gap-2 text-xs text-ink mt-1.5">
        <input type="checkbox" checked={vision.openToOctoberStart} onChange={(e) => save({ openToOctoberStart: e.target.checked })} />
        Open to an October start
      </label>

      <VisionDerivation vision={vision} />
    </section>
  )
}

/** Vision Engine (P12): derive hunt queries + archetypes from the dream; human confirms each. */
function VisionDerivation({ vision }: { vision: VisionProfile }) {
  const [hunts, setHunts] = useState<DerivedHunt[] | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const archetypes = deriveArchetypes(vision)

  const existing = useLiveQuery(() => db.savedHunts.toArray()) ?? []
  const existingQueries = new Set(existing.map((h) => h.query.toLowerCase()))

  const derive = () => setHunts(deriveHunts(vision))

  // Session 7.2 (C5): one addHunt() helper — week-fresh + derived:true (retirement-eligible).
  // This site used to write 'month' windows (the exact D66 bug, re-introduced at an edge).
  const addHunt = async (h: DerivedHunt) => {
    await addSavedHunt({ query: h.query, remoteOnly: h.remoteOnly, derived: true })
    setAdded((s) => new Set(s).add(h.query))
  }

  return (
    <div className="mt-4 ledger-rule pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink">Derive the hunt from your dream</p>
        <button className="text-xs font-semibold bg-ink text-paper px-3 py-1.5 rounded" onClick={derive}>
          Derive hunts →
        </button>
      </div>
      {archetypes.length > 0 && (
        <p className="text-[11px] text-ink-soft mt-2">
          Your vision reads as: {archetypes.map((a) => a.label).join(' · ')}. These drive resume casting.
        </p>
      )}
      {hunts && (
        <div className="mt-2 space-y-1.5">
          {hunts.map((h) => {
            const already = existingQueries.has(h.query.toLowerCase()) || added.has(h.query)
            return (
              <div key={h.query} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-ink">
                  <strong>{h.query}</strong> <span className="text-ink-soft">— {h.why}</span>
                </span>
                <button
                  className="shrink-0 font-medium text-shipped hover:underline disabled:text-ink-faint disabled:no-underline"
                  disabled={already}
                  onClick={() => addHunt(h)}
                >
                  {already ? 'in hunts ✓' : 'add hunt'}
                </button>
              </div>
            )
          })}
          <p className="text-[10px] text-ink-faint mt-1">
            Every derived hunt is a suggestion — you confirm each one. Nothing is added silently.
          </p>
        </div>
      )}
    </div>
  )
}

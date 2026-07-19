import { useEffect, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { Shelf } from './screens/Shelf'
import { Khabri } from './screens/Khabri'
import { Radar } from './screens/Radar'
import { PacketScreen } from './screens/PacketScreen'
import { Guru } from './screens/Guru'
import { Morcha } from './screens/Morcha'
import { SettingsScreen } from './screens/SettingsScreen'
import { Onboarding } from './screens/Onboarding'
import { HeaderStrip } from './components/HeaderStrip'
import DarbaanControl, { DarshakBanner } from './components/DarbaanControl'
import DimaagPulse from './components/DimaagPulse'
import GateScreen from './components/GateScreen'
import { usePehchaan, chooseDemoMode } from './lib/pehchaan'

export type Screen = 'shelf' | 'khabri' | 'radar' | 'packet' | 'guru' | 'morcha' | 'settings'

const NAV: { key: Screen; label: string; hindi: string }[] = [
  { key: 'shelf', label: 'Ledger', hindi: 'सच' },
  { key: 'khabri', label: 'Khabri', hindi: 'ख़बरी' },
  { key: 'radar', label: 'Radar', hindi: 'शिकार' },
  { key: 'packet', label: 'Packet', hindi: 'दर्ज़ी' },
  { key: 'guru', label: 'Guru', hindi: 'गुरु' },
  { key: 'morcha', label: 'Morcha', hindi: 'मोर्चा' },
  { key: 'settings', label: 'Settings', hindi: '⚙' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('shelf')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const settings = useLiveQuery(() => db.settings.get('app'))
  const { mode, boot } = usePehchaan()
  const owner = mode === 'owner'

  const openPacket = useCallback((jobId: string) => {
    setActiveJobId(jobId)
    setScreen('packet')
  }, [])

  // Autopilot: keep discovery + market pulse current in the background (budget-capped; human
  // still confirms every change). Runs once per session, only when due. The app stays present-tense.
  useEffect(() => {
    // Autopilot mutates jobs/settings — Owner Mode only (I12); the showcase never self-mutates.
    if (settings?.onboarded && owner) {
      import('./lib/autopilot').then((m) => m.runAutopilot()).catch(() => {})
    }
  }, [settings?.onboarded, owner])

  // Keyboard map: 1–5 switch screens (never while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const idx = ['1', '2', '3', '4', '5', '6', '7'].indexOf(e.key)
      if (idx >= 0 && idx < NAV.length) setScreen(NAV[idx].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The Gate first (PEHCHAAN boot state): undecided visitor picks Owner (server-verified) or Demo.
  if (boot === 'gate') return <GateScreen onDemo={chooseDemoMode} />
  if (settings === undefined) return null // Dexie warming up; sub-frame flash only
  // Onboarding writes data → Owner Mode only. A demo visitor skips straight to the
  // read-only showcase on the demo seed — the guided tour IS the app itself.
  if (!settings?.onboarded && owner) return <Onboarding onDone={openPacket} />

  return (
    <div className="min-h-screen flex flex-col">
      <DarshakBanner />
      <div className="flex-1 flex min-h-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink focus:text-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Sidebar */}
      <nav aria-label="Primary" className="w-16 sm:w-52 shrink-0 border-r border-paper-edge bg-paper-sunken/40 flex flex-col">
        <div className="px-3 sm:px-5 py-5 border-b border-paper-edge">
          <div className="font-display font-black text-xl text-ink leading-none hidden sm:block">SIFARISH</div>
          <div className="font-devanagari text-stamp text-sm sm:text-xs sm:mt-1">सिफ़ारिश</div>
          <div className="hidden sm:block font-mono text-[10px] text-ink-soft mt-2 leading-tight">
            Compile truth.<br />Draft everything.<br />Send nothing.
          </div>
        </div>
        <ul className="flex-1 py-3">
          {NAV.map((n, i) => (
            <li key={n.key}>
              <button
                onClick={() => setScreen(n.key)}
                aria-current={screen === n.key ? 'page' : undefined}
                className={`w-full text-left px-3 sm:px-5 py-2.5 flex items-center gap-2 font-medium text-sm transition-colors
                  ${screen === n.key ? 'bg-ink text-paper' : 'text-ink hover:bg-ink-wash'}`}
              >
                <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
                <span className="hidden sm:inline">{n.label}</span>
                <span className={`font-devanagari text-xs ${screen === n.key ? 'opacity-80' : 'opacity-50'} sm:ml-auto`}>
                  {n.hindi}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-3 sm:px-5 py-3 border-t border-paper-edge hidden sm:block">
          <p className="font-mono text-[10px] text-ink-soft leading-snug">
            Keyless mode — fully functional. No key ever required.
          </p>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 border-b border-paper-edge pr-4">
          <div className="flex-1 min-w-0">
            <HeaderStrip />
          </div>
          <DimaagPulse />
          <DarbaanControl />
        </div>
        <main id="main" className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {screen === 'shelf' && <Shelf onNav={setScreen} onTailor={openPacket} />}
          {screen === 'khabri' && <Khabri onOpenRadar={() => setScreen('radar')} onOpenSettings={() => setScreen('settings')} />}
          {screen === 'radar' && <Radar onTailor={openPacket} />}
          {screen === 'packet' && <PacketScreen jobId={activeJobId} onPickJob={openPacket} />}
          {screen === 'guru' && <Guru onOpenPacket={openPacket} onNav={setScreen} />}
          {screen === 'morcha' && <Morcha onOpenPacket={openPacket} onNav={setScreen} />}
          {screen === 'settings' && <SettingsScreen onNav={setScreen} />}
        </main>
      </div>
      </div>
    </div>
  )
}

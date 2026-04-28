'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScheduleModal } from './components/ScheduleModal'

// ── Types ──────────────────────────────────────────────────
type PatternId = 'fall' | 'july' | 'xmas' | 'normal' | 'alert' | 'blue' | 'pink' | 'off'
type Status = 'idle' | 'sending' | 'success' | 'error'

interface Pattern {
  id: PatternId
  label: string
  shortLabel: string
  desc: string
  colors: string[]
}

interface Settings {
  aio_username: string
  aio_key: string
  aio_feed: string
}

// ── Pattern Definitions ────────────────────────────────────
const PATTERNS: Pattern[] = [
  { id: 'fall',   label: 'AUTUMN',   shortLabel: 'FALL',   desc: 'WARM.CYCLE',    colors: ['#ff6b00', '#ffaa00', '#cc2200'] },
  { id: 'july',   label: 'LIBERTY',  shortLabel: 'JULY',   desc: 'PATRIOT.MODE',  colors: ['#cc0000', '#dddddd', '#0044ff'] },
  { id: 'xmas',   label: 'HOLIDAY',  shortLabel: 'XMAS',   desc: 'FESTIVE.SEQ',   colors: ['#cc0000', '#00aa44', '#dddddd'] },
  { id: 'normal', label: 'SPECTRUM', shortLabel: 'NORM',   desc: 'RAINBOW.ALG',   colors: ['#ff0000', '#00cc00', '#0000ff', '#ffff00'] },
  { id: 'alert',  label: 'CAUTION',  shortLabel: 'ALRT',   desc: 'WARNING.SIG',   colors: ['#ffdd00', '#ff8800'] },
  { id: 'blue',   label: 'COBALT',   shortLabel: 'BLUE',   desc: 'MONO.BLUE',     colors: ['#0088ff', '#0044cc'] },
  { id: 'pink',   label: 'MAGENTA',  shortLabel: 'PINK',   desc: 'MONO.PINK',     colors: ['#ff00aa', '#cc0088'] },
  { id: 'off',    label: 'STANDBY',  shortLabel: 'OFF',    desc: 'POWER.DOWN',    colors: ['#444444', '#222222'] },
]

const BOOT_LINES = [
  'CHROMACORE-90 FIRMWARE v1.0.4 BUILD 20241219',
  'INIT SEESAW I2C DRIVER... [ADDR 0x60] [OK]',
  'NEOPIXEL STRIP DETECTED: 90 PIXELS [GRB] [OK]',
  'CONNECTING TO ADAFRUIT.IO MQTT BROKER...',
  'FEED SUBSCRIBED: neopixel-pattern',
  '>>> SYSTEM READY. AWAITING COMMANDS. <<<',
]

// ── SVG Icons ──────────────────────────────────────────────
function PatternIcon({ id, size = 40 }: { id: PatternId; size?: number }) {
  const props = { width: size, height: size, 'aria-hidden': true }

  switch (id) {
    case 'fall':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 8C8 10 5.9 16.17 3.82 19.19L5.71 21 6.66 19.51A20 20 0 018.6 16.89C9.5 17.56 10.54 18 12 18c4 0 8-4 8-10 0 0-2-2-3 0z"/>
          <path d="M12 4C9 7 6 10 4 13l1.5 1.5C7 12 9.5 8.5 12 4z" opacity=".7"/>
        </svg>
      )
    case 'july':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      )
    case 'xmas':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L9 7h2L7 13h3L5 20h14l-5-7h3l-4-6h2L12 2z"/>
          <rect x="10" y="20" width="4" height="2.5"/>
        </svg>
      )
    case 'normal':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 12 Q5 4 8 12 Q11 20 14 12 Q17 4 20 12"/>
          <line x1="1" y1="12" x2="3" y2="12" strokeWidth="1.5" opacity=".5"/>
          <line x1="21" y1="12" x2="23" y2="12" strokeWidth="1.5" opacity=".5"/>
        </svg>
      )
    case 'alert':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21z"/>
          <rect x="11" y="10" width="2" height="5" fill="var(--bg-card, #0d1f0d)"/>
          <rect x="11" y="16" width="2" height="2" fill="var(--bg-card, #0d1f0d)"/>
        </svg>
      )
    case 'blue':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C12 2 4 11 4 16.5A8 8 0 0020 16.5C20 11 12 2 12 2z"/>
        </svg>
      )
    case 'pink':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5A5.5 5.5 0 0112 5.08 5.5 5.5 0 0122 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      )
    case 'off':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18.36 6.64a9 9 0 11-12.73 0"/>
          <line x1="12" y1="3" x2="12" y2="12"/>
        </svg>
      )
  }
}

// ── Settings Modal ─────────────────────────────────────────
function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState(settings)

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel notched w-full max-w-md panel-glow animate-fadeIn"
        style={{ fontFamily: 'var(--font-terminal)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-terminal">
          <span className="text-glow" style={{ fontSize: '1.3rem', letterSpacing: '0.1em' }}>
            ⚙ CONFIG.PANEL
          </span>
          <button
            onClick={onClose}
            className="text-dim hover:text-primary transition-colors text-2xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="section-label">ADAFRUIT.IO CREDENTIALS</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>
            Overrides .env.local values. Stored in browser localStorage.
          </p>

          {(['aio_username', 'aio_key', 'aio_feed'] as const).map((field) => (
            <div key={field}>
              <label className="section-label block mb-1">
                {field.replace('aio_', '').toUpperCase()}
              </label>
              <input
                type={field === 'aio_key' ? 'password' : 'text'}
                className="retro-input w-full px-3 py-2 text-sm"
                style={{ fontSize: '0.95rem' }}
                placeholder={
                  field === 'aio_username' ? 'your_username' :
                  field === 'aio_key'      ? 'your_api_key'  :
                  'neopixel-pattern'
                }
                value={local[field]}
                onChange={(e) => setLocal({ ...local, [field]: e.target.value })}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { onSave(local); onClose() }}
              className="flex-1 py-2 border border-terminal-bright text-primary hover:bg-card transition-colors text-glow-soft"
              style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}
            >
              [ SAVE ]
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-terminal text-dim hover:border-terminal-bright transition-colors"
              style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}
            >
              [ CANCEL ]
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pattern Button ─────────────────────────────────────────
function PatternButton({
  pattern,
  isActive,
  isPending,
  onClick,
}: {
  pattern: Pattern
  isActive: boolean
  isPending: boolean
  onClick: () => void
}) {
  const primaryColor = pattern.colors[0]
  const glowStyle = isActive
    ? {
        boxShadow: `0 0 14px ${primaryColor}55, 0 0 28px ${primaryColor}22, inset 0 0 10px ${primaryColor}11`,
        borderColor: primaryColor,
      }
    : undefined

  return (
    <button
      onClick={onClick}
      className={`pattern-btn pattern-btn-size notched p-0 flex flex-col items-center justify-between w-full ${
        isActive  ? 'is-active'  :
        isPending ? 'is-pending' : ''
      }`}
      style={glowStyle}
      title={`Activate ${pattern.label} pattern`}
    >
      {/* Top accent bar */}
      <div
        className="w-full h-1 opacity-70 transition-opacity"
        style={{
          background: isActive
            ? `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`
            : 'var(--border)',
        }}
      />

      <div className="flex flex-col items-center justify-center flex-1 gap-2 px-2 py-3">
        {/* Icon */}
        <div
          className="transition-all duration-150"
          style={{
            color: isActive ? primaryColor : 'var(--text-dim)',
            filter: isActive
              ? `drop-shadow(0 0 6px ${primaryColor}) drop-shadow(0 0 12px ${primaryColor}66)`
              : 'none',
          }}
        >
          <PatternIcon id={pattern.id} size={36} />
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {pattern.colors.map((c, i) => (
            <span
              key={i}
              className={`led ${isActive ? 'animate-led-pulse' : ''}`}
              style={{
                background: c,
                boxShadow: isActive ? `0 0 6px ${c}` : 'none',
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Label */}
        <div
          className="text-center leading-tight transition-colors"
          style={{
            fontFamily: 'var(--font-terminal)',
            fontSize: '1.25rem',
            letterSpacing: '0.08em',
            color: isActive ? primaryColor : 'var(--text-dim)',
            textShadow: isActive ? `0 0 8px ${primaryColor}` : 'none',
          }}
        >
          {pattern.label}
        </div>

        {/* Description — hidden on mobile, visible sm+ */}
        <div
          className="hidden sm:block"
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '0.58rem',
            letterSpacing: '0.12em',
            color: isActive ? 'var(--text-dim)' : 'var(--text-faint)',
          }}
        >
          {pattern.desc}
        </div>
      </div>

      {/* Bottom status indicator */}
      <div
        className="w-full h-5 flex items-center justify-center transition-all"
        style={{
          borderTop: `1px solid ${isActive ? primaryColor + '44' : 'var(--border)'}`,
          background: isActive ? `${primaryColor}0a` : 'transparent',
        }}
      >
        {isPending ? (
          <span
            className="animate-blink"
            style={{ fontSize: '0.6rem', fontFamily: 'var(--font-data)', color: 'var(--warning)', letterSpacing: '0.1em' }}
          >
            SENDING...
          </span>
        ) : isActive ? (
          <span
            style={{ fontSize: '0.6rem', fontFamily: 'var(--font-data)', color: primaryColor, letterSpacing: '0.1em' }}
          >
            ● ACTIVE
          </span>
        ) : (
          <span
            style={{ fontSize: '0.6rem', fontFamily: 'var(--font-data)', color: 'var(--text-faint)', letterSpacing: '0.1em' }}
          >
            ○ READY
          </span>
        )}
      </div>
    </button>
  )
}

// ── Theme Toggle ───────────────────────────────────────────
function ThemeToggle({ isAmber, onToggle }: { isAmber: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 group"
      title={isAmber ? 'Switch to green phosphor' : 'Switch to amber phosphor'}
    >
      <span
        className="hidden sm:inline"
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          color: 'var(--text-faint)',
        }}
      >
        {isAmber ? 'AMBER' : 'GREEN'}
      </span>
      <div
        className={`toggle-track w-12 h-6 rounded-sm flex items-center px-1 ${isAmber ? 'is-active' : ''}`}
      >
        <div
          className="toggle-thumb w-4 h-4 rounded-sm transition-transform"
          style={{ transform: isAmber ? 'translateX(22px)' : 'translateX(0)' }}
        />
      </div>
      <span style={{ fontSize: '1rem' }} aria-hidden>
        {isAmber ? '🟡' : '🟢'}
      </span>
    </button>
  )
}

// ── Boot Screen ────────────────────────────────────────────
function BootScreen({ lines, done }: { lines: string[]; done: boolean }) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center p-4 sm:p-8 transition-opacity duration-500"
      style={{
        background: 'var(--bg)',
        opacity: done ? 0 : 1,
        pointerEvents: done ? 'none' : 'all',
        fontFamily: 'var(--font-data)',
      }}
    >
      <div className="w-full max-w-lg">
        <div
          className="text-glow mb-6 text-center"
          style={{ fontFamily: 'var(--font-terminal)', fontSize: '2.2rem', letterSpacing: '0.12em' }}
        >
          CHROMACORE-90
        </div>
        <div
          className="mb-8 text-center section-label"
          style={{ letterSpacing: '0.2em' }}
        >
          NEOPIXEL CONTROL INTERFACE // ESP32-S2
        </div>

        <div
          className="panel p-4 space-y-2"
          style={{ borderColor: 'var(--border-bright)', minHeight: '200px' }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className="boot-line"
              style={{
                fontSize: '0.82rem',
                letterSpacing: '0.04em',
                color: i === lines.length - 1 ? 'var(--text)' : 'var(--text-dim)',
                animationDelay: `${i * 0.05}s`,
              }}
            >
              {line}
            </div>
          ))}
          {lines.length < 6 && (
            <span
              className="inline-block animate-blink"
              style={{ color: 'var(--accent)', fontSize: '0.9rem' }}
            >
              ▌
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function Home() {
  const [isAmber, setIsAmber] = useState(false)
  const [activePattern, setActivePattern] = useState<PatternId | null>(null)
  const [pendingPattern, setPendingPattern] = useState<PatternId | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('READY')
  const [lastCmd, setLastCmd] = useState('--:--:--')
  const [lastPattern, setLastPattern] = useState('NONE')
  const [showSettings, setShowSettings] = useState(false)
  const [showSchedules, setShowSchedules] = useState(false)
  const [bootLines, setBootLines] = useState<string[]>([])
  const [bootDone, setBootDone] = useState(false)
  const [settings, setSettings] = useState<Settings>({ aio_username: '', aio_key: '', aio_feed: '' })
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot sequence
  useEffect(() => {
    let idx = 0
    const advance = () => {
      if (idx < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[idx]])
        idx++
        setTimeout(advance, idx < BOOT_LINES.length ? 350 : 700)
      } else {
        setTimeout(() => setBootDone(true), 600)
      }
    }
    const t = setTimeout(advance, 200)
    return () => clearTimeout(t)
  }, [])

  // Load persisted state
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('chromacore_theme')
      if (savedTheme === 'amber') setIsAmber(true)

      const savedSettings = localStorage.getItem('chromacore_settings')
      if (savedSettings) setSettings(JSON.parse(savedSettings))

      const savedPattern = localStorage.getItem('chromacore_active') as PatternId | null
      if (savedPattern) {
        setActivePattern(savedPattern)
        setLastPattern(savedPattern.toUpperCase())
      }
    } catch {}
  }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isAmber ? 'light' : 'dark')
    try { localStorage.setItem('chromacore_theme', isAmber ? 'amber' : 'green') } catch {}
  }, [isAmber])

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s)
    try { localStorage.setItem('chromacore_settings', JSON.stringify(s)) } catch {}
  }, [])

  const sendPattern = useCallback(async (patternId: PatternId) => {
    if (pendingPattern) return

    setPendingPattern(patternId)
    setStatus('sending')
    setStatusMsg('TRANSMITTING...')
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)

    try {
      const body: Record<string, string> = { pattern: patternId }
      if (settings.aio_username) body.aio_username = settings.aio_username
      if (settings.aio_key)      body.aio_key      = settings.aio_key
      if (settings.aio_feed)     body.aio_feed     = settings.aio_feed

      const res = await fetch('/api/pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setActivePattern(patternId)
        setLastPattern(patternId.toUpperCase())
        setLastCmd(new Date().toLocaleTimeString('en-US', { hour12: false }))
        setStatus('success')
        setStatusMsg('CMD ACCEPTED')
        try { localStorage.setItem('chromacore_active', patternId) } catch {}
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setStatus('error')
        setStatusMsg(`ERR: ${(err.error as string)?.slice(0, 40) ?? 'FAILED'}`)
      }
    } catch (e) {
      setStatus('error')
      setStatusMsg('NETWORK ERROR')
    }

    setPendingPattern(null)
    statusTimerRef.current = setTimeout(() => {
      setStatus('idle')
      setStatusMsg('READY')
    }, 3000)
  }, [pendingPattern, settings])

  const activePatternDef = PATTERNS.find((p) => p.id === activePattern)

  return (
    <>
      <BootScreen lines={bootLines} done={bootDone} />

      <main
        className="min-h-screen flex flex-col items-center justify-center p-4 py-4 sm:py-8"
        style={{ opacity: bootDone ? 1 : 0, transition: 'opacity 0.5s ease 0.1s' }}
      >
        <div className="w-full max-w-2xl animate-scanIn">

          {/* ── Top Header Bar ──────────────────────────────── */}
          <div
            className="panel flex items-center justify-between px-4 py-2 mb-1"
            style={{ borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            {/* Status LED */}
            <div className="flex items-center gap-3">
              <span
                className="led led-green animate-led-pulse"
                style={{ boxShadow: '0 0 8px #00ff41, 0 0 16px #00ff4166' }}
              />
              <span
                className="text-glow"
                style={{ fontFamily: 'var(--font-terminal)', fontSize: '1.4rem', letterSpacing: '0.12em' }}
              >
                CHROMACORE-90
              </span>
              <span
                className="hidden sm:inline"
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}
              >
                // NEOPIXEL CTRL
              </span>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle isAmber={isAmber} onToggle={() => setIsAmber((a) => !a)} />
              <button
                onClick={() => setShowSchedules(true)}
                className="text-dim hover:text-primary transition-colors"
                title="Scheduled alerts"
                style={{ fontSize: '1.3rem', lineHeight: 1 }}
              >
                ⏱
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="text-dim hover:text-primary transition-colors"
                title="Open settings"
                style={{ fontSize: '1.3rem', lineHeight: 1 }}
              >
                ⚙
              </button>
            </div>
          </div>

          {/* ── Status Readout Panel ─────────────────────────── */}
          <div
            className="panel px-4 py-3 mb-1 grid grid-cols-2 sm:grid-cols-4 gap-3"
            style={{ border: '1px solid var(--border)', borderTop: '1px solid var(--border-bright)', borderBottom: 'none' }}
          >
            {/* Active Pattern Display */}
            <div className="col-span-2 sm:col-span-1">
              <div className="section-label mb-1">ACTIVE.PATTERN</div>
              <div
                style={{
                  fontFamily: 'var(--font-terminal)',
                  fontSize: '1.6rem',
                  color: activePatternDef ? activePatternDef.colors[0] : 'var(--text-faint)',
                  textShadow: activePatternDef ? `0 0 10px ${activePatternDef.colors[0]}` : 'none',
                  letterSpacing: '0.08em',
                }}
              >
                {lastPattern}
              </div>
            </div>

            {/* TX Status */}
            <div>
              <div className="section-label mb-1">TX.STATUS</div>
              <div
                className={`status-${status}`}
                style={{ fontFamily: 'var(--font-terminal)', fontSize: '1.1rem', letterSpacing: '0.06em' }}
              >
                {statusMsg}
              </div>
            </div>

            {/* Last Command */}
            <div>
              <div className="section-label mb-1">LAST.CMD</div>
              <div
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.95rem', color: 'var(--text-dim)', letterSpacing: '0.06em' }}
              >
                {lastCmd}
              </div>
            </div>

            {/* Hardware Info — hidden on mobile to avoid orphaned grid cell */}
            <div className="hidden sm:block">
              <div className="section-label mb-1">HARDWARE</div>
              <div
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: 'var(--text-faint)', letterSpacing: '0.04em', lineHeight: 1.5 }}
              >
                90px · GRB
                <br />
                I2C 0x60 P15
              </div>
            </div>
          </div>

          {/* ── Divider with label ──────────────────────────── */}
          <div
            className="panel flex items-center gap-3 px-4 py-1.5 mb-1"
            style={{ border: '1px solid var(--border)', borderTop: '1px solid var(--border-bright)', borderBottom: 'none' }}
          >
            <div className="section-label" style={{ whiteSpace: 'nowrap' }}>PATTERN.SELECT</div>
            <div className="flex-1 hr-terminal" />
            <div
              style={{ fontFamily: 'var(--font-data)', fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}
            >
              8 MODES AVAILABLE
            </div>
          </div>

          {/* ── Pattern Grid ─────────────────────────────────── */}
          <div
            className="panel p-3"
            style={{ border: '1px solid var(--border)', borderTop: '1px solid var(--border-bright)', borderBottom: 'none' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PATTERNS.map((pattern) => (
                <PatternButton
                  key={pattern.id}
                  pattern={pattern}
                  isActive={activePattern === pattern.id}
                  isPending={pendingPattern === pattern.id}
                  onClick={() => sendPattern(pattern.id)}
                />
              ))}
            </div>
          </div>

          {/* ── Footer Bar ───────────────────────────────────── */}
          <div
            className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-2"
            style={{ border: '1px solid var(--border)', borderTop: '1px solid var(--border-bright)' }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}
              >
                FEED: {settings.aio_feed || 'neopixel-pattern'}
              </div>
              <div
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}
              >
                POLL: 0.5s
              </div>
              <div
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}
              >
                BRIGHT: 1.0
              </div>
            </div>
            <div
              className="animate-flicker"
              style={{ fontFamily: 'var(--font-data)', fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}
            >
              ESP32-S2 QTPY · ADAFRUIT.IO
            </div>
          </div>

          {/* ── Corner Decoration ────────────────────────────── */}
          <div
            className="flex justify-between mt-1 px-1"
            style={{ fontFamily: 'var(--font-data)', fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}
          >
            <span>◤ CHROMACORE SYSTEMS INC.</span>
            <span>MODEL CC-90-NP ◥</span>
          </div>

        </div>
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSchedules && (
        <ScheduleModal onClose={() => setShowSchedules(false)} />
      )}
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'

interface Schedule {
  id: string
  label: string
  enabled: boolean
  time: string
  month: number | null
  day: number | null
  year: number | null
  repeatable: boolean
  pattern: 'alert'
  created_at: string
  last_fired_at: string | null
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function formatRecurrence(s: Schedule): string {
  const month = s.month !== null ? MONTHS[s.month - 1] : '*'
  const day   = s.day   !== null ? String(s.day).padStart(2, '0') : '*'
  const year  = s.year  !== null ? String(s.year) : '*'
  return `${month}/${day}/${year}`
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [draft, setDraft] = useState({
    label: '',
    time: '08:00',
    month: '',
    day: '',
    year: '',
    repeatable: true,
  })

  useEffect(() => {
    fetch('/api/schedules')
      .then(r => r.json())
      .then(data => { setSchedules(data.schedules ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load schedules'); setLoading(false) })
  }, [])

  async function persist(updated: Schedule[]) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: updated }),
      })
      if (res.ok) {
        setSchedules(updated)
      } else {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(body.error ?? 'Save failed')
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  function addSchedule() {
    const [h, m] = draft.time.split(':').map(Number)
    if (isNaN(h) || isNaN(m) || m % 5 !== 0) {
      setError('Time must be a 5-minute increment (e.g. 08:00, 08:15, 09:30)')
      return
    }
    const newSchedule: Schedule = {
      id: genId(),
      label: draft.label.trim() || `Alert ${draft.time} EST`,
      enabled: true,
      time: draft.time,
      month: draft.month ? parseInt(draft.month) : null,
      day:   draft.day   ? parseInt(draft.day)   : null,
      year:  draft.year  ? parseInt(draft.year)  : null,
      repeatable: draft.repeatable,
      pattern: 'alert',
      created_at: new Date().toISOString(),
      last_fired_at: null,
    }
    persist([...schedules, newSchedule]).then(() => {
      setShowForm(false)
      setDraft({ label: '', time: '08:00', month: '', day: '', year: '', repeatable: true })
    })
  }

  function toggleEnabled(id: string) {
    persist(schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function deleteSchedule(id: string) {
    persist(schedules.filter(s => s.id !== id))
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel notched w-full max-w-md panel-glow animate-fadeIn"
        style={{ fontFamily: 'var(--font-terminal)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-terminal">
          <span className="text-glow" style={{ fontSize: '1.3rem', letterSpacing: '0.1em' }}>
            ⏱ SCHED.ALERT
          </span>
          <button
            onClick={onClose}
            className="text-dim hover:text-primary transition-colors text-2xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <p className="section-label">SCHEDULED ALERTS // TIMEZONE: EST</p>

          {error && (
            <p style={{ fontSize: '0.8rem', color: 'var(--error)', fontFamily: 'var(--font-data)' }}>
              ERR: {error}
            </p>
          )}

          {loading ? (
            <p className="animate-blink" style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>
              LOADING...
            </p>
          ) : schedules.length === 0 && !showForm ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', fontFamily: 'var(--font-data)' }}>
              NO SCHEDULES CONFIGURED.
            </p>
          ) : (
            <div className="space-y-2">
              {schedules.map(s => (
                <div
                  key={s.id}
                  className="panel p-3 flex items-center gap-3"
                  style={{ borderColor: s.enabled ? 'var(--border-bright)' : 'var(--border)' }}
                >
                  <button
                    onClick={() => toggleEnabled(s.id)}
                    disabled={saving}
                    title={s.enabled ? 'Disable' : 'Enable'}
                    className="flex-shrink-0"
                  >
                    <div className={`toggle-track w-10 h-5 rounded-sm flex items-center px-0.5 ${s.enabled ? 'is-active' : ''}`}>
                      <div
                        className="toggle-thumb w-3.5 h-3.5 rounded-sm"
                        style={{ transform: s.enabled ? 'translateX(18px)' : 'translateX(0)' }}
                      />
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div style={{
                      fontSize: '1.1rem',
                      color: s.enabled ? 'var(--text)' : 'var(--text-faint)',
                      letterSpacing: '0.06em',
                    }}>
                      {s.time} EST
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '0.65rem',
                      color: 'var(--text-faint)',
                      letterSpacing: '0.08em',
                    }}>
                      {s.label} · {formatRecurrence(s)} · {s.repeatable ? 'RPT' : 'ONCE'}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteSchedule(s.id)}
                    disabled={saving}
                    className="text-dim hover:text-primary transition-colors flex-shrink-0 text-lg leading-none"
                    title="Delete schedule"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <div className="panel p-4 space-y-3" style={{ borderColor: 'var(--border-bright)' }}>
              <p className="section-label">NEW SCHEDULE</p>

              <div>
                <label className="section-label block mb-1">LABEL</label>
                <input
                  type="text"
                  className="retro-input w-full px-3 py-1.5 text-sm"
                  placeholder="Morning Alert"
                  value={draft.label}
                  onChange={e => setDraft({ ...draft, label: e.target.value })}
                />
              </div>

              <div>
                <label className="section-label block mb-1">TIME (24H, EST)</label>
                <input
                  type="time"
                  className="retro-input w-full px-3 py-1.5 text-sm"
                  step={300}
                  value={draft.time}
                  onChange={e => setDraft({ ...draft, time: e.target.value.slice(0, 5) })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="section-label block mb-1">MONTH</label>
                  <input
                    type="number"
                    className="retro-input w-full px-2 py-1.5 text-sm"
                    placeholder="ANY"
                    min={1}
                    max={12}
                    value={draft.month}
                    onChange={e => setDraft({ ...draft, month: e.target.value })}
                  />
                </div>
                <div>
                  <label className="section-label block mb-1">DAY</label>
                  <input
                    type="number"
                    className="retro-input w-full px-2 py-1.5 text-sm"
                    placeholder="ANY"
                    min={1}
                    max={31}
                    value={draft.day}
                    onChange={e => setDraft({ ...draft, day: e.target.value })}
                  />
                </div>
                <div>
                  <label className="section-label block mb-1">YEAR</label>
                  <input
                    type="number"
                    className="retro-input w-full px-2 py-1.5 text-sm"
                    placeholder="ANY"
                    min={2024}
                    value={draft.year}
                    onChange={e => setDraft({ ...draft, year: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, repeatable: !draft.repeatable })}
                  className="flex-shrink-0"
                >
                  <div className={`toggle-track w-10 h-5 rounded-sm flex items-center px-0.5 ${draft.repeatable ? 'is-active' : ''}`}>
                    <div
                      className="toggle-thumb w-3.5 h-3.5 rounded-sm"
                      style={{ transform: draft.repeatable ? 'translateX(18px)' : 'translateX(0)' }}
                    />
                  </div>
                </button>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                  {draft.repeatable ? 'REPEATABLE' : 'ONE-TIME'}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={addSchedule}
                  disabled={saving}
                  className="flex-1 py-1.5 border border-terminal-bright text-primary hover:bg-card transition-colors text-glow-soft"
                  style={{ fontSize: '1rem', letterSpacing: '0.1em' }}
                >
                  {saving ? '[ SAVING... ]' : '[ ADD ]'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setError(null) }}
                  className="flex-1 py-1.5 border border-terminal text-dim hover:border-terminal-bright transition-colors"
                  style={{ fontSize: '1rem', letterSpacing: '0.1em' }}
                >
                  [ CANCEL ]
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 border border-terminal text-dim hover:border-terminal-bright hover:text-primary transition-colors"
              style={{ fontSize: '1rem', letterSpacing: '0.1em' }}
            >
              [ + ADD SCHEDULE ]
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

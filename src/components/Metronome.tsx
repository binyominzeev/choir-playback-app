import { useEffect, useRef, useState } from 'react'

interface MetronomeProps {
  bpm: number
  sampleUrl?: string | null
  beatsPerBar?: number
}

export function Metronome({ bpm, sampleUrl = null, beatsPerBar = 4 }: MetronomeProps) {
  const [enabled, setEnabled] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const beatIndexRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
      if (ctxRef.current) {
        try {
          ctxRef.current.close()
        } catch {}
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const start = async () => {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = ctxRef.current

      // load sample if provided
      if (sampleUrl && !bufferRef.current) {
        try {
          const res = await fetch(sampleUrl)
          const ab = await res.arrayBuffer()
          bufferRef.current = await ctx.decodeAudioData(ab)
        } catch (e) {
          console.warn('Metronome sample load failed, falling back to synthetic click', e)
          bufferRef.current = null
        }
      }

      const scheduleNext = () => {
        const intervalMs = 60000 / Math.max(1, bpm)

        const isDownbeat = (beatIndexRef.current % beatsPerBar) === 0

        if (bufferRef.current) {
          const src = ctx.createBufferSource()
          src.buffer = bufferRef.current
          const g = ctx.createGain()
          g.gain.value = isDownbeat ? 1.0 : 0.6
          src.connect(g)
          g.connect(ctx.destination)
          src.start()
        } else {
          // synthetic click: shorter, different amplitude for downbeat
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'square'
          o.frequency.value = isDownbeat ? 1000 : 800
          g.gain.value = isDownbeat ? 0.2 : 0.12
          o.connect(g)
          g.connect(ctx.destination)
          o.start()
          o.stop(ctx.currentTime + 0.05)
        }

        beatIndexRef.current = (beatIndexRef.current + 1) % beatsPerBar
        timerRef.current = window.setTimeout(scheduleNext, intervalMs)
      }

      // align to audio context time slightly ahead
      beatIndexRef.current = 0
      scheduleNext()
    }

    void start()

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, bpm, sampleUrl, beatsPerBar])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Metronóm</h2>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-slate-700">Bekapcsolás</span>
        </label>
        <div className="text-sm text-slate-500">{Math.round(bpm)} BPM</div>
      </div>
    </section>
  )
}

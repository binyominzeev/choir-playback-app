interface PlaybackControlsProps {
  status: 'idle' | 'loading' | 'playing' | 'paused'
  currentTime: string
  totalTime: string
  progress: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (progress: number) => void
}

export function PlaybackControls({
  status,
  currentTime,
  totalTime,
  progress,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: PlaybackControlsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Playback</h2>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={onPlay}
          disabled={status === 'loading'}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Play
        </button>
        <button
          type="button"
          onClick={onPause}
          disabled={status === 'loading'}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={status === 'loading'}
          className="rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Stop
        </button>
      </div>

      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="seek-range">
        Seek
      </label>
      <input
        id="seek-range"
        type="range"
        value={progress}
        min={0}
        max={1000}
        step={1}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="w-full"
      />

      <div className="mt-2 flex justify-between text-sm text-slate-600">
        <span>{currentTime}</span>
        <span>{totalTime}</span>
      </div>
    </section>
  )
}

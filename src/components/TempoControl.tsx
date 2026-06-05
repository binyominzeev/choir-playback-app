interface TempoControlProps {
  value: number
  onChange: (value: number) => void
}

export function TempoControl({ value, onChange }: TempoControlProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Tempo</h2>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="tempo-range">
        {value}% of original BPM
      </label>
      <input
        id="tempo-range"
        type="range"
        min={50}
        max={150}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </section>
  )
}

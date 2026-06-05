import type { InstrumentPresetId } from '../services/midiPlaybackEngine'

interface InstrumentOption {
  id: InstrumentPresetId
  name: string
}

interface InstrumentSelectorProps {
  instruments: readonly InstrumentOption[]
  selectedInstrument: InstrumentPresetId
  onSelectInstrument: (instrumentId: InstrumentPresetId) => void
}

export function InstrumentSelector({
  instruments,
  selectedInstrument,
  onSelectInstrument,
}: InstrumentSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Instrument</h2>
      <div className="flex flex-wrap gap-2">
        {instruments.map((instrument) => (
          <button
            key={instrument.id}
            type="button"
            onClick={() => onSelectInstrument(instrument.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              selectedInstrument === instrument.id
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 text-slate-700 hover:border-indigo-300'
            }`}
          >
            {instrument.name}
          </button>
        ))}
      </div>
    </section>
  )
}
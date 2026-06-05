import type { VoicePart } from '../types/midi'

interface VoiceSelectorProps {
  voices: VoicePart[]
  selectedVoice: string | null
  onSelectVoice: (voiceId: string | null) => void
}

export function VoiceSelector({ voices, selectedVoice, onSelectVoice }: VoiceSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Voice Focus</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectVoice(null)}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            selectedVoice === null
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 text-slate-700 hover:border-indigo-300'
          }`}
        >
          All voices
        </button>
        {voices.map((voice) => (
          <button
            key={voice.id}
            type="button"
            onClick={() => onSelectVoice(voice.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              selectedVoice === voice.id
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 text-slate-700 hover:border-indigo-300'
            }`}
          >
            {voice.name}
          </button>
        ))}
      </div>
    </section>
  )
}

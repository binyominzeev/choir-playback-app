import { Midi } from '@tonejs/midi'
import type { MidiSongData, VoicePart } from '../types/midi'

export interface LoadedMidi {
  midi: Midi
  songData: MidiSongData
}

function buildVoiceName(trackName: string | undefined, index: number): string {
  const normalized = trackName?.trim()
  return normalized && normalized.length > 0 ? normalized : `Voice ${index + 1}`
}

export async function loadMidiFromUrl(url: string): Promise<LoadedMidi> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to load MIDI file')
  }

  const bytes = await response.arrayBuffer()
  const midi = new Midi(bytes)

  const voices: VoicePart[] = midi.tracks
    .map((track, index) => ({
      id: `voice-${index}`,
      name: buildVoiceName(track.name, index),
      noteCount: track.notes.length,
    }))
    .filter((voice) => voice.noteCount > 0)

  const totalTicks = midi.tracks.reduce((maxTicks, track) => {
    const trackEnd = track.notes.reduce((max, note) => {
      return Math.max(max, note.ticks + note.durationTicks)
    }, 0)
    return Math.max(maxTicks, trackEnd)
  }, 0)

  return {
    midi,
    songData: {
      voices,
      durationSeconds: midi.duration,
      totalTicks,
      originalBpm: midi.header.tempos[0]?.bpm ?? 120,
    },
  }
}

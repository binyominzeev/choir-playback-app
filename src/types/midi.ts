export interface VoicePart {
  id: string
  name: string
  noteCount: number
}

export interface MidiSongData {
  voices: VoicePart[]
  durationSeconds: number
  totalTicks: number
  originalBpm: number
}

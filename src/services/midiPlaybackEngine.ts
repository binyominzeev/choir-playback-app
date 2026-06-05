import { Mallet, SampleLoader, SplendidGrandPiano, Versilian } from 'smplr'
import * as Tone from 'tone'
import type { Midi } from '@tonejs/midi'
import type { MidiSongData } from '../types/midi'

const FOCUS_VOLUME = 0.7
const BACKGROUND_VOLUME = 0.12
const MAX_ALL_VOICES_VOLUME = 0.42
const MASTER_OUTPUT_GAIN = 0.82
const DEFAULT_FOCUS_BLEND_PERCENT = 100

type SampledInstrument = ReturnType<typeof SplendidGrandPiano> | ReturnType<typeof Mallet> | ReturnType<typeof Versilian>
type SharedSampleLoader = ReturnType<typeof SampleLoader>

type TrackPlayback = {
  gain: GainNode
  instrument: SampledInstrument
  sourceTrackIndex: number
  trackId: string
}

export const INSTRUMENT_PRESETS = [
  { id: 'simple-piano', name: 'Simple Piano' },
  { id: 'vibraphone', name: 'Vibraphone' },
  { id: 'xylophone', name: 'Xylophone' },
  { id: 'violin', name: 'Violin' },
] as const

export type InstrumentPresetId = (typeof INSTRUMENT_PRESETS)[number]['id']

export const DEFAULT_INSTRUMENT_PRESET_ID: InstrumentPresetId = 'simple-piano'
export const DEFAULT_FOCUS_BLEND = DEFAULT_FOCUS_BLEND_PERCENT

const SAMPLED_INSTRUMENT_VOLUMES: Record<InstrumentPresetId, number> = {
  'simple-piano': 72,
  vibraphone: 88,
  xylophone: 92,
  violin: 84,
}

function createSampledInstrumentForPreset(
  presetId: InstrumentPresetId,
  audioContext: BaseAudioContext,
  loader: SharedSampleLoader,
  destination: AudioNode,
  notesToLoad: number[],
): SampledInstrument {
  const volume = SAMPLED_INSTRUMENT_VOLUMES[presetId]

  switch (presetId) {
    case 'vibraphone':
      return Mallet(audioContext, {
        destination,
        loader,
        volume,
        instrument: 'Vibraphone - Soft Mallets',
      })
    case 'xylophone':
      return Mallet(audioContext, {
        destination,
        loader,
        volume,
        instrument: 'Xylophone - Medium Mallets',
      })
    case 'violin':
      return Versilian(audioContext, {
        destination,
        loader,
        volume,
        instrument: 'Strings/Violin/Violin - Arco',
      })
    case 'simple-piano':
    default:
      return SplendidGrandPiano(audioContext, {
        destination,
        loader,
        volume,
        decayTime: 0.85,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 127],
        },
      })
  }
}

export class MidiPlaybackEngine {
  private trackPlaybacks: TrackPlayback[] = []
  private scheduledIds: number[] = []
  private isReady = false
  private currentData: MidiSongData | null = null
  private instrumentPresetId: InstrumentPresetId = DEFAULT_INSTRUMENT_PRESET_ID
  private focusBlendPercent = DEFAULT_FOCUS_BLEND_PERCENT
  private sampleLoader: SharedSampleLoader | null = null
  private sampleLoaderContext: BaseAudioContext | null = null
  private audioContext: BaseAudioContext
  private masterGain: GainNode
  private compressor: DynamicsCompressorNode

  constructor() {
    this.audioContext = Tone.getContext().rawContext
    this.masterGain = this.audioContext.createGain()
    this.masterGain.gain.value = MASTER_OUTPUT_GAIN
    this.compressor = this.audioContext.createDynamicsCompressor()
    this.compressor.threshold.value = -8
    this.compressor.knee.value = 8
    this.compressor.ratio.value = 12
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.2
    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.audioContext.destination)
  }

  async initializeFromMidi(midi: Midi, songData: MidiSongData): Promise<void> {
    this.disposeTracks()
    this.isReady = false

    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    Tone.Transport.position = 0
    Tone.Transport.PPQ = midi.header.ppq

    this.currentData = songData
    this.scheduledIds = []
    this.audioContext = Tone.getContext().rawContext
    this.trackPlaybacks = await this.createSampledInstrumentTracks(midi)

    this.trackPlaybacks.forEach((trackPlayback) => {
      const track = midi.tracks[trackPlayback.sourceTrackIndex]
      if (!track || track.notes.length === 0) {
        return
      }

      track.notes.forEach((note) => {
        const eventId = Tone.Transport.schedule((time) => {
          trackPlayback.instrument.start({
            note: note.midi,
            time,
            duration: Tone.Ticks(note.durationTicks).toSeconds(),
            velocity: Math.round(note.velocity * 127),
          })
        }, `${note.ticks}i`)
        this.scheduledIds.push(eventId)
      })
    })

    this.setTempoPercent(100)
    this.setFocusVoice(null)
    this.isReady = true
  }

  setInstrumentPreset(presetId: InstrumentPresetId): void {
    this.instrumentPresetId = presetId
  }

  setTempoPercent(percent: number): void {
    if (!this.currentData) {
      return
    }

    const clamped = Math.min(150, Math.max(50, percent))
    const nextBpm = (this.currentData.originalBpm * clamped) / 100
    Tone.Transport.bpm.rampTo(nextBpm, 0.05)
  }

  setFocusBlendPercent(percent: number): void {
    this.focusBlendPercent = Math.max(0, Math.min(100, percent))
  }

  setFocusVoice(focusVoiceId: string | null): void {
    if (!this.isReady) {
      return
    }

    const allVoicesVolume = Math.min(
      MAX_ALL_VOICES_VOLUME,
      1 / Math.max(1, Math.sqrt(this.trackPlaybacks.length || 1)),
    )
    const now = this.audioContext.currentTime

    this.trackPlaybacks.forEach((trackPlayback) => {
      let volume = allVoicesVolume
      if (focusVoiceId) {
        const backgroundVolume = BACKGROUND_VOLUME * (this.focusBlendPercent / 100)
        volume = trackPlayback.trackId === focusVoiceId ? FOCUS_VOLUME : backgroundVolume
      }

      trackPlayback.gain.gain.cancelScheduledValues(now)
      trackPlayback.gain.gain.setValueAtTime(trackPlayback.gain.gain.value, now)
      trackPlayback.gain.gain.linearRampToValueAtTime(volume, now + 0.15)
    })
  }

  async play(): Promise<void> {
    if (!this.isReady || Tone.Transport.state === 'started') {
      return
    }

    await Tone.start()
    Tone.Transport.start()
  }

  pause(): void {
    if (!this.isReady || Tone.Transport.state !== 'started') {
      return
    }
    Tone.Transport.pause()
    this.stopActiveTrackAudio()
  }

  stop(): void {
    if (!this.isReady) {
      return
    }
    Tone.Transport.stop()
    Tone.Transport.position = 0
    this.stopActiveTrackAudio()
  }

  seekByTicks(ticks: number): void {
    if (!this.currentData) {
      return
    }

    const safeTicks = Math.max(0, Math.min(this.currentData.totalTicks, ticks))
    this.stopActiveTrackAudio()
    Tone.Transport.ticks = safeTicks
  }

  getCurrentTicks(): number {
    return Tone.Transport.ticks
  }

  getPlaybackState(): Tone.PlaybackState {
    return Tone.Transport.state
  }

  getCurrentTimeSeconds(tempoPercent: number): number {
    if (!this.currentData || this.currentData.totalTicks <= 0) {
      return 0
    }

    const progress = Math.max(0, Math.min(1, Tone.Transport.ticks / this.currentData.totalTicks))
    const speed = Math.max(0.5, Math.min(1.5, tempoPercent / 100))
    return (this.currentData.durationSeconds * progress) / speed
  }

  getTotalDurationSeconds(tempoPercent: number): number {
    if (!this.currentData) {
      return 0
    }

    const speed = Math.max(0.5, Math.min(1.5, tempoPercent / 100))
    return this.currentData.durationSeconds / speed
  }

  dispose(): void {
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    this.disposeTracks()
    this.currentData = null
    this.isReady = false
  }

  private disposeTracks(): void {
    this.trackPlaybacks.forEach((trackPlayback) => {
      trackPlayback.instrument.dispose()
      trackPlayback.gain.disconnect()
    })
    this.trackPlaybacks = []
    this.scheduledIds = []
  }

  private async createSampledInstrumentTracks(midi: Midi): Promise<TrackPlayback[]> {
    const notesToLoad = Array.from(
      new Set(
        midi.tracks.flatMap((track) => track.notes.map((note) => note.midi)),
      ),
    ).sort((left, right) => left - right)

    const sampleLoader = this.getOrCreateSampleLoader(this.audioContext)
    const trackPlaybacks: TrackPlayback[] = []

    for (const [index, track] of midi.tracks.entries()) {
      if (track.notes.length === 0) {
        continue
      }

      const gain = this.audioContext.createGain()
      gain.gain.value = 1
      gain.connect(this.masterGain)

      const instrument = createSampledInstrumentForPreset(
        this.instrumentPresetId,
        this.audioContext,
        sampleLoader,
        gain,
        notesToLoad,
      )

      await instrument.ready

      trackPlaybacks.push({
        instrument,
        gain,
        sourceTrackIndex: index,
        trackId: `voice-${index}`,
      })
    }

    return trackPlaybacks
  }

  private getOrCreateSampleLoader(audioContext: BaseAudioContext): SharedSampleLoader {
    if (!this.sampleLoader || this.sampleLoaderContext !== audioContext) {
      this.sampleLoader = SampleLoader(audioContext)
      this.sampleLoaderContext = audioContext
    }

    return this.sampleLoader
  }

  private stopActiveTrackAudio(): void {
    this.trackPlaybacks.forEach((trackPlayback) => {
      trackPlayback.instrument.stop()
    })
  }
}

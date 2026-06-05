import * as Tone from 'tone'
import type { Midi } from '@tonejs/midi'
import type { MidiSongData } from '../types/midi'

const FOCUS_VOLUME = 1
const BACKGROUND_VOLUME = 0.2
const ALL_VOICES_VOLUME = 1

export class MidiPlaybackEngine {
  private synths: Tone.PolySynth[] = []
  private gains: Tone.Gain[] = []
  private trackIds: string[] = []
  private scheduledIds: number[] = []
  private isReady = false
  private currentData: MidiSongData | null = null

  async initializeFromMidi(midi: Midi, songData: MidiSongData): Promise<void> {
    this.disposeTracks()

    await Tone.start()
    Tone.Transport.stop()
    Tone.Transport.cancel(0)
    Tone.Transport.position = 0
    Tone.Transport.PPQ = midi.header.ppq

    this.currentData = songData
    this.scheduledIds = []

    midi.tracks.forEach((track, index) => {
      if (track.notes.length === 0) {
        return
      }

      const gain = new Tone.Gain(1).toDestination()
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.6,
          release: 0.8,
        },
        oscillator: {
          type: 'triangle',
        },
      }).connect(gain)

      track.notes.forEach((note) => {
        const eventId = Tone.Transport.schedule((time) => {
          synth.triggerAttackRelease(note.name, `${note.durationTicks}i`, time, note.velocity)
        }, `${note.ticks}i`)
        this.scheduledIds.push(eventId)
      })

      this.gains.push(gain)
      this.synths.push(synth)
      this.trackIds.push(`voice-${index}`)
    })

    this.setTempoPercent(100)
    this.setFocusVoice(null)
    this.isReady = true
  }

  setTempoPercent(percent: number): void {
    if (!this.currentData) {
      return
    }

    const clamped = Math.min(150, Math.max(50, percent))
    const nextBpm = (this.currentData.originalBpm * clamped) / 100
    Tone.Transport.bpm.rampTo(nextBpm, 0.05)
  }

  setFocusVoice(focusVoiceId: string | null): void {
    if (!this.isReady) {
      return
    }

    this.gains.forEach((gain, index) => {
      let volume = ALL_VOICES_VOLUME
      if (focusVoiceId) {
        volume = this.trackIds[index] === focusVoiceId ? FOCUS_VOLUME : BACKGROUND_VOLUME
      }

      gain.gain.rampTo(volume, 0.15)
    })
  }

  play(): void {
    if (!this.isReady || Tone.Transport.state === 'started') {
      return
    }
    Tone.Transport.start()
  }

  pause(): void {
    if (!this.isReady || Tone.Transport.state !== 'started') {
      return
    }
    Tone.Transport.pause()
  }

  stop(): void {
    if (!this.isReady) {
      return
    }
    Tone.Transport.stop()
    Tone.Transport.position = 0
  }

  seekByTicks(ticks: number): void {
    if (!this.currentData) {
      return
    }

    const safeTicks = Math.max(0, Math.min(this.currentData.totalTicks, ticks))
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
    this.synths.forEach((synth) => synth.dispose())
    this.gains.forEach((gain) => gain.dispose())
    this.synths = []
    this.gains = []
    this.trackIds = []
    this.scheduledIds = []
  }
}

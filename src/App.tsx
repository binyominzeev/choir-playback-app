import { useEffect, useMemo, useRef, useState } from 'react'
import { PlaybackControls } from './components/PlaybackControls'
import { Metronome } from './components/Metronome'
import { SongLibrary } from './components/SongLibrary'
import { TempoControl } from './components/TempoControl'
import { VoiceSelector } from './components/VoiceSelector'
import { loadMidiFromUrl } from './services/midiLoader'
import {
  DEFAULT_FOCUS_BLEND,
  DEFAULT_INSTRUMENT_PRESET_ID,
  INSTRUMENT_PRESETS,
  MidiPlaybackEngine,
} from './services/midiPlaybackEngine'
import { fetchSongLibrary } from './services/songLibrary'
import type { Midi } from '@tonejs/midi'
import type { InstrumentPresetId } from './services/midiPlaybackEngine'
import type { MidiSongData } from './types/midi'
import type { Song } from './types/song'

const STORAGE_KEYS = {
  songId: 'choir:lastSongId',
  voiceId: 'choir:lastVoiceId',
  instrumentId: 'choir:lastInstrumentId',
  focusBlend: 'choir:focusBlend',
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

function getStoredInstrumentId(): InstrumentPresetId {
  const storedInstrumentId = localStorage.getItem(STORAGE_KEYS.instrumentId)
  const matchingPreset = INSTRUMENT_PRESETS.find((preset) => preset.id === storedInstrumentId)
  return matchingPreset?.id ?? DEFAULT_INSTRUMENT_PRESET_ID
}

function getInstrumentName(instrumentId: InstrumentPresetId): string {
  return INSTRUMENT_PRESETS.find((preset) => preset.id === instrumentId)?.name ?? 'Selected instrument'
}

function getStoredFocusBlend(): number {
  const storedValue = Number(localStorage.getItem(STORAGE_KEYS.focusBlend))
  if (!Number.isFinite(storedValue)) {
    return DEFAULT_FOCUS_BLEND
  }

  return Math.min(100, Math.max(0, Math.round(storedValue)))
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function App() {
  const playbackEngineRef = useRef<MidiPlaybackEngine>(new MidiPlaybackEngine())
  const loadedMidiRef = useRef<Midi | null>(null)

  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEYS.songId),
  )
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEYS.voiceId),
  )
  const [selectedInstrumentId] = useState<InstrumentPresetId>(getStoredInstrumentId)
  const [focusBlendPercent, setFocusBlendPercent] = useState(getStoredFocusBlend)
  const [songData, setSongData] = useState<MidiSongData | null>(null)
  const [tempoPercent, setTempoPercent] = useState(100)
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('00:00')
  const [totalTime, setTotalTime] = useState('00:00')
  const [libraryStatus, setLibraryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Select a song to start practicing.')

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) ?? null,
    [selectedSongId, songs],
  )

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return songs
    }

    return songs.filter((song) => {
      const haystack = `${song.title} ${song.composer ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [search, songs])

  useEffect(() => {
    void (async () => {
      try {
        const library = await fetchSongLibrary()
        setSongs(library)
        setLibraryStatus('ready')
        if (!selectedSongId && library.length > 0) {
          setSelectedSongId(library[0].id)
        }
      } catch {
        setLibraryStatus('error')
        setMessage('Unable to load song library from the server.')
      }
    })()
  }, [selectedSongId])

  useEffect(() => {
    if (!selectedSongId) {
      return
    }
    localStorage.setItem(STORAGE_KEYS.songId, selectedSongId)
  }, [selectedSongId])

  useEffect(() => {
    if (!selectedVoiceId) {
      localStorage.removeItem(STORAGE_KEYS.voiceId)
      return
    }
    localStorage.setItem(STORAGE_KEYS.voiceId, selectedVoiceId)
  }, [selectedVoiceId])

  // instrument remains the default piano; no UI to change it anymore

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.focusBlend, String(focusBlendPercent))
  }, [focusBlendPercent])

  useEffect(() => {
    if (!selectedSong) {
      return
    }

    const engine = playbackEngineRef.current

    void (async () => {
      try {
        setPlaybackStatus('loading')
        setMessage(`Loading ${selectedSong.title}...`)

        const loaded = await loadMidiFromUrl(selectedSong.midiUrl)
        loadedMidiRef.current = loaded.midi

        const storedVoiceId = localStorage.getItem(STORAGE_KEYS.voiceId)
        const hasStoredVoice = loaded.songData.voices.some((voice) => voice.id === storedVoiceId)
        const nextVoice = hasStoredVoice ? storedVoiceId : null

        setSongData(loaded.songData)
        setSelectedVoiceId(nextVoice)

        const total = loaded.songData.durationSeconds
        setProgress(0)
        setCurrentTime(formatTime(0))
        setTotalTime(formatTime(total))

        try {
          engine.setInstrumentPreset(selectedInstrumentId)
          engine.setFocusBlendPercent(focusBlendPercent)
          await engine.initializeFromMidi(loaded.midi, loaded.songData)
          engine.setTempoPercent(tempoPercent)
          engine.setFocusVoice(nextVoice)
          setMessage(`Loaded ${selectedSong.title}`)
        } catch (error) {
          console.error('Audio engine initialization failed', error)
          setMessage(`Loaded ${selectedSong.title}, but audio could not be initialized yet.`)
        }

        setPlaybackStatus('idle')
      } catch (error) {
        console.error('MIDI loading failed', error)
        loadedMidiRef.current = null
        engine.dispose()
        setSongData(null)
        setSelectedVoiceId(null)
        setPlaybackStatus('idle')
        setMessage('Could not load that MIDI file. Please try another song.')
      }
    })()
  }, [selectedSong])

  useEffect(() => {
    const engine = playbackEngineRef.current
    engine.setTempoPercent(tempoPercent)
    const total = engine.getTotalDurationSeconds(tempoPercent)
    setTotalTime(formatTime(total))
  }, [tempoPercent])

  useEffect(() => {
    const engine = playbackEngineRef.current
    engine.setFocusVoice(selectedVoiceId)
  }, [selectedVoiceId])

  useEffect(() => {
    const engine = playbackEngineRef.current
    engine.setFocusBlendPercent(focusBlendPercent)
    engine.setFocusVoice(selectedVoiceId)
  }, [focusBlendPercent, selectedVoiceId])

  useEffect(() => {
    if (!songData || !loadedMidiRef.current) {
      return
    }

    const engine = playbackEngineRef.current
    const loadedMidi = loadedMidiRef.current

    void (async () => {
      try {
        // ensure engine uses default instrument and current settings
        engine.setInstrumentPreset(selectedInstrumentId)
        engine.setFocusBlendPercent(focusBlendPercent)
        await engine.initializeFromMidi(loadedMidi, songData)
        engine.setTempoPercent(tempoPercent)
        engine.setFocusVoice(selectedVoiceId)
        setPlaybackStatus('idle')
        setProgress(0)
        setCurrentTime(formatTime(0))
        setTotalTime(formatTime(engine.getTotalDurationSeconds(tempoPercent)))
      } catch (error) {
        console.error('Instrument init failed', error)
        setMessage('Audio initialization failed for the selected song.')
      }
    })()
  }, [selectedInstrumentId])

  useEffect(() => {
    let frameId = 0

    const tick = () => {
      const engine = playbackEngineRef.current
      if (songData && songData.totalTicks > 0) {
        const ticks = engine.getCurrentTicks()
        const nextProgress = Math.round((Math.max(0, Math.min(songData.totalTicks, ticks)) / songData.totalTicks) * 1000)
        setProgress(nextProgress)
        setCurrentTime(formatTime(engine.getCurrentTimeSeconds(tempoPercent)))

        if (engine.getPlaybackState() === 'started') {
          setPlaybackStatus('playing')
          if (ticks >= songData.totalTicks) {
            engine.stop()
            setPlaybackStatus('idle')
          }
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [songData, tempoPercent])

  useEffect(() => {
    const engine = playbackEngineRef.current
    return () => {
      engine.dispose()
    }
  }, [])

  const handlePlay = () => {
    void (async () => {
      try {
        await playbackEngineRef.current.play()
        setPlaybackStatus('playing')
        setMessage('Playback started')
      } catch (error) {
        console.error('Playback start failed', error)
        setPlaybackStatus('idle')
        setMessage('Audio playback could not start. Try pressing Play again.')
      }
    })()
  }

  const handlePause = () => {
    playbackEngineRef.current.pause()
    setPlaybackStatus('paused')
    setMessage('Playback paused')
  }

  const handleStop = () => {
    playbackEngineRef.current.stop()
    setPlaybackStatus('idle')
    setProgress(0)
    setCurrentTime('00:00')
    setMessage('Playback stopped')
  }

  const handleSeek = (nextProgress: number) => {
    if (!songData) {
      return
    }

    const nextTicks = Math.round((nextProgress / 1000) * songData.totalTicks)
    playbackEngineRef.current.seekByTicks(nextTicks)
    setProgress(nextProgress)
    setCurrentTime(formatTime(playbackEngineRef.current.getCurrentTimeSeconds(tempoPercent)))
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-slate-50 p-4 pb-8 md:p-6">
      <header className="mb-6 rounded-xl bg-indigo-600 p-4 text-white md:p-6">
        <h1 className="text-2xl font-bold md:text-3xl">Choir Playback Practice</h1>
        <p className="mt-1 text-sm text-indigo-100 md:text-base">
          Practice SATB and multi-part arrangements with adjustable focus and tempo.
        </p>
      </header>

      <p className="mb-4 rounded-md border border-indigo-100 bg-white p-3 text-sm text-slate-700">{message}</p>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <SongLibrary
            songs={filteredSongs}
            search={search}
            onSearchChange={setSearch}
            selectedSongId={selectedSongId}
            onSelectSong={setSelectedSongId}
            isLoading={libraryStatus === 'loading'}
          />

          <VoiceSelector
            voices={songData?.voices ?? []}
            selectedVoice={selectedVoiceId}
            onSelectVoice={setSelectedVoiceId}
          />

          {/* Instrument selection removed — default Piano is always used. */}
        </div>

        <div className="space-y-4">
          <PlaybackControls
            status={playbackStatus}
            currentTime={currentTime}
            totalTime={totalTime}
            progress={progress}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
          />

          <TempoControl value={tempoPercent} onChange={setTempoPercent} />

            {/* BPM: assume 120 is app's base 100% tempo; pass sampleUrl to use an external click file if available */}
            <Metronome
              bpm={Math.round((tempoPercent / 100) * 120)}
              sampleUrl={null}
              beatsPerBar={4}
            />

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Focus Strength</h2>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="focus-blend-range">
              {selectedVoiceId ? `${focusBlendPercent}% background voices while focused` : 'Select a voice focus to use this control'}
            </label>
            <input
              id="focus-blend-range"
              type="range"
              min={0}
              max={100}
              step={1}
              value={focusBlendPercent}
              onChange={(event) => setFocusBlendPercent(Number(event.target.value))}
              disabled={!selectedVoiceId}
              className="w-full disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Only focused voice</span>
              <span>Current default mix</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App

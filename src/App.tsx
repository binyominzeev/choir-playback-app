import { useEffect, useMemo, useRef, useState } from 'react'
import { PlaybackControls } from './components/PlaybackControls'
import { SongLibrary } from './components/SongLibrary'
import { TempoControl } from './components/TempoControl'
import { VoiceSelector } from './components/VoiceSelector'
import { loadMidiFromUrl } from './services/midiLoader'
import { MidiPlaybackEngine } from './services/midiPlaybackEngine'
import { fetchSongLibrary } from './services/songLibrary'
import type { MidiSongData } from './types/midi'
import type { Song } from './types/song'

const STORAGE_KEYS = {
  songId: 'choir:lastSongId',
  voiceId: 'choir:lastVoiceId',
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function App() {
  const playbackEngineRef = useRef<MidiPlaybackEngine>(new MidiPlaybackEngine())

  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEYS.songId),
  )
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEYS.voiceId),
  )
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
        await engine.initializeFromMidi(loaded.midi, loaded.songData)

        const storedVoiceId = localStorage.getItem(STORAGE_KEYS.voiceId)
        const hasStoredVoice = loaded.songData.voices.some((voice) => voice.id === storedVoiceId)
        const nextVoice = hasStoredVoice ? storedVoiceId : null

        setSongData(loaded.songData)
        setSelectedVoiceId(nextVoice)
        engine.setFocusVoice(nextVoice)

        const total = loaded.songData.durationSeconds
        setProgress(0)
        setCurrentTime(formatTime(0))
        setTotalTime(formatTime(total))
        setPlaybackStatus('idle')
        setMessage(`Loaded ${selectedSong.title}`)
      } catch {
        setSongData(null)
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
    playbackEngineRef.current.play()
    setPlaybackStatus('playing')
    setMessage('Playback started')
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Detected tracks</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              {(songData?.voices ?? []).map((voice) => (
                <li
                  key={voice.id}
                  className={`rounded-md px-2 py-1 ${
                    selectedVoiceId === voice.id ? 'bg-indigo-50 font-semibold text-indigo-700' : ''
                  }`}
                >
                  {voice.name}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App

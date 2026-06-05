import type { Song } from '../types/song'

interface SongLibraryProps {
  songs: Song[]
  search: string
  onSearchChange: (value: string) => void
  selectedSongId: string | null
  onSelectSong: (songId: string) => void
  isLoading: boolean
}

export function SongLibrary({
  songs,
  search,
  onSearchChange,
  selectedSongId,
  onSelectSong,
  isLoading,
}: SongLibraryProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Song Library</h2>
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Search songs</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          placeholder="Search by title or composer"
        />
      </label>
      <div className="max-h-72 overflow-auto">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading songs...</p>
        ) : songs.length === 0 ? (
          <p className="text-sm text-slate-500">No songs found.</p>
        ) : (
          <ul className="space-y-2">
            {songs.map((song) => {
              const isSelected = selectedSongId === song.id
              return (
                <li key={song.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSong(song.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <p className="text-sm font-semibold">{song.title}</p>
                    {song.composer ? <p className="text-xs opacity-70">{song.composer}</p> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

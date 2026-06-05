import type { Song, SongLibraryResponse } from '../types/song'

const SONG_LIBRARY_URL = '/songs/index.json'

export async function fetchSongLibrary(): Promise<Song[]> {
  const response = await fetch(SONG_LIBRARY_URL)
  if (!response.ok) {
    throw new Error('Failed to load song library')
  }

  const data = (await response.json()) as SongLibraryResponse
  return data.songs ?? []
}

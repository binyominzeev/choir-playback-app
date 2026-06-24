import type { Song, SongLibraryResponse } from '../types/song'

const SONG_LIBRARY_URL = '/songs/index.json'

export async function fetchSongLibrary(): Promise<Song[]> {
  const requestUrl = new URL(SONG_LIBRARY_URL, window.location.origin)
  requestUrl.searchParams.set('t', String(Date.now()))

  const response = await fetch(requestUrl.toString(), {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  if (!response.ok) {
    throw new Error('Failed to load song library')
  }

  const data = (await response.json()) as SongLibraryResponse
  return data.songs ?? []
}

export interface Song {
  id: string
  title: string
  midiUrl: string
  composer?: string
}

export interface SongLibraryResponse {
  songs: Song[]
}

# choir-playback-app

Responsive Progressive Web App for choir practice with multi-track piano MIDI playback.

## Audio notes

The app's current instrument presets use sampled instruments via `smplr`.
`Simple Piano` uses the Splendid Grand Piano sample set, which the source project describes as public-domain AKAI piano samples.
`Vibraphone`, `Xylophone`, and `Violin` use `smplr`'s mallet and Versilian-backed sampled instrument paths.

## Development

```bash
npm install
npm run dev
```

## Build and quality checks

```bash
npm run lint
npm run build
```

## Song library format

The app fetches songs from `/songs/index.json`.

```json
{
  "songs": [
    {
      "id": "amazing-grace",
      "title": "Amazing Grace",
      "composer": "Traditional",
      "midiUrl": "/songs/amazing-grace.mid"
    }
  ]
}
```

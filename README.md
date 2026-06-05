# choir-playback-app

Responsive Progressive Web App for choir practice with multi-track piano MIDI playback.

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

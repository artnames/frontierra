# Audio Assets - Royalty-Free Soundscape

This folder contains audio files for the ambient soundscape system.
All files MUST be royalty-free with Pixabay License (no attribution required).

## Required Files

### Ambient SFX (`/audio/ambient/`)
Download from https://pixabay.com/sound-effects/ with filters:
- License: Pixabay License
- Category: Nature, Wind, Forest, Water

Required files:
- `wind-soft.mp3` - Gentle wind ambience (looping)
- `forest-birds.mp3` - Forest bird sounds (looping)
- `water-stream.mp3` - River/stream sounds (looping)
- `night-crickets.mp3` - Night insects (looping)
- `mountain-wind.mp3` - Mountain wind/rumble (looping)

### Cinematic Music (`/audio/music/`)
Download from https://pixabay.com/music/ with filters:
- Genre: Cinematic / Ambient
- Mood: Calm / Emotional / Atmospheric

Required files:
- `exploration-ambient.mp3` - Slow evolving pads (1-3 minutes)
- `discovery-theme.mp3` - Calm discovery music (1-3 minutes)
- `journey-calm.mp3` - Peaceful travel music (1-3 minutes)

## Fallback Behavior

If local files are missing, the system automatically falls back to
streaming from Pixabay's CDN. Local files are preferred for:
- Faster loading
- Offline capability
- Reduced external dependencies

## Audio Guidelines

- Keep file sizes reasonable (<5MB per file)
- Use MP3 format for compatibility
- Ambient loops should be seamless
- Music should have clean fade-in/out points
- No vocals or aggressive percussion

# The Infinity Archive

A cinematic, completionist Marvel screen tracker containing 111 ordered source listings expanded into 625 individually trackable movies, episodes, shorts, and specials.

## Features

- Full release-order archive through July 20, 2026
- Individual episode completion with collapsible series groups
- Completionist and official-MCU modes
- Search and content-type filters
- Live progress, remaining-time, phase, and catalog analytics
- Release-era journey view
- Browser-local persistence with JSON backup and restore
- Responsive desktop and mobile layouts
- Real poster artwork loaded from Wikipedia/Wikimedia with graceful fallbacks
- Official-trailer discovery through YouTube
- Live movie and episode details: titles, dates, genres, principal cast, and descriptions
- Cinematic title and episode detail drawer
- Episode-title enrichment inside expanded seasons
- Optional spoiler protection and expandable synopses
- Undo notifications and recently completed history
- Viewing streak, watched-time, completion mix, and finish-date analytics
- Installable progressive web app with offline shell caching
- Curated metadata and official-trailer correction layer
- Content-specific mini-synopses sourced from film plot sections and episode records
- No movie or episode streaming or playback functionality

## Local development

```bash
npm ci
npm run dev
```

## Production validation

```bash
npm run build
npm run validate:artifact
```

## Hosting from GitHub

Push this repository to GitHub and connect it to a Vinext-compatible Cloudflare Worker deployment or the hosting provider used to create the project. The app requires no database, accounts, or private environment variables. Progress is saved in each browser's local storage.

## Progress portability

Use **Backup** in the header to download a JSON progress file. Use **Restore** to load that progress into another browser or device.

## Disclaimer

This is an unofficial fan-made tracking tool. It is not affiliated with, endorsed by, or sponsored by Marvel or Disney. Marvel-related names are used only to identify the works being tracked. No copyrighted video content is hosted or streamed.

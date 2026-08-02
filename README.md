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
- Infinity Archive Catalog Steward for scheduled release-date, runtime, cast, synopsis, trailer, and release-status checks

## Local development

```bash
npm ci
npm run dev
```

## Production validation

```bash
npm run build
npm run validate:artifact
npm run steward:check
npm run steward:test
```

## GitHub Pages hosting

The included workflows build and deploy the static `out` directory to GitHub Pages. Personal progress remains local-first and can optionally sync through the app's Firebase configuration.

## Catalog Steward setup

1. Create a free TMDB account and request a developer API key.
2. Copy the **API Read Access Token** (the long bearer token, not the shorter v3 API key).
3. In this GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
4. Name the secret `TMDB_API_TOKEN` and paste the read-access token as its value.
5. Open **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save.
6. Open **Actions → Infinity Archive Catalog Steward → Run workflow** once. After that, it runs every morning at 10:17 UTC.

The steward monitors the records in `app/catalog-data.json` and scans for future movies returned by the exact intersection of TMDB's **Marvel Studios** company record and **Marvel Cinematic Universe** keyword record. It does not use broad title searches or general Marvel results. Exact title/year matching pins an existing record's TMDB ID on the first successful run; later runs use that ID permanently. Known titles are promoted into the trackable catalog when their verified U.S. theatrical date arrives. The same workflow validates, builds, commits, and deploys each catalog change, so its automated commit does not depend on a second workflow being triggered.

To monitor a newly announced project, add one record to `app/catalog-data.json` with a new permanent `archiveId`, official title, expected year, date, phase, and `status: "upcoming"`. Leave `tmdbId` as `null`; the steward will assign it only when TMDB returns one unambiguous exact match.

High-confidence future movies should be discovered without that manual step. Manual seeding remains the fallback for a movie not yet classified correctly by TMDB and for newly announced television projects; automatic television discovery is deferred until the steward can create and maintain episode-level records rather than incorrectly tracking an entire series as one item.

TMDB provides the automated catalog data. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Progress portability

Use **Backup** in the header to download a JSON progress file. Use **Restore** to load that progress into another browser or device.

## Disclaimer

This is an unofficial fan-made tracking tool. It is not affiliated with, endorsed by, or sponsored by Marvel or Disney. Marvel-related names are used only to identify the works being tracked. No copyrighted video content is hosted or streamed.

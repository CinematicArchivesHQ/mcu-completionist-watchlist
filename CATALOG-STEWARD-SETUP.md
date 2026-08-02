# Infinity Archive Catalog Steward Setup

This automation is scoped only to Infinity Archive.

## One-time setup

1. Upload every file from the v14.4 update ZIP to the root of the `mcu-completionist-watchlist` repository, preserving the included folders.
2. Commit the upload and wait for the normal GitHub Pages deployment to finish.
3. Create or sign in to a TMDB account.
4. In TMDB account settings, open **API** and request a developer API key for this non-commercial fan project.
5. Copy the long **API Read Access Token**.
6. In GitHub, open the Infinity Archive repository.
7. Go to **Settings → Secrets and variables → Actions → New repository secret**.
8. Enter `TMDB_API_TOKEN` as the name and paste the long TMDB read-access token as the value.
9. Go to **Settings → Actions → General → Workflow permissions**.
10. Select **Read and write permissions**, then save.
11. Open **Actions → Infinity Archive Catalog Steward → Run workflow → Run workflow**.

The first successful run should pin exact TMDB IDs for the two existing monitored projects. Because *Spider-Man: Brand New Day* has reached its stored U.S. release date, that run should also promote it into the trackable archive, update its metadata, commit the catalog change, and deploy the refreshed site.

## Normal operation

- The workflow checks the catalog every day at 10:17 UTC.
- A known project is matched by exact title and expected year once, then permanently tracked by its TMDB ID.
- U.S. wide theatrical dates take priority over limited dates.
- Date, runtime, genres, cast, synopsis, poster reference, trailer, and status can refresh automatically.
- On release, a project moves from Upcoming into the trackable catalog under its permanent `archiveId`.
- The workflow validates and builds before committing.
- The same workflow deploys the built site after committing, so it does not rely on an automated commit triggering another workflow.
- A health timestamp is committed at least weekly even when metadata does not change.

## Later announcements

Future movies can be added automatically when TMDB classifies them under the exact intersection of its **Marvel Studios** company record and **Marvel Cinematic Universe** keyword record and supplies a U.S. date within the five-year monitoring horizon. Broad Marvel searches are never accepted, which blocks most rumors, unrelated adaptations, and duplicate fan records.

If TMDB has not yet classified a genuine project correctly, add one object to `app/catalog-data.json` using a unique permanent `archiveId`. Set `tmdbId` to `null`, `status` to `upcoming`, and supply the official title, expected year, announced date, content type, phase, scope, and any currently known metadata. The next run will pin it only if TMDB returns exactly one title-and-year match.

Automatic discovery in v14.4 is movie-only. Television remains deliberately excluded until the steward has an episode-level importer; adding a newly announced series as one trackable title would damage Infinity Archive's individual-episode model. Existing seeded television records continue to work normally.

Do not reuse or rename an existing `archiveId`; it protects watch history across catalog updates.

## Troubleshooting

- **Missing secret:** confirm the name is exactly `TMDB_API_TOKEN`.
- **Push denied:** confirm Actions workflow permissions are set to Read and write.
- **Search missing or ambiguous:** the steward will leave the project untouched and log a warning instead of guessing.
- **No deployment after a no-change run:** expected; deployment runs only when the catalog file changes.
- **Site still shows old data:** open the site with `?v=14.4` once so the updated service worker replaces cache v10 with v11.

TMDB provides the automated catalog data. This product uses the TMDB API but is not endorsed or certified by TMDB.

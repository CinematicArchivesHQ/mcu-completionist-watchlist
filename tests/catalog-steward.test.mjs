import test from "node:test";
import assert from "node:assert/strict";
import { createDiscoveredMovieProject, filterNewDiscoveries, nextCatalogVersion, normalizeTitle, selectExactSearchResult, updateProjectFromTmdb, usTheatricalDate, validateCatalog } from "../scripts/catalog-steward.mjs";

const project = {
  archiveId: "mcu-example-2026", tmdbId: 42, mediaType: "movie", title: "Example: New Day", expectedYear: 2026,
  releaseDate: "2026-08-03", status: "upcoming", type: "Movie", phase: "Phase Six", scope: "official", runtime: null,
  genres: ["Action"], cast: [], description: "Pending", trailer: "", posterPath: null, lastVerifiedAt: null,
};

test("normalizes punctuation without weakening exact matching", () => {
  assert.equal(normalizeTitle("Spider-Man: Brand New Day"), "spider man brand new day");
  assert.equal(selectExactSearchResult(project, [
    { id: 1, title: "Example New Day", release_date: "2025-01-01" },
    { id: 2, title: "Example: New Day", release_date: "2026-08-03" },
  ]).id, 2);
  assert.equal(selectExactSearchResult(project, [
    { id: 2, title: "Example: New Day", release_date: "2026-08-03" },
    { id: 3, title: "Example: New Day", release_date: "2026-09-01" },
  ]), null);
});

test("prefers a US wide theatrical date over a limited date", () => {
  assert.equal(usTheatricalDate({ results: [{ iso_3166_1: "US", release_dates: [
    { type: 2, release_date: "2026-07-29T00:00:00.000Z" },
    { type: 3, release_date: "2026-07-31T00:00:00.000Z" },
  ] }] }), "2026-07-31");
});

test("promotes a known project after its release date and refreshes metadata", () => {
  const result = updateProjectFromTmdb(project, {
    title: project.title, release_date: "2026-08-03", runtime: 141, overview: "Final synopsis.", poster_path: "/poster.jpg",
    genres: [{ name: "Action" }, { name: "Adventure" }], credits: { cast: [{ name: "Actor One" }] },
    videos: { results: [{ site: "YouTube", key: "official", official: true, type: "Trailer", published_at: "2026-07-01" }] },
    release_dates: { results: [{ iso_3166_1: "US", release_dates: [{ type: 3, release_date: "2026-08-03T00:00:00.000Z" }] }] },
  }, "2026-08-04");
  assert.equal(result.project.status, "released");
  assert.equal(result.project.runtime, 141);
  assert.equal(result.project.trailer, "https://www.youtube.com/watch?v=official");
});

test("catalog versions increment once per update day", () => {
  assert.equal(nextCatalogVersion("2026.08.01.1", new Date("2026-08-01T12:00:00Z")), "2026.08.01.2");
  assert.equal(nextCatalogVersion("2026.08.01.9", new Date("2026-08-02T12:00:00Z")), "2026.08.02.1");
});

test("creates stable IDs for high-confidence discovered movies", () => {
  const discovered = createDiscoveredMovieProject({ id: 9001, title: "Future MCU Film", release_date: "2028-05-05", overview: "Announced.", poster_path: null });
  assert.equal(discovered.archiveId, "mcu-tmdb-movie-9001");
  assert.equal(discovered.tmdbId, 9001);
  assert.equal(discovered.status, "upcoming");
});

test("does not rediscover a known movie while its TMDB ID is still unpinned", () => {
  const catalog = {
    projects: [{
      archiveId: "mcu-spider-man-brand-new-day-2026",
      tmdbId: null,
      title: "Spider-Man: Brand New Day",
      expectedYear: 2026,
      releaseDate: "2026-07-31",
    }],
  };
  assert.deepEqual(filterNewDiscoveries(catalog, [
    { id: 1003596, title: "Spider-Man: Brand New Day", release_date: "2026-07-31" },
  ]), []);
});

test("does not rediscover a movie whose TMDB ID is already pinned", () => {
  const catalog = { projects: [{ ...project, tmdbId: 1003596 }] };
  assert.deepEqual(filterNewDiscoveries(catalog, [
    { id: 1003596, title: "A Retitled Result", release_date: "2026-07-31" },
  ]), []);
});

test("validation rejects duplicate permanent IDs", () => {
  assert.throws(() => validateCatalog({ schemaVersion: 1, projects: [project, { ...project }] }), /duplicate/);
});

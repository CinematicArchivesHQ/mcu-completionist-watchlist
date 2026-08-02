#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "app", "catalog-data.json");
const TMDB_BASE = "https://api.themoviedb.org/3";

export function normalizeTitle(value = "") {
  return value.normalize("NFKD").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

export function selectExactSearchResult(project, results = []) {
  const expected = normalizeTitle(project.title);
  const exact = results.filter((result) => {
    const titleMatches = [result.title, result.original_title].some((title) => normalizeTitle(title) === expected);
    const year = Number(String(result.release_date || "").slice(0, 4));
    return titleMatches && (!project.expectedYear || !year || year === project.expectedYear);
  });
  return exact.length === 1 ? exact[0] : null;
}

export function usTheatricalDate(releaseDates) {
  const us = releaseDates?.results?.find((item) => item.iso_3166_1 === "US");
  const dates = (us?.release_dates || [])
    .filter((item) => item.type === 3 || item.type === 2)
    .sort((a, b) => (b.type - a.type) || String(a.release_date).localeCompare(String(b.release_date)));
  return dates[0]?.release_date?.slice(0, 10) || null;
}

export function nextCatalogVersion(current, now) {
  const prefix = now.toISOString().slice(0, 10).replaceAll("-", ".");
  const match = String(current).match(/^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/);
  return match?.[1] === prefix ? `${prefix}.${Number(match[2]) + 1}` : `${prefix}.1`;
}

function bestTrailer(videos) {
  return (videos?.results || [])
    .filter((video) => video.site === "YouTube" && video.key && video.official !== false)
    .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer") || String(b.published_at || "").localeCompare(String(a.published_at || "")))[0];
}

function setIfChanged(target, key, value, changes, label = key) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return;
  if (JSON.stringify(target[key]) === JSON.stringify(value)) return;
  changes.push(`${label}: ${Array.isArray(target[key]) ? target[key].join(", ") : target[key] ?? "not set"} → ${Array.isArray(value) ? value.join(", ") : value}`);
  target[key] = value;
}

export function updateProjectFromTmdb(project, details, today) {
  const updated = structuredClone(project);
  const changes = [];
  const releaseDate = usTheatricalDate(details.release_dates) || details.release_date || project.releaseDate;
  const trailer = bestTrailer(details.videos);

  setIfChanged(updated, "title", details.title, changes, "title");
  setIfChanged(updated, "releaseDate", releaseDate, changes, "US theatrical date");
  setIfChanged(updated, "runtime", details.runtime > 0 ? details.runtime : null, changes, "runtime");
  setIfChanged(updated, "genres", details.genres?.map((genre) => genre.name), changes, "genres");
  setIfChanged(updated, "cast", details.credits?.cast?.slice(0, 8).map((person) => person.name), changes, "cast");
  setIfChanged(updated, "description", details.overview, changes, "synopsis");
  setIfChanged(updated, "posterPath", details.poster_path, changes, "poster");
  setIfChanged(updated, "trailer", trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null, changes, "trailer");

  const nextStatus = releaseDate && releaseDate <= today ? "released" : "upcoming";
  setIfChanged(updated, "status", nextStatus, changes, "archive status");
  return { project: updated, changes };
}

export function validateCatalog(catalog) {
  const errors = [];
  const archiveIds = new Set();
  const tmdbIds = new Set();
  if (catalog.schemaVersion !== 1) errors.push("catalog schemaVersion must be 1");
  for (const project of catalog.projects || []) {
    if (!project.archiveId || archiveIds.has(project.archiveId)) errors.push(`duplicate or missing archiveId: ${project.archiveId || "(missing)"}`);
    archiveIds.add(project.archiveId);
    if (project.tmdbId && tmdbIds.has(project.tmdbId)) errors.push(`duplicate TMDB id: ${project.tmdbId}`);
    if (project.tmdbId) tmdbIds.add(project.tmdbId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(project.releaseDate || "")) errors.push(`${project.archiveId}: invalid releaseDate`);
    if (!['upcoming', 'released', 'canceled'].includes(project.status)) errors.push(`${project.archiveId}: invalid status`);
  }
  if (errors.length) throw new Error(`Catalog validation failed:\n- ${errors.join("\n- ")}`);
}

async function tmdb(pathname, token) {
  const response = await fetch(`${TMDB_BASE}${pathname}`, { headers: { accept: "application/json", Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${pathname}: ${(await response.text()).slice(0, 240)}`);
  return response.json();
}

async function resolveTmdbId(project, token) {
  const params = new URLSearchParams({ query: project.title, include_adult: "false", language: "en-US" });
  if (project.expectedYear) params.set("year", String(project.expectedYear));
  const search = await tmdb(`/search/movie?${params}`, token);
  const result = selectExactSearchResult(project, search.results);
  if (!result) throw new Error(`${project.title}: TMDB search was missing or ambiguous; no ID was assigned`);
  return result.id;
}

async function resolveNamedId(endpoint, name, token) {
  const search = await tmdb(`/search/${endpoint}?${new URLSearchParams({ query: name, page: "1" })}`, token);
  const exact = (search.results || []).filter((result) => normalizeTitle(result.name) === normalizeTitle(name));
  if (exact.length !== 1) throw new Error(`${endpoint} lookup for ${name} was missing or ambiguous`);
  return exact[0].id;
}

export function createDiscoveredMovieProject(result) {
  const year = Number(String(result.release_date || "").slice(0, 4)) || null;
  return {
    archiveId: `mcu-tmdb-movie-${result.id}`,
    tmdbId: result.id,
    mediaType: "movie",
    title: result.title,
    expectedYear: year,
    releaseDate: result.release_date,
    status: "upcoming",
    type: "Movie",
    phase: "Unassigned",
    scope: "official",
    runtime: null,
    genres: [],
    cast: [],
    description: result.overview || "Official synopsis pending.",
    trailer: "",
    posterPath: result.poster_path || null,
    lastVerifiedAt: null,
  };
}

function projectReleaseKey(title, year) {
  return `${normalizeTitle(title)}::${year || "unknown"}`;
}

export function filterNewDiscoveries(catalog, results = []) {
  const existingTmdbIds = new Set(catalog.projects.map((project) => project.tmdbId).filter(Boolean));
  const existingReleaseKeys = new Set(catalog.projects.map((project) => {
    const year = project.expectedYear || Number(String(project.releaseDate || "").slice(0, 4)) || null;
    return projectReleaseKey(project.title, year);
  }));

  return results.filter((result) => {
    if (!result.id || !result.title || !result.release_date || existingTmdbIds.has(result.id)) return false;
    const year = Number(String(result.release_date).slice(0, 4)) || null;
    return !existingReleaseKeys.has(projectReleaseKey(result.title, year));
  }).map(createDiscoveredMovieProject);
}

async function discoverUpcomingMovies(catalog, token, today) {
  if (!catalog.steward.automaticDiscovery || !catalog.discovery?.mediaTypes?.includes("movie")) return [];
  const companyId = await resolveNamedId("company", catalog.discovery.companyName, token);
  const keywordId = await resolveNamedId("keyword", catalog.discovery.keywordName, token);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + (catalog.discovery.horizonYears || 5));
  const base = {
    include_adult: "false",
    include_video: "false",
    language: "en-US",
    region: "US",
    sort_by: "primary_release_date.asc",
    with_companies: String(companyId),
    with_keywords: String(keywordId),
    "primary_release_date.gte": today,
    "primary_release_date.lte": end.toISOString().slice(0, 10),
  };
  const found = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await tmdb(`/discover/movie?${new URLSearchParams({ ...base, page: String(page) })}`, token);
    found.push(...(response.results || []));
    if (page >= (response.total_pages || 1)) break;
  }
  return filterNewDiscoveries(catalog, found);
}

function healthCommitDue(lastCheckedAt, now, intervalDays) {
  if (!lastCheckedAt) return true;
  return now.valueOf() - new Date(lastCheckedAt).valueOf() >= intervalDays * 86400000;
}

export async function runSteward({ write = false, checkOnly = false, token = process.env.TMDB_API_TOKEN, now = new Date(), today = process.env.CATALOG_TODAY || now.toISOString().slice(0, 10) } = {}) {
  const original = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
  validateCatalog(original);
  if (checkOnly) return { changed: false, catalog: original, messages: ["Catalog validation passed."] };
  if (!token) throw new Error("TMDB_API_TOKEN is required. Add it as a GitHub Actions repository secret.");

  const catalog = structuredClone(original);
  const messages = [];
  const events = [];
  let contentChanged = false;

  // Resolve every known record before discovery. Otherwise TMDB can return a
  // known project as "new" while its permanent external ID is still null.
  for (const current of catalog.projects) {
    if (current.status === "canceled" || current.tmdbId) continue;
    try {
      current.tmdbId = await resolveTmdbId(current, token);
      contentChanged = true;
      messages.push(`${current.title}: pinned TMDB id ${current.tmdbId}`);
    } catch (error) {
      messages.push(`WARNING: ${error.message}`);
    }
  }
  validateCatalog(catalog);

  try {
    const discovered = await discoverUpcomingMovies(catalog, token, today);
    for (const project of discovered) {
      catalog.projects.push(project);
      contentChanged = true;
      messages.push(`${project.title}: discovered as a high-confidence future MCU movie`);
      events.push({ at: now.toISOString(), type: "discovered", title: project.title, detail: `Automatically added from the exact ${catalog.discovery.companyName} + ${catalog.discovery.keywordName} TMDB intersection.` });
    }
  } catch (error) {
    messages.push(`WARNING: automatic discovery skipped: ${error.message}`);
  }

  for (let index = 0; index < catalog.projects.length; index += 1) {
    const current = catalog.projects[index];
    if (current.status === "canceled") continue;
    const tmdbId = current.tmdbId;
    try {
      if (!tmdbId) {
        messages.push(`WARNING: ${current.title}: TMDB ID remains unresolved; metadata refresh skipped`);
        continue;
      }
      const details = await tmdb(`/movie/${tmdbId}?append_to_response=release_dates,credits,videos&language=en-US`, token);
      if (normalizeTitle(details.title) !== normalizeTitle(current.title) && normalizeTitle(details.original_title) !== normalizeTitle(current.title)) {
        throw new Error(`${current.title}: pinned TMDB id ${tmdbId} returned an unexpected title (${details.title})`);
      }
      const result = updateProjectFromTmdb(current, details, today);
      if (result.changes.length) {
        contentChanged = true;
        result.project.lastVerifiedAt = now.toISOString();
        events.push({ at: now.toISOString(), type: result.project.status === "released" && current.status !== "released" ? "released" : "metadata", title: result.project.title, detail: result.changes.join("; ") });
      }
      catalog.projects[index] = result.project;
    } catch (error) {
      messages.push(`WARNING: ${error.message}`);
    }
  }

  const healthDue = healthCommitDue(catalog.steward.lastCheckedAt, now, catalog.steward.healthCommitIntervalDays || 7);
  if (contentChanged) catalog.catalogVersion = nextCatalogVersion(catalog.catalogVersion, now);
  if (contentChanged || healthDue) {
    catalog.steward.lastCheckedAt = now.toISOString();
    for (const project of catalog.projects) if (!project.lastVerifiedAt) project.lastVerifiedAt = now.toISOString();
  }
  if (events.length) catalog.changelog = [...events.reverse(), ...(catalog.changelog || [])].slice(0, 30);
  validateCatalog(catalog);

  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  const changed = serialized !== `${JSON.stringify(original, null, 2)}\n`;
  if (changed && write) await fs.writeFile(CATALOG_PATH, serialized);
  messages.push(changed ? `${write ? "Updated" : "Would update"} ${path.relative(ROOT, CATALOG_PATH)}.` : "No catalog file change required.");
  return { changed, catalog, messages };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await runSteward({ write: args.has("--write"), checkOnly: args.has("--check") });
  result.messages.forEach((message) => console.log(message));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}

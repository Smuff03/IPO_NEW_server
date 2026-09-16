import { env } from "@/config/env";
import { withRetry, NoRetryError } from "@/utils/retry";
import { logger } from "@/utils/logger";
import type {
  SourceAdapter,
  RawIpoRecord,
  RawGmpRecord,
  RawSubscriptionRecord,
  RawArticleRecord,
  RawReviewRecord,
} from "@/types/ingestion";

const BASE_URL = `https://${env.rapidApi.host}`;
const SOURCE_NAME = "Indian IPO Wallah (RapidAPI)";
const SOURCE_URL = "https://rapidapi.com/Dennis254/api/indian-ipo-wallah";

/**
 * Confirmed against a live response on 2026-09-13 (Indian IPO Wallah, RapidAPI).
 * This provider exposes exactly two endpoints — there is NO grey-market-premium
 * or day-wise-subscription endpoint on this API at all:
 *
 *  GET /main_ipo_public?limit&offset&id&name_of_ipo
 *    "Current" (pre-listing / DRHP-stage) IPOs. Fields observed:
 *    id, name_of_ipo, offer_date, issue_price, expected_listing_earning,
 *    ipo_open_date, ipo_close_date, ipo_allotment_date, ipo_listing_date,
 *    face_value, issue_size, about_company, issue_objectives,
 *    prospectus_link, logo.
 *    In practice most of these are null until very close to the IPO's open
 *    date — many rows are just a company profile stub (about_company + logo)
 *    with no price/date decided yet. We only ingest rows that have enough
 *    real data to render a non-misleading card.
 *
 *  GET /listed_main_ipo_public?order&limit&offset
 *    Already-listed IPOs, with post-listing performance. Fields observed:
 *    id, name_of_ipo (sometimes literally the string "Data not found"),
 *    offer_price ("116-122"), listed_on ("Mar 19, 2026"),
 *    list_price ("122.0(NSE)"), closing_price ("191.00 (56.56%)"),
 *    subscription ("1.12x"), logo.
 *    This endpoint does not return the original open/close bidding window —
 *    only the listing date. We approximate openDate/closeDate as the
 *    listing date for these rows (documented limitation, see below).
 *
 * NEITHER endpoint returns a GMP figure or a QIB/NII/Retail breakdown.
 * fetchGMP() and fetchSubscriptions() below correctly return [] rather than
 * fabricating numbers — if you need live GMP, it has to come from a
 * different provider (e.g. IPO Guru, already stubbed in adapters/index.ts).
 */

let hasLoggedCurrentSample = false;
let hasLoggedListedSample = false;
function logRawSampleOnce(alreadyLogged: boolean, label: string, data: unknown) {
  if (alreadyLogged) return;
  logger.info(`RapidAPI raw sample response for ${label} (first call only)`, {
    sample: JSON.stringify(data).slice(0, 4000),
  });
}

/** Thrown for RapidAPI errors that a retry cannot fix (bad/missing key, not subscribed). */
class RapidApiAuthError extends Error {}

/** Maps a non-OK response to a clear, specific error per status code (req. #14). */
async function toRapidApiError(res: Response): Promise<Error> {
  const body = await res.text().catch(() => "");
  const snippet = body.slice(0, 300);
  switch (res.status) {
    case 401:
      return new RapidApiAuthError(
        `RapidAPI 401 Unauthorized — RAPIDAPI_KEY is missing/invalid. Check server/.env. (${snippet})`
      );
    case 403:
      return new RapidApiAuthError(
        `RapidAPI 403 Forbidden — key is valid but not subscribed to "${env.rapidApi.host}" (or plan/quota doesn't allow this endpoint). (${snippet})`
      );
    case 429:
      return new Error(`RapidAPI 429 Too Many Requests — rate limit hit for "${env.rapidApi.host}". (${snippet})`);
    case 500:
    case 502:
    case 503:
    case 504:
      return new Error(`RapidAPI ${res.status} ${res.statusText} — upstream provider error, will retry. (${snippet})`);
    default:
      return new Error(`RapidAPI request failed: ${res.status} ${res.statusText} — ${snippet}`);
  }
}

async function rapidApiGet<T>(path: string): Promise<T> {
  if (!env.rapidApi.key) {
    throw new Error("RAPIDAPI_KEY is not set — add it to server/.env");
  }
  try {
    return await withRetry(
      async () => {
        const res = await fetch(`${BASE_URL}${path}`, {
          headers: {
            "Content-Type": "application/json",
            "x-rapidapi-host": env.rapidApi.host,
            "x-rapidapi-key": env.rapidApi.key,
          },
        });
        if (!res.ok) {
          const error = await toRapidApiError(res);
          // 401/403 won't be fixed by retrying with the same bad key — fail fast.
          if (error instanceof RapidApiAuthError) throw new NoRetryError(error.message);
          throw error;
        }
        return (await res.json()) as T;
      },
      { label: `RapidAPI ${path}`, attempts: 3, timeoutMs: 10_000 }
    );
  } catch (err) {
    if (err instanceof NoRetryError) throw new Error(err.message);
    // withTimeout()'s own error already says "timed out after Nms" — surface as-is.
    throw err;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Treats null, empty, and this provider's own "Data not found" placeholder as missing. */
function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "data not found") return undefined;
  return trimmed;
}

/** Parses a leading numeric amount out of strings like "107.0(NSE)" or "191.00 (56.56%)". */
function leadingNumber(value: unknown): number | undefined {
  const str = cleanString(value);
  if (!str) return undefined;
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = parseFloat(match[0]);
  return Number.isNaN(n) ? undefined : n;
}

/** Parses a "min-max" range string (e.g. "116-122") into [min, max]. Falls back to a single value for both. */
function parseRange(value: unknown): [number, number] | undefined {
  const str = cleanString(value);
  if (!str) return undefined;
  const parts = str.split("-").map((p) => parseFloat(p.trim()));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  const single = leadingNumber(str);
  return single != null ? [single, single] : undefined;
}

/** Parses this provider's date strings, e.g. "Mar 19, 2026". Returns undefined rather than an invalid Date. */
function parseDate(value: unknown): string | undefined {
  const str = cleanString(value);
  if (!str) return undefined;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function normalizeCurrentIpo(item: Record<string, unknown>): RawIpoRecord | null {
  const rawName = cleanString(item.name_of_ipo);
  const openDate = parseDate(item.ipo_open_date);
  const closeDate = parseDate(item.ipo_close_date);
  const priceRange = parseRange(item.issue_price);

  // This endpoint frequently returns pre-announcement "profile only" stubs
  // (about_company + logo, everything else null). We only turn a row into a
  // displayed IPO once it actually has a name, an open/close window, and a
  // price band — otherwise we'd be showing a fabricated "₹0–0" card.
  if (!rawName || !openDate || !closeDate || !priceRange) return null;

  const name = rawName.toLowerCase().includes("ipo") ? rawName : `${rawName} IPO`;

  return {
    name,
    slug: slugify(rawName),
    company: rawName,
    type: "MAINBOARD",
    priceBandMin: priceRange[0],
    priceBandMax: priceRange[1],
    lotSize: 0, // not provided by this endpoint
    issueSizeCr: leadingNumber(item.issue_size) ?? 0,
    openDate,
    closeDate,
    allotmentDate: parseDate(item.ipo_allotment_date),
    listingDate: parseDate(item.ipo_listing_date),
    about: cleanString(item.about_company),
    logo: cleanString(item.logo),
    estimatedListing: leadingNumber(item.expected_listing_earning),
    registrarUrl: cleanString(item.prospectus_link),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
  };
}

function normalizeListedIpo(item: Record<string, unknown>): RawIpoRecord | null {
  const rawName = cleanString(item.name_of_ipo);
  const priceRange = parseRange(item.offer_price);
  const listingDate = parseDate(item.listed_on);

  if (!rawName || !priceRange) return null;

  const name = rawName.toLowerCase().includes("ipo") ? rawName : `${rawName} IPO`;

  // KNOWN LIMITATION: this endpoint doesn't return the original bidding
  // window, only the listing date. We use the listing date for both
  // open/close so the record has a valid (non-fabricated-differently) date
  // — this only affects the "Date" column for already-listed IPOs, and does
  // not affect status (computeStatus checks listingDate first, so these
  // always resolve to LISTED regardless of open/close).
  const fallbackDate = listingDate ?? new Date().toISOString();

  return {
    name,
    slug: slugify(rawName),
    company: rawName,
    type: "MAINBOARD",
    priceBandMin: priceRange[0],
    priceBandMax: priceRange[1],
    lotSize: 0, // not provided by this endpoint
    issueSizeCr: 0, // not provided by this endpoint
    openDate: fallbackDate,
    closeDate: fallbackDate,
    listingDate: listingDate,
    logo: cleanString(item.logo),
    estimatedListing: leadingNumber(item.list_price) ?? leadingNumber(item.closing_price),
    expectedSubscription: leadingNumber(item.subscription),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
  };
}

export class RapidApiIpoAdapter implements SourceAdapter {
  async fetchUpcomingIPOs(): Promise<RawIpoRecord[]> {
    const records: RawIpoRecord[] = [];
    let currentSeen = 0;
    let listedSeen = 0;
    const errors: string[] = [];

    try {
      const data = await rapidApiGet<unknown>("/main_ipo_public?limit=50&offset=0");
      logRawSampleOnce(hasLoggedCurrentSample, "/main_ipo_public", data);
      hasLoggedCurrentSample = true;
      const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      currentSeen = items.length;
      for (const item of items) {
        const record = normalizeCurrentIpo(item);
        if (record) records.push(record);
      }
      logger.info(`RapidAPI /main_ipo_public: parsed ${records.length}/${currentSeen} complete records (rest lacked name/dates/price)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("RapidAPI /main_ipo_public failed", { error: message });
      errors.push(message);
    }

    const beforeListed = records.length;
    try {
      const data = await rapidApiGet<unknown>("/listed_main_ipo_public?order=id.desc&limit=50&offset=0");
      logRawSampleOnce(hasLoggedListedSample, "/listed_main_ipo_public", data);
      hasLoggedListedSample = true;
      const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      listedSeen = items.length;
      for (const item of items) {
        const record = normalizeListedIpo(item);
        if (record) records.push(record);
      }
      logger.info(`RapidAPI /listed_main_ipo_public: parsed ${records.length - beforeListed}/${listedSeen} records`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("RapidAPI /listed_main_ipo_public failed", { error: message });
      errors.push(message);
    }

    if (errors.length === 2) {
      // Both calls failed — surface the error so the sync job logs a real failure
      // instead of silently reporting zero records as if it succeeded.
      throw new Error(errors.join("; "));
    }

    return records;
  }

  // This provider has no GMP endpoint at all. Returning [] (rather than
  // guessing at a field that doesn't exist) is the honest behavior — pair
  // this adapter with a real GMP source (e.g. IPO Guru) if you need live
  // grey market premium figures.
  async fetchGMP(): Promise<RawGmpRecord[]> {
    logger.warn("Indian IPO Wallah has no GMP field — fetchGMP() intentionally returns no records. Configure IPOGURU_API_KEY or another GMP source instead.");
    return [];
  }

  // No day-wise QIB/NII/Retail breakdown is available from this provider.
  // The one aggregate "subscription" figure it does expose (for already-
  // listed IPOs) is captured as expectedSubscription in fetchUpcomingIPOs()
  // instead, since that's a single number on the IPO record, not a
  // per-day/per-category series.
  async fetchSubscriptions(): Promise<RawSubscriptionRecord[]> {
    return [];
  }

  async fetchArticles(): Promise<RawArticleRecord[]> {
    return [];
  }

  async fetchReviews(): Promise<RawReviewRecord[]> {
    return [];
  }
}

export const rapidApiIpoAdapter = new RapidApiIpoAdapter();
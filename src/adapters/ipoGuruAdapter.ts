import { env } from "@/config/env";
import { withRetry } from "@/utils/retry";
import { logger } from "@/utils/logger";
import type { SourceAdapter, RawIpoRecord, RawGmpRecord, RawSubscriptionRecord, RawArticleRecord, RawReviewRecord } from "@/types/ingestion";

const BASE_URL = "https://www.ipoguru.in/api/v1";
const SOURCE_NAME = "IPO Guru";
const SOURCE_URL = "https://www.ipoguru.in/ipo-gmp-details-developer-api";

// Response shape per IPO Guru's published API docs (as of the request date —
// re-verify against https://www.ipoguru.in/ipo-gmp-details-developer-api if
// fields ever stop mapping cleanly).
interface IpoGuruRecord {
  name: string;
  type: "Mainboard" | "SME";
  sub_type?: string;
  open_date: string; // YYYY-MM-DD
  close_date: string;
  allotment_date: string | null;
  listing_date: string | null;
  listing_price: string | null;
  price_band: string | null; // "163-172"
  issue_price: string;
  face_value: string | null;
  lot_size: string | null;
  issue_size: string | null; // "₹74 Cr"
  sale_type: string | null;
  listing_on: string | null;
  registrar: string | null;
  status: "Open" | "Upcoming" | "Closed";
  subscription: {
    qib: string | null;
    nii: string | null;
    retail: string | null;
    total: string | null;
    updated_at: string | null;
  };
  gmp: {
    price: string;
    percentage: string | number;
    updated_at: string | null;
  };
}

interface IpoGuruResponse {
  success: boolean;
  count: number;
  data: IpoGuruRecord[];
}

async function ipoGuruGet(params: Record<string, string> = {}): Promise<IpoGuruRecord[]> {
  if (!env.ipoGuru.apiKey) {
    throw new Error("IPOGURU_API_KEY is not set — add it to server/.env");
  }
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/ipos${qs ? `?${qs}` : ""}`;

  return withRetry(
    async () => {
      const res = await fetch(url, { headers: { "X-API-KEY": env.ipoGuru.apiKey } });
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(`IPO Guru rate limit hit: ${body.message ?? "429"}`);
      }
      if (!res.ok) {
        throw new Error(`IPO Guru request failed: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as IpoGuruResponse;
      if (!json.success) throw new Error("IPO Guru returned success:false");
      return json.data;
    },
    { label: "IPO Guru /ipos", attempts: 3, timeoutMs: 10_000 }
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parsePriceBand(band: string | null, issuePrice: string): { min: number; max: number } {
  if (band) {
    const [min, max] = band.split("-").map((n) => parseInt(n.trim(), 10));
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
  }
  const p = parseInt(issuePrice, 10) || 0;
  return { min: p, max: p };
}

function parseIssueSizeCr(raw: string | null): number {
  if (!raw) return 0;
  const match = raw.replace(/,/g, "").match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

function normalizeIpo(item: IpoGuruRecord): RawIpoRecord {
  const { min, max } = parsePriceBand(item.price_band, item.issue_price);
  return {
    name: item.name.toLowerCase().includes("ipo") ? item.name : `${item.name} IPO`,
    slug: slugify(item.name),
    company: item.name,
    type: item.type === "SME" ? "SME" : "MAINBOARD",
    priceBandMin: min,
    priceBandMax: max,
    lotSize: parseInt(item.lot_size ?? "0", 10) || 0,
    issueSizeCr: parseIssueSizeCr(item.issue_size),
    openDate: item.open_date,
    closeDate: item.close_date,
    allotmentDate: item.allotment_date ?? undefined,
    listingDate: item.listing_date ?? undefined,
    registrar: item.registrar ?? undefined,
    leadManagers: [],
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
  };
}

export class IpoGuruAdapter implements SourceAdapter {
  async fetchUpcomingIPOs(): Promise<RawIpoRecord[]> {
    const items = await ipoGuruGet();
    return items.map(normalizeIpo);
  }

  async fetchGMP(): Promise<RawGmpRecord[]> {
    const items = await ipoGuruGet();
    return items
      .filter((item) => item.gmp?.price != null)
      .map((item) => ({
        ipoSlug: slugify(item.name),
        gmp: parseInt(item.gmp.price, 10) || 0,
        source: SOURCE_NAME,
      }));
  }

  async fetchSubscriptions(): Promise<RawSubscriptionRecord[]> {
    const items = await ipoGuruGet({ status: "open" });
    return items
      .filter((item) => item.subscription?.total != null)
      .map((item) => ({
        ipoSlug: slugify(item.name),
        day: daysSince(item.open_date),
        qib: parseFloat(item.subscription.qib ?? "0") || 0,
        nii: parseFloat(item.subscription.nii ?? "0") || 0,
        retail: parseFloat(item.subscription.retail ?? "0") || 0,
        total: parseFloat(item.subscription.total ?? "0") || 0,
        source: SOURCE_NAME,
      }));
  }

  // IPO Guru's public API doesn't expose articles or review sentiment —
  // pair this adapter with another source for those, or leave them empty.
  async fetchArticles(): Promise<RawArticleRecord[]> {
    return [];
  }

  async fetchReviews(): Promise<RawReviewRecord[]> {
    return [];
  }
}

export const ipoGuruAdapter = new IpoGuruAdapter();

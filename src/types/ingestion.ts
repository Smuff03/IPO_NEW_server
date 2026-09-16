export interface RawIpoRecord {
  name: string;
  slug: string;
  company: string;
  type: "MAINBOARD" | "SME";
  priceBandMin: number;
  priceBandMax: number;
  lotSize: number;
  issueSizeCr: number;
  openDate: string;
  closeDate: string;
  allotmentDate?: string;
  refundDate?: string;
  demateDate?: string;
  listingDate?: string;
  registrar?: string;
  registrarUrl?: string;
  leadManagers?: string[];
  about?: string;
  strengths?: string[];
  risks?: string[];
  logo?: string;
  expectedSubscription?: number;
  estimatedListing?: number;
  source: string;
  sourceUrl: string;
}

export interface RawGmpRecord {
  ipoSlug: string;
  gmp: number;
  source: string;
}

export interface RawSubscriptionRecord {
  ipoSlug: string;
  day: number;
  qib: number;
  nii: number;
  retail: number;
  employee?: number;
  total: number;
  source: string;
}

export interface RawArticleRecord {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image?: string;
  category: "NEWS" | "ANALYSIS" | "GMP_UPDATE" | "GUIDE" | "ALLOTMENT_GUIDE";
  relatedIpoSlugs?: string[];
  source: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface RawReviewRecord {
  ipoSlug: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  reviewCount: number;
  source: string;
  sourceUrl: string;
}

/**
 * Contract every data-source integration must implement. Swap MockSourceAdapter
 * for a real implementation (an API client or compliant scraper) without
 * touching the services or routes that consume it — see adapters/README.md.
 */
export interface SourceAdapter {
  fetchUpcomingIPOs(): Promise<RawIpoRecord[]>;
  fetchGMP(): Promise<RawGmpRecord[]>;
  fetchSubscriptions(): Promise<RawSubscriptionRecord[]>;
  fetchArticles(): Promise<RawArticleRecord[]>;
  fetchReviews(): Promise<RawReviewRecord[]>;
}

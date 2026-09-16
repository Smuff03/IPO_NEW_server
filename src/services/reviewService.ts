import { prisma } from "@/utils/prisma";
import { logger } from "@/utils/logger";
import { getActiveAdapters } from "@/adapters";

/**
 * Ingests aggregate sentiment counts only — never full review text — from
 * sources whose terms permit reuse. See adapters/README.md before adding a
 * new review source.
 */
export async function ingestReviews() {
  const adapters = getActiveAdapters();
  let touched = 0;
  const errors: string[] = [];

  for (const adapter of adapters) {
    let records;
    try {
      records = await adapter.fetchReviews();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Review adapter fetch failed", { error: message });
      errors.push(message);
      continue;
    }

    for (const record of records) {
      if (!record.source || !record.sourceUrl) continue;
      const ipo = await prisma.iPO.findUnique({ where: { slug: record.ipoSlug } });
      if (!ipo) continue;

      const existing = await prisma.review.findFirst({ where: { ipoId: ipo.id, source: record.source } });
      const data = {
        sentiment: record.sentiment,
        positivePct: record.positivePct,
        neutralPct: record.neutralPct,
        negativePct: record.negativePct,
        reviewCount: record.reviewCount,
        sourceUrl: record.sourceUrl,
        lastUpdated: new Date(),
        isStale: false,
      };

      if (existing) {
        await prisma.review.update({ where: { id: existing.id }, data });
      } else {
        await prisma.review.create({ data: { ipoId: ipo.id, source: record.source, ...data } });
      }
      touched++;
    }
  }

  return { touched, errors };
}

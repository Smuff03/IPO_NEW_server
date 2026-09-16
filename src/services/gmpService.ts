import { prisma } from "@/utils/prisma";
import { logger } from "@/utils/logger";
import { getActiveAdapters } from "@/adapters";

function trendFor(newGmp: number, previousGmp: number): "UP" | "DOWN" | "FLAT" {
  if (newGmp > previousGmp) return "UP";
  if (newGmp < previousGmp) return "DOWN";
  return "FLAT";
}

/**
 * Refreshes GMP for every IPO from active adapters. On a per-adapter failure,
 * the previously stored GMP is kept and the IPO is flagged `isStale: true`
 * instead of being overwritten with a fabricated or null value.
 */
export async function ingestGmp() {
  const adapters = getActiveAdapters();
  let touched = 0;
  let staled = 0;
  const errors: string[] = [];

  for (const adapter of adapters) {
    let records;
    try {
      records = await adapter.fetchGMP();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("GMP adapter fetch failed", { error: message });
      errors.push(message);
      continue;
    }

    for (const record of records) {
      if (!record.source) continue;
      const ipo = await prisma.iPO.findUnique({ where: { slug: record.ipoSlug } });
      if (!ipo) continue;

      const trend = trendFor(record.gmp, ipo.gmp);
      await prisma.iPO.update({
        where: { id: ipo.id },
        data: { gmp: record.gmp, gmpTrend: trend, lastUpdated: new Date(), isStale: false },
      });
      await prisma.gMPHistory.create({
        data: { ipoId: ipo.id, gmp: record.gmp, source: record.source },
      });
      touched++;
    }
  }

  // Mark IPOs untouched by any adapter this cycle as stale rather than guessing new values.
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000);
  const staleResult = await prisma.iPO.updateMany({
    where: { lastUpdated: { lt: staleThreshold }, isStale: false, status: { in: ["OPEN", "CLOSING_TODAY"] } },
    data: { isStale: true },
  });
  staled = staleResult.count;

  return { touched, staled, errors };
}

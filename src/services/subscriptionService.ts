import { prisma } from "@/utils/prisma";
import { logger } from "@/utils/logger";
import { getActiveAdapters } from "@/adapters";

/** Ingests day-wise subscription figures. Only runs meaningfully while an IPO is open. */
export async function ingestSubscriptions() {
  const adapters = getActiveAdapters();
  let touched = 0;
  const errors: string[] = [];

  for (const adapter of adapters) {
    let records;
    try {
      records = await adapter.fetchSubscriptions();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Subscription adapter fetch failed", { error: message });
      errors.push(message);
      continue;
    }

    for (const record of records) {
      if (!record.source) continue;
      const ipo = await prisma.iPO.findUnique({ where: { slug: record.ipoSlug } });
      if (!ipo || (ipo.status !== "OPEN" && ipo.status !== "CLOSING_TODAY")) continue;

      await prisma.subscription.upsert({
        where: { id: `${ipo.id}-day-${record.day}` }, // stable synthetic id via findFirst fallback below if not present
        create: {
          id: `${ipo.id}-day-${record.day}`,
          ipoId: ipo.id,
          day: record.day,
          qib: record.qib,
          nii: record.nii,
          retail: record.retail,
          employee: record.employee ?? null,
          total: record.total,
          source: record.source,
        },
        update: {
          qib: record.qib,
          nii: record.nii,
          retail: record.retail,
          employee: record.employee ?? null,
          total: record.total,
          timestamp: new Date(),
          source: record.source,
        },
      });
      touched++;
    }
  }

  return { touched, errors };
}

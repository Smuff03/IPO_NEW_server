import cron from "node-cron";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { ingestGmp } from "@/services/gmpService";
import { ingestUpcomingIpos, refreshIpoStatuses } from "@/services/ipoService";
import { ingestSubscriptions } from "@/services/subscriptionService";
import { ingestArticles } from "@/services/articleService";
import { ingestReviews } from "@/services/reviewService";

async function runJob(name: string, fn: () => Promise<{ touched: number; errors?: string[] } | number>) {
  const log = await prisma.updateLog.create({ data: { job: name, status: "SUCCESS", startedAt: new Date() } });
  try {
    const result = await fn();
    const touched = typeof result === "number" ? result : result.touched;
    const errors = typeof result === "number" ? [] : result.errors ?? [];
    await prisma.updateLog.update({
      where: { id: log.id },
      data: {
        status: errors.length ? "PARTIAL" : "SUCCESS",
        recordsTouched: touched,
        message: errors.join("; ") || null,
        finishedAt: new Date(),
      },
    });
    logger.info(`Cron job "${name}" finished`, { touched, errors: errors.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Cron job "${name}" failed`, { error: message });
    await prisma.updateLog.update({
      where: { id: log.id },
      data: { status: "FAILURE", message, finishedAt: new Date() },
    });
  }
}

/**
 * Registers every scheduled ingestion job. Schedules are configurable via env
 * vars (see .env.example) so cadence can change without a code deploy.
 * Subscription ingestion additionally checks per-IPO status inside the
 * service itself, so it's a no-op for IPOs that aren't currently open.
 */
export function startScheduledJobs() {
  if (!env.enableCron) {
    logger.warn("Cron jobs disabled via ENABLE_CRON=false");
    return;
  }

  cron.schedule(env.cron.gmp, () => runJob("gmp", ingestGmp));
  cron.schedule(env.cron.status, () => runJob("statuses", refreshIpoStatuses));
  cron.schedule(env.cron.subscription, () => runJob("subscriptions", ingestSubscriptions));
  cron.schedule(env.cron.upcoming, () => runJob("upcoming-ipos", ingestUpcomingIpos));
  cron.schedule(env.cron.articles, () => runJob("articles", ingestArticles));
  cron.schedule(env.cron.reviews, () => runJob("reviews", ingestReviews));

  logger.info("Scheduled jobs registered", { ...env.cron });
}

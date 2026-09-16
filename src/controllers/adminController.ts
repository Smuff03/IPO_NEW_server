import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { ApiError } from "@/middleware/errorHandler";
import { logger } from "@/utils/logger";
import { ingestGmp } from "@/services/gmpService";
import { ingestUpcomingIpos, refreshIpoStatuses, upsertIpoRecord } from "@/services/ipoService";
import { ingestSubscriptions } from "@/services/subscriptionService";
import { ingestArticles } from "@/services/articleService";
import { ingestReviews } from "@/services/reviewService";

// ---------- IPOs ----------

const ipoInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  company: z.string().min(1),
  type: z.enum(["MAINBOARD", "SME"]).default("MAINBOARD"),
  priceBandMin: z.number().int().positive(),
  priceBandMax: z.number().int().positive(),
  lotSize: z.number().int().positive(),
  issueSizeCr: z.number().positive(),
  openDate: z.string(),
  closeDate: z.string(),
  allotmentDate: z.string().optional(),
  listingDate: z.string().optional(),
  registrar: z.string().optional(),
  registrarUrl: z.string().url().optional(),
  leadManagers: z.array(z.string()).optional(),
  about: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
});

export async function adminListIpos(_req: Request, res: Response) {
  const ipos = await prisma.iPO.findMany({ orderBy: { createdAt: "desc" } });
  res.json(ipos);
}

export async function adminCreateOrUpdateIpo(req: Request, res: Response) {
  const parsed = ipoInputSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((i) => i.message).join(", "));
  const ipo = await upsertIpoRecord({ ...parsed.data, source: "Admin manual entry", sourceUrl: "internal://admin" });
  res.json(ipo);
}

export async function adminDeleteIpo(req: Request, res: Response) {
  await prisma.iPO.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}

const gmpEditSchema = z.object({ gmp: z.number().int() });

export async function adminEditGmp(req: Request, res: Response) {
  const parsed = gmpEditSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "gmp must be an integer");
  const ipo = await prisma.iPO.update({
    where: { id: String(req.params.id) },
    data: { gmp: parsed.data.gmp, source: "Admin manual entry", lastUpdated: new Date(), isStale: false },
  });
  res.json(ipo);
}

const subscriptionEditSchema = z.object({
  day: z.number().int().positive(),
  qib: z.number(),
  nii: z.number(),
  retail: z.number(),
  employee: z.number().optional(),
  total: z.number(),
});

export async function adminEditSubscription(req: Request, res: Response) {
  const parsed = subscriptionEditSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid subscription payload");
  const { day, ...rest } = parsed.data;
  const ipoId = String(req.params.id);
  const subscription = await prisma.subscription.upsert({
    where: { id: `${ipoId}-day-${day}` },
    create: { id: `${ipoId}-day-${day}`, ipoId, day, source: "Admin manual entry", ...rest },
    update: { ...rest, source: "Admin manual entry", timestamp: new Date() },
  });
  res.json(subscription);
}

// ---------- Articles ----------

const articleInputSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  image: z.string().url().optional(),
  category: z.enum(["NEWS", "ANALYSIS", "GMP_UPDATE", "GUIDE", "ALLOTMENT_GUIDE"]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export async function adminListArticles(_req: Request, res: Response) {
  const articles = await prisma.article.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(articles);
}

export async function adminCreateOrUpdateArticle(req: Request, res: Response) {
  const parsed = articleInputSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((i) => i.message).join(", "));
  const data = parsed.data;
  const article = await prisma.article.upsert({
    where: { slug: data.slug },
    create: { ...data, source: "Admin", sourceUrl: "internal://admin" },
    update: data,
  });
  res.json(article);
}

export async function adminDeleteArticle(req: Request, res: Response) {
  await prisma.article.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}

// ---------- Data sources ----------

export async function adminListDataSources(_req: Request, res: Response) {
  const sources = await prisma.dataSource.findMany({ orderBy: { name: "asc" } });
  res.json(sources);
}

const dataSourceToggleSchema = z.object({ enabled: z.boolean() });

export async function adminToggleDataSource(req: Request, res: Response) {
  const parsed = dataSourceToggleSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "enabled must be a boolean");
  const source = await prisma.dataSource.update({ where: { id: String(req.params.id) }, data: { enabled: parsed.data.enabled } });
  res.json(source);
}

// ---------- Allotment sources ----------

const allotmentSourceSchema = z.object({
  registrar: z.string().min(1),
  url: z.string().url(),
  ipoSlug: z.string().optional(),
  note: z.string().optional(),
  enabled: z.boolean().default(true),
});

export async function adminListAllotmentSources(_req: Request, res: Response) {
  res.json(await prisma.allotmentSource.findMany({ orderBy: { registrar: "asc" } }));
}

export async function adminCreateAllotmentSource(req: Request, res: Response) {
  const parsed = allotmentSourceSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((i) => i.message).join(", "));
  res.json(await prisma.allotmentSource.create({ data: parsed.data }));
}

export async function adminDeleteAllotmentSource(req: Request, res: Response) {
  await prisma.allotmentSource.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}

// ---------- Update logs & manual trigger ----------

export async function adminListUpdateLogs(_req: Request, res: Response) {
  const logs = await prisma.updateLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
  res.json(logs);
}

const JOB_RUNNERS: Record<string, () => Promise<{ touched: number; errors?: string[] }>> = {
  gmp: ingestGmp,
  ipos: ingestUpcomingIpos,
  subscriptions: ingestSubscriptions,
  articles: ingestArticles,
  reviews: ingestReviews,
  statuses: async () => ({ touched: await refreshIpoStatuses() }),
};

/**
 * POST /api/admin/sync-now — manually triggers the RapidAPI → Database sync
 * (IPO listings, then GMP) outside the 30-min cron cadence. Wraps the same
 * ingestUpcomingIpos/ingestGmp services the scheduler uses, so behavior
 * (retry, error handling, "keep previous data on failure") is identical.
 */
export async function adminSyncNow(_req: Request, res: Response) {
  const results: Record<string, { touched: number; errors?: string[] }> = {};

  for (const [job, runner] of Object.entries({ ipos: ingestUpcomingIpos, gmp: ingestGmp })) {
    const log = await prisma.updateLog.create({ data: { job, status: "SUCCESS", startedAt: new Date() } });
    try {
      const result = await runner();
      results[job] = result;
      await prisma.updateLog.update({
        where: { id: log.id },
        data: {
          status: result.errors?.length ? "PARTIAL" : "SUCCESS",
          recordsTouched: result.touched,
          message: result.errors?.join("; ") || null,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Manual sync-now step "${job}" failed`, { error: message });
      results[job] = { touched: 0, errors: [message] };
      await prisma.updateLog.update({
        where: { id: log.id },
        data: { status: "FAILURE", message, finishedAt: new Date() },
      });
    }
  }

  res.json({ syncedAt: new Date().toISOString(), results });
}

export async function adminTriggerJob(req: Request, res: Response) {
  const job = String(req.params.job);
  const runner = JOB_RUNNERS[job];
  if (!runner) throw new ApiError(400, `Unknown job "${job}". Valid jobs: ${Object.keys(JOB_RUNNERS).join(", ")}`);

  const log = await prisma.updateLog.create({ data: { job, status: "SUCCESS", startedAt: new Date() } });
  try {
    const result = await runner();
    await prisma.updateLog.update({
      where: { id: log.id },
      data: {
        status: result.errors?.length ? "PARTIAL" : "SUCCESS",
        recordsTouched: result.touched,
        message: result.errors?.join("; "),
        finishedAt: new Date(),
      },
    });
    res.json({ job, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Manual trigger for job "${job}" failed`, { error: message });
    await prisma.updateLog.update({
      where: { id: log.id },
      data: { status: "FAILURE", message, finishedAt: new Date() },
    });
    throw new ApiError(500, `Job "${job}" failed: ${message}`);
  }
}

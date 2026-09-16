import type { Request, Response } from "express";
import { prisma } from "@/utils/prisma";
import { ApiError } from "@/middleware/errorHandler";

const PUBLIC_IPO_SELECT = {
  id: true,
  name: true,
  slug: true,
  company: true,
  logo: true,
  type: true,
  priceBandMin: true,
  priceBandMax: true,
  lotSize: true,
  issueSizeCr: true,
  gmp: true,
  gmpTrend: true,
  expectedSubscription: true,
  estimatedListing: true,
  openDate: true,
  closeDate: true,
  allotmentDate: true,
  refundDate: true,
  demateDate: true,
  listingDate: true,
  status: true,
  registrar: true,
  registrarUrl: true,
  leadManagers: true,
  about: true,
  strengths: true,
  risks: true,
  source: true,
  sourceUrl: true,
  lastUpdated: true,
  isStale: true,
} as const;

export async function listIpos(req: Request, res: Response) {
  const { status, search, page = "1", pageSize = "20" } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = String(status).toUpperCase();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const take = Math.min(50, Number(pageSize) || 20);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.iPO.findMany({ where, select: PUBLIC_IPO_SELECT, orderBy: { openDate: "desc" }, take, skip }),
    prisma.iPO.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
}

export async function getIpoBySlug(req: Request, res: Response) {
  const ipo = await prisma.iPO.findUnique({
    where: { slug: String(req.params.slug) },
    select: {
      ...PUBLIC_IPO_SELECT,
      gmpHistory: { orderBy: { timestamp: "asc" }, select: { gmp: true, timestamp: true } },
      subscriptions: { orderBy: { day: "asc" } },
    },
  });
  if (!ipo) throw new ApiError(404, "IPO not found");
  res.json(ipo);
}

export async function getGmpSnapshot(_req: Request, res: Response) {
  const ipos = await prisma.iPO.findMany({
    where: { status: { in: ["OPEN", "CLOSING_TODAY", "UPCOMING"] } },
    select: { slug: true, name: true, gmp: true, gmpTrend: true, lastUpdated: true, isStale: true, source: true },
    orderBy: { gmp: "desc" },
  });
  res.json(ipos);
}

export async function getSubscriptions(req: Request, res: Response) {
  const { slug } = req.query as Record<string, string>;
  const where = slug ? { ipo: { slug } } : {};
  const subscriptions = await prisma.subscription.findMany({
    where,
    include: { ipo: { select: { slug: true, name: true } } },
    orderBy: [{ ipoId: "asc" }, { day: "asc" }],
  });
  res.json(subscriptions);
}

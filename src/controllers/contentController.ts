import type { Request, Response } from "express";
import { prisma } from "@/utils/prisma";
import { ApiError } from "@/middleware/errorHandler";

export async function listArticles(req: Request, res: Response) {
  const { category, search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (category) where.category = String(category).toUpperCase();
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
    ];
  }

  const take = Math.min(50, Number(pageSize) || 20);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.article.findMany({ where, orderBy: { publishedAt: "desc" }, take, skip }),
    prisma.article.count({ where }),
  ]);
  res.json({ items, total, page: Number(page) || 1, pageSize: take });
}

export async function getArticleBySlug(req: Request, res: Response) {
  const article = await prisma.article.findFirst({
    where: { slug: String(req.params.slug), status: "PUBLISHED" },
    include: { relatedIpos: { select: { slug: true, name: true } } },
  });
  if (!article) throw new ApiError(404, "Article not found");
  res.json(article);
}

export async function listReviews(_req: Request, res: Response) {
  const reviews = await prisma.review.findMany({
    include: { ipo: { select: { slug: true, name: true } } },
    orderBy: { publishedAt: "desc" },
  });
  res.json(reviews);
}

export async function listAllotmentSources(_req: Request, res: Response) {
  const sources = await prisma.allotmentSource.findMany({ where: { enabled: true }, orderBy: { registrar: "asc" } });
  res.json(sources);
}

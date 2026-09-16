import { prisma } from "@/utils/prisma";
import { logger } from "@/utils/logger";
import { getActiveAdapters } from "@/adapters";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

export async function ingestArticles() {
  const adapters = getActiveAdapters();
  let touched = 0;
  const errors: string[] = [];

  for (const adapter of adapters) {
    let records;
    try {
      records = await adapter.fetchArticles();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Article adapter fetch failed", { error: message });
      errors.push(message);
      continue;
    }

    for (const record of records) {
      if (!record.source || !record.sourceUrl) continue;

      const relatedIpos = record.relatedIpoSlugs?.length
        ? await prisma.iPO.findMany({ where: { slug: { in: record.relatedIpoSlugs } }, select: { id: true } })
        : [];

      await prisma.article.upsert({
        where: { slug: record.slug },
        create: {
          title: record.title,
          slug: record.slug,
          excerpt: record.excerpt,
          content: sanitizeHtml(record.content),
          image: record.image,
          category: record.category,
          source: record.source,
          sourceUrl: record.sourceUrl,
          publishedAt: new Date(record.publishedAt),
          status: "DRAFT", // ingested content stays in draft until an editor reviews & publishes it
          relatedIpos: { connect: relatedIpos },
        },
        update: {
          title: record.title,
          excerpt: record.excerpt,
          content: sanitizeHtml(record.content),
          image: record.image,
          lastUpdated: new Date(),
        },
      });
      touched++;
    }
  }

  return { touched, errors };
}

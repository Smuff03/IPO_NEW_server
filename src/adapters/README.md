# Source adapters

Every external data source (an API, or a compliant scraper) implements the
`SourceAdapter` interface defined in `src/types/ingestion.ts`:

```ts
interface SourceAdapter {
  fetchUpcomingIPOs(): Promise<RawIpoRecord[]>;
  fetchGMP(): Promise<RawGmpRecord[]>;
  fetchSubscriptions(): Promise<RawSubscriptionRecord[]>;
  fetchArticles(): Promise<RawArticleRecord[]>;
  fetchReviews(): Promise<RawReviewRecord[]>;
}
```

`mockSourceAdapter.ts` is the only adapter registered out of the box. It
generates clearly-labelled placeholder data so the API and cron jobs are
exercised end-to-end without depending on any external service.

## Adding a real adapter

1. Create `src/adapters/<providerName>Adapter.ts` implementing `SourceAdapter`.
2. Use `fetch`/`axios` for API-based sources. If a source only offers a
   website with no API, scraping must respect that site's `robots.txt`,
   terms of service, and rate limits — do not scrape sources that prohibit it.
3. Every record you return must set `source` (a human-readable provider name)
   and `sourceUrl` (a link back to where the figure came from). The services
   layer rejects records missing either field.
4. Add retries/timeouts around your network calls (see `withRetry` in
   `src/utils/retry.ts`) and log failures via `src/utils/logger.ts`.
5. Register the adapter in `src/adapters/index.ts`, gated by a `DataSource`
   row so it can be toggled from the admin dashboard without a redeploy.
6. If a fetch fails, the adapter should throw — the calling service (see
   `src/services/*.ts`) is responsible for catching that, keeping the last
   good value in the database, and marking it `isStale: true` rather than
   overwriting it with `null`/fabricated data.

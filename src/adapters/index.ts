import type { SourceAdapter } from "@/types/ingestion";
import { mockSourceAdapter } from "./mockSourceAdapter";
import { rapidApiIpoAdapter } from "./rapidApiIpoAdapter";
import { ipoGuruAdapter } from "./ipoGuruAdapter";
import { env } from "@/config/env";

/**
 * Central registry of active adapters. In production, resolve this list from
 * enabled rows in the DataSource table instead of a static array, so sources
 * can be toggled from the admin dashboard without a redeploy.
 *
 * Preference order when multiple keys are configured: IPO Guru (direct,
 * documented, lower latency) > RapidAPI wrapper > mock fallback.
 */
export function getActiveAdapters(): SourceAdapter[] {
  const adapters: SourceAdapter[] = [];

  if (env.ipoGuru.apiKey) adapters.push(ipoGuruAdapter);
  if (env.rapidApi.key) adapters.push(rapidApiIpoAdapter);
  if (adapters.length === 0) adapters.push(mockSourceAdapter);

  return adapters;
}

import { env } from "@/config/env";
import { createApp } from "@/app";
import { startScheduledJobs } from "@/jobs/scheduler";
import { getActiveAdapters } from "@/adapters";
import { logger } from "@/utils/logger";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`, { env: env.nodeEnv });
  // Diagnostic: confirms which data source(s) this process actually resolved
  // at boot, and whether RAPIDAPI_KEY/IPOGURU_API_KEY were read from .env —
  // check this first if the UI is showing data you didn't expect.
  const adapterNames = getActiveAdapters().map((a) => a.constructor.name);
  logger.info(`Active source adapter(s): ${adapterNames.join(", ")}`, {
    rapidApiKeySet: Boolean(env.rapidApi.key),
    rapidApiKeyLength: env.rapidApi.key.length,
    ipoGuruKeySet: Boolean(env.ipoGuru.apiKey),
  });
  startScheduledJobs();
});

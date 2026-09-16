import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { env } from "@/config/env";
import { apiRateLimiter } from "@/middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { ipoRoutes } from "@/routes/ipoRoutes";
import { contentRoutes } from "@/routes/contentRoutes";
import { authRoutes } from "@/routes/authRoutes";
import { adminRoutes } from "@/routes/adminRoutes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  // Public, read-only API — safe to expose without auth.
  app.use("/api", apiRateLimiter, ipoRoutes);
  app.use("/api", apiRateLimiter, contentRoutes);

  // Auth + admin — admin routes are protected inside adminRoutes itself.
  app.use("/api/auth", apiRateLimiter, authRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

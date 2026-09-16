import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAuth, requireAdmin } from "@/middleware/auth";
import {
  adminListIpos,
  adminCreateOrUpdateIpo,
  adminDeleteIpo,
  adminEditGmp,
  adminEditSubscription,
  adminListArticles,
  adminCreateOrUpdateArticle,
  adminDeleteArticle,
  adminListDataSources,
  adminToggleDataSource,
  adminListAllotmentSources,
  adminCreateAllotmentSource,
  adminDeleteAllotmentSource,
  adminListUpdateLogs,
  adminTriggerJob,
  adminSyncNow,
} from "@/controllers/adminController";

export const adminRoutes = Router();

// Every route below requires a valid admin JWT — never mount adminRoutes without these guards.
adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get("/ipos", asyncHandler(adminListIpos));
adminRoutes.post("/ipos", asyncHandler(adminCreateOrUpdateIpo));
adminRoutes.delete("/ipos/:id", asyncHandler(adminDeleteIpo));
adminRoutes.patch("/ipos/:id/gmp", asyncHandler(adminEditGmp));
adminRoutes.patch("/ipos/:id/subscription", asyncHandler(adminEditSubscription));

adminRoutes.get("/articles", asyncHandler(adminListArticles));
adminRoutes.post("/articles", asyncHandler(adminCreateOrUpdateArticle));
adminRoutes.delete("/articles/:id", asyncHandler(adminDeleteArticle));

adminRoutes.get("/sources", asyncHandler(adminListDataSources));
adminRoutes.patch("/sources/:id", asyncHandler(adminToggleDataSource));

adminRoutes.get("/allotment-sources", asyncHandler(adminListAllotmentSources));
adminRoutes.post("/allotment-sources", asyncHandler(adminCreateAllotmentSource));
adminRoutes.delete("/allotment-sources/:id", asyncHandler(adminDeleteAllotmentSource));

adminRoutes.get("/logs", asyncHandler(adminListUpdateLogs));
adminRoutes.post("/trigger/:job", asyncHandler(adminTriggerJob));
// Manual "Sync Now" — runs the RapidAPI → Database pipeline immediately.
adminRoutes.post("/sync-now", asyncHandler(adminSyncNow));

import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { listIpos, getIpoBySlug, getGmpSnapshot, getSubscriptions } from "@/controllers/ipoController";

export const ipoRoutes = Router();

ipoRoutes.get("/ipos", asyncHandler(listIpos));
ipoRoutes.get("/ipos/:slug", asyncHandler(getIpoBySlug));
ipoRoutes.get("/gmp", asyncHandler(getGmpSnapshot));
ipoRoutes.get("/subscriptions", asyncHandler(getSubscriptions));

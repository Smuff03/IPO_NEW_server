import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { listArticles, getArticleBySlug, listReviews, listAllotmentSources } from "@/controllers/contentController";

export const contentRoutes = Router();

contentRoutes.get("/articles", asyncHandler(listArticles));
contentRoutes.get("/articles/:slug", asyncHandler(getArticleBySlug));
contentRoutes.get("/reviews", asyncHandler(listReviews));
contentRoutes.get("/allotment", asyncHandler(listAllotmentSources));

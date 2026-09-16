import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { loginRateLimiter } from "@/middleware/rateLimiter";
import { login } from "@/controllers/authController";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimiter, asyncHandler(login));

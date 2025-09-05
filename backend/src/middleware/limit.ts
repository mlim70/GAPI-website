// middleware/limit.ts
import type { Request, Response, NextFunction } from "express";
import { redis } from "../utils/general/redisUpstash";

// Common ID functions for rate limiting
export const ipId = (req: Request): string => req.ip || "unknown";
export const emailId = (req: Request): string => req.body?.email?.toLowerCase() || ipId(req);
export const userIdId = (req: Request): string => (req as any).userId || ipId(req);
export const identifierId = (req: Request): string => {
  const identifier = req.body?.identifier || req.body?.email || req.body?.username;
  return identifier?.toLowerCase() || ipId(req);
};

type IdFn = (req: Request) => string;
type Opts = {
  windowMs: number;
  max: number;
  prefix?: string;
  idFn?: IdFn;            // who to count against (IP, userId, email, etc.)
  routeKey?: (req: Request) => string; // allows grouping routes, e.g. "/api/login"
};

export function fixedWindowLimiter({
  windowMs,
  max,
  prefix = "rl",
  idFn = (req) => req.ip || "unknown",
  routeKey = (req) => req.path,
}: Opts) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const windowId = Math.floor(Date.now() / windowMs);
      const key = `${prefix}:${routeKey(req)}:${idFn(req)}:${windowId}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000) + 1);
      }

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));

      if (count > max) {
        const resetEpoch = (windowId + 1) * (windowMs / 1000);
        const retryAfter = Math.max(1, Math.ceil(resetEpoch - Date.now() / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({ message: "Too many requests. Please try again later.", retryAfter });
      }

      return next();
    } catch (err) {
      // fail-open but log
      return next();
    }
  };
}

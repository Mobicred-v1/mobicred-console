import { SetMetadata, applyDecorators } from "@nestjs/common";
import { Throttle, SkipThrottle } from "@nestjs/throttler";

export const RATE_LIMIT_KEY = "rate_limit_config";

export interface RateLimitConfig {
  ttl: number;      // Time window in seconds
  limit: number;    // Max requests in time window
  blockDuration?: number; // How long to block after exceeding limit (seconds)
}

/**
 * Apply rate limiting to a route
 * @param limit - Max requests allowed
 * @param ttl - Time window in seconds (default: 60)
 */
export const RateLimit = (limit: number, ttl: number = 60) =>
  applyDecorators(
    Throttle({ default: { limit, ttl: ttl * 1000 } }),
    SetMetadata(RATE_LIMIT_KEY, { limit, ttl })
  );

/**
 * Skip rate limiting for this route
 */
export { SkipThrottle };

/**
 * Stricter rate limit for sensitive operations
 */
export const StrictRateLimit = () => RateLimit(5, 60);

/**
 * Relaxed rate limit for public endpoints
 */
export const RelaxedRateLimit = () => RateLimit(100, 60);

/**
 * Rate limit by user ID instead of IP
 */
export const RATE_LIMIT_BY_USER = "rate_limit_by_user";
export const RateLimitByUser = () => SetMetadata(RATE_LIMIT_BY_USER, true);

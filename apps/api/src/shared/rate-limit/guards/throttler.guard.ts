import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerException } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { RATE_LIMIT_BY_USER } from "../decorators/throttle.decorator";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: any,
    storageService: any,
    private readonly reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Generate tracking key based on IP or user ID
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const byUser = this.reflector.get<boolean>(
      RATE_LIMIT_BY_USER,
      this.context?.getHandler()
    );

    if (byUser && req.user?.id) {
      return `user_${req.user.id}`;
    }

    // Use X-Forwarded-For if behind proxy, otherwise use IP
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0])
      : req.ip || req.connection?.remoteAddress;

    return `ip_${ip}`;
  }

  private context?: ExecutionContext;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.context = context;
    return super.canActivate(context);
  }

  /**
   * Custom error response
   */
  protected throwThrottlingException(context: ExecutionContext): void {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Add retry-after header
    const retryAfter = 60; // Default retry after 60 seconds
    res.header("Retry-After", retryAfter.toString());
    res.header("X-RateLimit-Reset", new Date(Date.now() + retryAfter * 1000).toISOString());

    throw new ThrottlerException("Too many requests. Please try again later.");
  }
}

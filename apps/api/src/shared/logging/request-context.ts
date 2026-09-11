import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
  path: string;
  method: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    const userId = (req as any).user?.id;

    const context: RequestContext = {
      requestId,
      userId,
      startTime: Date.now(),
      path: req.path,
      method: req.method,
    };

    // Set request ID header for response
    res.setHeader("X-Request-Id", requestId);

    requestContextStorage.run(context, () => {
      next();
    });
  }
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get current request ID
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

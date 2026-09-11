import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import {
  DEPRECATED_VERSION_KEY,
  API_VERSION_KEY,
} from "../decorators/version.decorator";
import { getVersionInfo, isVersionDeprecated } from "../version.config";

@Injectable()
export class VersionHeaderInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    // Get current API version from request
    const apiVersion = request.apiVersion || request.headers["x-api-version"] || "1";

    // Get version metadata from handler/controller
    const versions = this.reflector.getAllAndOverride<string[]>(API_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const deprecationInfo = this.reflector.getAllAndOverride<any>(
      DEPRECATED_VERSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    return next.handle().pipe(
      tap(() => {
        // Always add current version header
        response.setHeader("X-API-Version", apiVersion);

        // Add supported versions header
        if (versions) {
          response.setHeader("X-API-Supported-Versions", versions.join(", "));
        }

        // Add deprecation headers if applicable
        if (deprecationInfo || isVersionDeprecated(apiVersion)) {
          const versionInfo = getVersionInfo(apiVersion);

          response.setHeader("Deprecation", "true");

          if (deprecationInfo?.sunsetDate || versionInfo?.sunsetAt) {
            const sunsetDate = deprecationInfo?.sunsetDate || versionInfo?.sunsetAt;
            response.setHeader("Sunset", sunsetDate.toUTCString());
          }

          if (deprecationInfo?.replacedBy || versionInfo?.replacedBy) {
            const replacement = deprecationInfo?.replacedBy || versionInfo?.replacedBy;
            response.setHeader("Link", `<${replacement}>; rel="successor-version"`);
          }

          // Add warning header for deprecated APIs
          const message = deprecationInfo?.message || "This API version is deprecated";
          response.setHeader(
            "Warning",
            `299 - "${message}"`
          );
        }
      })
    );
  }
}

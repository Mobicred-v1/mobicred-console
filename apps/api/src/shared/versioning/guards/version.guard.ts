import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  API_VERSION_KEY,
  MIN_VERSION_KEY,
  MAX_VERSION_KEY,
} from "../decorators/version.decorator";
import {
  SUPPORTED_VERSIONS,
  isVersionSunset,
  getVersionInfo,
} from "../version.config";

@Injectable()
export class ApiVersionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract version from various sources
    const version = this.extractVersion(request);
    request.apiVersion = version;

    // Check if version is supported
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Unsupported API Version",
          message: `API version '${version}' is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
          supportedVersions: SUPPORTED_VERSIONS,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if version is sunset
    if (isVersionSunset(version)) {
      const versionInfo = getVersionInfo(version);
      throw new HttpException(
        {
          statusCode: HttpStatus.GONE,
          error: "API Version Sunset",
          message: `API version '${version}' is no longer supported.`,
          sunsetDate: versionInfo?.sunsetAt,
          replacedBy: versionInfo?.replacedBy,
        },
        HttpStatus.GONE
      );
    }

    // Check version constraints from decorators
    const allowedVersions = this.reflector.getAllAndOverride<string[]>(
      API_VERSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (allowedVersions && !allowedVersions.includes(version)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Version Not Available",
          message: `This endpoint is not available in API version '${version}'. Available in: ${allowedVersions.join(", ")}`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check min version
    const minVersion = this.reflector.getAllAndOverride<string>(MIN_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (minVersion && this.compareVersions(version, minVersion) < 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Version Too Low",
          message: `This endpoint requires API version ${minVersion} or higher.`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check max version
    const maxVersion = this.reflector.getAllAndOverride<string>(MAX_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (maxVersion && this.compareVersions(version, maxVersion) > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.GONE,
          error: "Endpoint Removed",
          message: `This endpoint was removed in API version ${maxVersion}.`,
        },
        HttpStatus.GONE
      );
    }

    return true;
  }

  private extractVersion(request: any): string {
    // Priority: URL param > Header > Query > Default

    // 1. URL versioning: /api/v1/...
    const urlMatch = request.url?.match(/\/v(\d+)\//);
    if (urlMatch) return urlMatch[1];

    // 2. Header versioning: X-API-Version
    const headerVersion = request.headers["x-api-version"];
    if (headerVersion) return headerVersion;

    // 3. Accept header versioning: application/vnd.api.v1+json
    const acceptHeader = request.headers["accept"];
    if (acceptHeader) {
      const acceptMatch = acceptHeader.match(/vnd\.api\.v(\d+)/);
      if (acceptMatch) return acceptMatch[1];
    }

    // 4. Query parameter: ?version=1
    if (request.query?.version) return request.query.version;

    // 5. Default version
    return "1";
  }

  private compareVersions(a: string, b: string): number {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    return numA - numB;
  }
}

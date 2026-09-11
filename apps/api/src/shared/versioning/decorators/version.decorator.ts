import { SetMetadata, applyDecorators } from "@nestjs/common";
import { ApiHeader, ApiOperation } from "@nestjs/swagger";

export const API_VERSION_KEY = "api_version";
export const DEPRECATED_VERSION_KEY = "deprecated_version";
export const MIN_VERSION_KEY = "min_version";
export const MAX_VERSION_KEY = "max_version";

/**
 * Mark a controller or method as available in specific version(s)
 * @param versions - Version(s) this endpoint is available in
 */
export const ApiVersion = (...versions: string[]) =>
  SetMetadata(API_VERSION_KEY, versions);

/**
 * Mark an endpoint as deprecated
 * @param message - Deprecation message
 * @param replacedBy - The new endpoint/version to use
 * @param sunsetDate - When this endpoint will be removed
 */
export const DeprecatedVersion = (
  message: string,
  replacedBy?: string,
  sunsetDate?: Date
) =>
  applyDecorators(
    SetMetadata(DEPRECATED_VERSION_KEY, { message, replacedBy, sunsetDate }),
    ApiOperation({
      deprecated: true,
      description: `**DEPRECATED**: ${message}${replacedBy ? ` Use ${replacedBy} instead.` : ""}`,
    })
  );

/**
 * Require minimum API version
 */
export const MinVersion = (version: string) =>
  SetMetadata(MIN_VERSION_KEY, version);

/**
 * Require maximum API version (useful for sunset endpoints)
 */
export const MaxVersion = (version: string) =>
  SetMetadata(MAX_VERSION_KEY, version);

/**
 * Combined decorator for versioned endpoint with Swagger docs
 */
export const VersionedEndpoint = (version: string, deprecated = false) =>
  applyDecorators(
    ApiVersion(version),
    ApiHeader({
      name: "X-API-Version",
      description: `API Version (current: ${version})`,
      required: false,
    }),
    ...(deprecated ? [DeprecatedVersion(`This endpoint is deprecated in v${version}`)] : [])
  );

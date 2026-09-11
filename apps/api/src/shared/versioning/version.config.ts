/**
 * API Versioning Configuration
 *
 * Supports multiple versioning strategies:
 * - URI: /api/v1/users, /api/v2/users
 * - Header: X-API-Version: 1
 * - Media Type: Accept: application/vnd.api.v1+json
 * - Query: /api/users?version=1
 */

export enum VersioningStrategy {
  URI = "uri",
  HEADER = "header",
  MEDIA_TYPE = "media_type",
  QUERY = "query",
}

export interface ApiVersion {
  version: string;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  replacedBy?: string;
  changelog?: string;
}

export const API_VERSIONS: ApiVersion[] = [
  {
    version: "1",
    deprecatedAt: undefined,
    sunsetAt: undefined,
    replacedBy: undefined,
  },
  // Add new versions here:
  // {
  //   version: "2",
  //   deprecatedAt: undefined,
  //   sunsetAt: undefined,
  //   replacedBy: undefined,
  // },
];

export const CURRENT_VERSION = "1";
export const SUPPORTED_VERSIONS = API_VERSIONS.map((v) => v.version);
export const DEFAULT_VERSION = "1";

/**
 * Get version info by version number
 */
export function getVersionInfo(version: string): ApiVersion | undefined {
  return API_VERSIONS.find((v) => v.version === version);
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.deprecatedAt ? new Date() >= info.deprecatedAt : false;
}

/**
 * Check if a version is sunset (no longer supported)
 */
export function isVersionSunset(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.sunsetAt ? new Date() >= info.sunsetAt : false;
}

/**
 * Get days until sunset for a version
 */
export function getDaysUntilSunset(version: string): number | null {
  const info = getVersionInfo(version);
  if (!info?.sunsetAt) return null;
  const diff = info.sunsetAt.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

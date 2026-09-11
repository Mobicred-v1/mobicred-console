import { Module, Global } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiVersionGuard } from "./guards/version.guard";
import { VersionHeaderInterceptor } from "./interceptors/version-header.interceptor";

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiVersionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: VersionHeaderInterceptor,
    },
  ],
  exports: [],
})
export class VersioningModule {}

/**
 * NestJS built-in versioning configuration helper
 * Use in main.ts:
 *
 * import { VersioningType } from "@nestjs/common";
 *
 * app.enableVersioning({
 *   type: VersioningType.URI,        // /v1/users
 *   // OR
 *   type: VersioningType.HEADER,     // X-API-Version: 1
 *   header: "X-API-Version",
 *   // OR
 *   type: VersioningType.MEDIA_TYPE, // Accept: application/vnd.api.v1+json
 *   key: "v=",
 * });
 */
export const VERSIONING_CONFIG = {
  uri: {
    type: "URI" as const,
    prefix: "v",
  },
  header: {
    type: "HEADER" as const,
    header: "X-API-Version",
  },
  mediaType: {
    type: "MEDIA_TYPE" as const,
    key: "v=",
  },
};

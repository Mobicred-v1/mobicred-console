import { Module, Global } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { CustomThrottlerGuard } from "./guards/throttler.guard";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: parseInt(process.env.THROTTLE_TTL || "60") * 1000,
          limit: parseInt(process.env.THROTTLE_LIMIT || "100"),
        },
        {
          name: "strict",
          ttl: 60000,
          limit: 5,
        },
        {
          name: "auth",
          ttl: 300000, // 5 minutes
          limit: 5,    // 5 attempts
        },
      ],
      storage: new RedisThrottlerStorage(),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}

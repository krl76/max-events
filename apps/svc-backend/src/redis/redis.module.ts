// START_MODULE_CONTRACT
// PURPOSE: Global Redis (ioredis) client provider for the backend.
// SCOPE: REDIS_CLIENT injection token and client factory from validated REDIS_URL.
// DEPENDS: ioredis, @nestjs/config
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RedisModule - global Nest module exporting the shared Redis client
// - REDIS_CLIENT - injection token for the ioredis client
// - createRedisClient - factory building an ioredis client from a Redis URL
// END_MODULE_MAP

import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createRedisClient(config.getOrThrow<string>("REDIS_URL")),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

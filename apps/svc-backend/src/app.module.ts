// START_MODULE_CONTRACT
// PURPOSE: Root NestJS module wiring config, Postgres (TypeORM) and feature modules.
// SCOPE: Global ConfigModule, TypeOrmModule from DATABASE_URL, HealthModule.
// DEPENDS: @nestjs/config, @nestjs/typeorm, health/health.module
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppModule - root application module
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}

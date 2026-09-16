// START_MODULE_CONTRACT
// PURPOSE: Root NestJS module wiring config, Postgres (TypeORM) and feature modules.
// SCOPE: Global ConfigModule, TypeOrmModule from DATABASE_URL, Auth/Users/Health/Places/Events/Bookings modules.
// DEPENDS: @nestjs/config, @nestjs/typeorm, auth/auth.module, health/health.module, places/places.module, events/events.module, bookings/bookings.module
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
import { AuthModule } from "./auth/auth.module";
import { PlacesModule } from "./places/places.module";
import { EventsModule } from "./events/events.module";
import { BookingsModule } from "./bookings/bookings.module";

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
    AuthModule,
    PlacesModule,
    EventsModule,
    BookingsModule,
  ],
})
export class AppModule {}

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
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.get<string>("DATABASE_URL", "postgres://max_events:max_events@localhost:5443/max_events"),
        autoLoadEntities: true,
        // ponytail: synchronize пока схема не устоялась; перейти на миграции перед первым реальным деплоем
        synchronize: true,
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}

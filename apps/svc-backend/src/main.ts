// START_MODULE_CONTRACT
// PURPOSE: Bootstrap the NestJS backend application.
// SCOPE: App creation, global /api prefix, CORS, listen on PORT (default 3100).
// DEPENDS: app.module
// LINKS: M-SVC-BACKEND, V-M-SVC-BACKEND
// MAP_MODE: NONE
// END_MODULE_CONTRACT

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api");
  app.enableCors();
  await app.listen(Number(process.env.PORT ?? 3100));
}

void bootstrap();

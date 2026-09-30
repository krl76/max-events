// START_MODULE_CONTRACT
// PURPOSE: Bootstrap the NestJS backend application.
// SCOPE: App creation, global /api prefix, CORS, listen on PORT (default 3100).
// DEPENDS: app.module
// LINKS: M-SVC-BACKEND, V-M-SVC-BACKEND
// MAP_MODE: NONE
// END_MODULE_CONTRACT

import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory, HttpAdapterHost } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { RequestLoggingFilter } from "./http/request-logging.filter";

async function bootstrap() {
  // Photos travel as data URLs until they are stored. The default 100kb parser rejects them.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(
    json({
      limit: "12mb",
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: "12mb" }));
  app.setGlobalPrefix("api");
  app.enableCors();
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new RequestLoggingFilter(httpAdapter));
  await app.listen(Number(process.env.PORT ?? 3100));
}

void bootstrap();

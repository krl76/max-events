// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the auth feature — AuthService, global AuthGuard, AuthController.
// SCOPE: Registers the global APP_GUARD (all routes protected unless @Public) and auth endpoints.
// DEPENDS: @nestjs/core (APP_GUARD), ../users/users.module, ./auth.service, ./auth.guard, ./auth.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthModule - provides AuthService, AuthController and the global AuthGuard
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}

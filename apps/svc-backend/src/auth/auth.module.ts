// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the auth feature — AuthService, global AuthGuard, AuthController.
// SCOPE: Registers the global APP_GUARD (all routes protected unless @Public) and auth endpoints; registers UserEntity repository for organizer sessions and OrganizationsModule for organizer credentials.
// DEPENDS: @nestjs/core (APP_GUARD), @nestjs/typeorm, ../users/users.module, ../users/user.entity, ../friends/friends.module, ../organizations/organizations.module, ./auth.service, ./auth.guard, ./auth.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthModule - provides AuthService, AuthController and the global AuthGuard
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FriendsModule } from "../friends/friends.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { UserEntity } from "../users/user.entity";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [UsersModule, FriendsModule, OrganizationsModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}

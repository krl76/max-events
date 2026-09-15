// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring the users feature (entity repository + UsersService).
// SCOPE: Registers UserEntity repository and exports UsersService for auth.
// DEPENDS: @nestjs/typeorm, ./user.entity, ./users.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersModule - provides and exports UsersService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { UsersService } from "./users.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

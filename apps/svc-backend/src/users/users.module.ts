// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring users and current-user profiles.
// SCOPE: Registers UserEntity/ProfileEntity, UsersService, ProfilesService and ProfilesController.
// DEPENDS: @nestjs/typeorm, ./user.entity, ./users.service, ./profile.entity, ./profiles.service, ./profiles.controller
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UsersModule - provides UsersService, ProfilesService and ProfilesController
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfileEntity } from "./profile.entity";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { UserEntity } from "./user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProfileEntity])],
  controllers: [ProfilesController, UsersController],
  providers: [UsersService, ProfilesService],
  exports: [UsersService, ProfilesService],
})
export class UsersModule {}

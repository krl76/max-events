// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring Organization accounts for the organizer auth path.
// SCOPE: Registers OrganizationEntity and exports OrganizationsService; no controller of its own.
// DEPENDS: @nestjs/typeorm, ./organization.entity, ./organizations.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationsModule - provides OrganizationsService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationEntity } from "./organization.entity";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity])],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

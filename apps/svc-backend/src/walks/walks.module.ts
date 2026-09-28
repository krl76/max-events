import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AssistModule } from "../assist/assist.module";
import { PlacesModule } from "../places/places.module";
import { CityWalkEntity } from "./city-walk.entity";
import { WalksController } from "./walks.controller";
import { WIKIDATA_LOOKUP, WalksService } from "./walks.service";
import { fetchWikidataCandidates } from "./wikidata-client";

@Module({
  imports: [TypeOrmModule.forFeature([CityWalkEntity]), PlacesModule, AssistModule],
  controllers: [WalksController],
  providers: [WalksService, { provide: WIKIDATA_LOOKUP, useValue: fetchWikidataCandidates }],
}
export class WalksModule {}

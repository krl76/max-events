import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CityWalkEntity } from "./city-walk.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CityWalkEntity])],
})
export class WalksModule {}

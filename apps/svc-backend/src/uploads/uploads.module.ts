import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  controllers: [UploadsController, MediaController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}

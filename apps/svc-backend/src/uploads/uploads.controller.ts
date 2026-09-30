// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for local object storage.
// SCOPE: POST /uploads { purpose } → urls; PUT /uploads/:id { dataUrl }; GET /uploads/:id bytes.
// DEPENDS: @nestjs/common, ./uploads.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UploadsController - presign, put, get
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, StreamableFile } from "@nestjs/common";
import { CurrentUser, Public } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { UploadsService, type UploadPurpose } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @Post()
  presign(@CurrentUser() _user: UserEntity, @Body() body: unknown) {
    const purpose = body !== null && typeof body === "object" ? (body as { purpose?: unknown }).purpose : undefined;
    if (purpose !== "cover" && purpose !== "feed" && purpose !== "review" && purpose !== "story" && purpose !== "wegroup") {
      throw new BadRequestException("Invalid upload payload");
    }
    return this.uploads.presign(purpose as UploadPurpose);
  }

  @Put(":id")
  async put(@CurrentUser() _user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const dataUrl = body !== null && typeof body === "object" ? (body as { dataUrl?: unknown }).dataUrl : undefined;
    if (typeof dataUrl !== "string") throw new BadRequestException("Invalid upload payload");
    const publicUrl = await this.uploads.putDataUrl(id, dataUrl);
    return { publicUrl };
  }

  @Public()
  @Get(":id")
  async get(@Param("id", ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const file = await this.uploads.read(id);
    return new StreamableFile(file.bytes, { type: file.contentType });
  }
}

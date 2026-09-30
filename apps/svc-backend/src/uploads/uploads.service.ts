// START_MODULE_CONTRACT
// PURPOSE: Local object storage — mint an id, accept a data URL, serve the bytes at a public path.
// SCOPE: putDataUrl writes under STORAGE_DIR (default var/uploads); publicUrl is /api/uploads/:id.
// DEPENDS: node:fs/promises, node:path, @nestjs/config
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UploadPurpose - what an upload is for, out of the purposes the service accepts
// - UploadsService - presign, store, read
// END_MODULE_MAP

import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PURPOSES = ["cover", "feed", "review", "story", "wegroup"] as const;
export type UploadPurpose = (typeof PURPOSES)[number];

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  presign(purpose: UploadPurpose): { id: string; uploadUrl: string; publicUrl: string } {
    if (!PURPOSES.includes(purpose)) throw new NotFoundException("Unknown upload purpose");
    const id = randomUUID();
    return { id, uploadUrl: this.urlFor(id), publicUrl: this.urlFor(id) };
  }

  async putDataUrl(id: string, dataUrl: string): Promise<string> {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new NotFoundException("Upload not found");
    const dir = this.dir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, id), Buffer.from(match[2], "base64"));
    await writeFile(join(dir, `${id}.meta`), match[1], "utf8");
    return this.urlFor(id);
  }

  async read(id: string): Promise<{ bytes: Buffer; contentType: string }> {
    try {
      const bytes = await readFile(join(this.dir(), id));
      let contentType = "application/octet-stream";
      try {
        contentType = (await readFile(join(this.dir(), `${id}.meta`), "utf8")).trim() || contentType;
      } catch {
        contentType = "image/jpeg";
      }
      return { bytes, contentType };
    } catch {
      throw new NotFoundException("Upload not found");
    }
  }

  private urlFor(id: string): string {
    // Same-origin path. An absolute URL with the Docker Host header (127.0.0.1:3100)
    // is unreachable from the MAX webview and paints as a broken image.
    return `/api/uploads/${id}`;
  }

  private dir(): string {
    return this.config.get<string>("STORAGE_DIR") ?? join(process.cwd(), "var", "uploads");
  }
}

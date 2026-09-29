import { BadRequestException, Controller, Get, NotFoundException, Param, Query, StreamableFile } from "@nestjs/common";
import { Public } from "../auth/auth.guard";

const SEED = /^[A-Za-z0-9._-]{1,80}$/;
const cache = new Map<string, { type: string; bytes: Buffer }>();

function size(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(64, Math.min(1200, Math.round(value)));
}

/** Same-origin stand-in for picsum.photos. The MAX phone webview does not load that host. */
@Controller("media")
export class MediaController {
  @Public()
  @Get("seed/:seed")
  async seed(@Param("seed") seed: string, @Query("w") w?: string, @Query("h") h?: string): Promise<StreamableFile> {
    if (!SEED.test(seed)) throw new BadRequestException("Invalid photo");
    const width = size(w, 800);
    const height = size(h, 1066);
    const key = `${seed}/${width}/${height}`;
    const hit = cache.get(key);
    if (hit) return new StreamableFile(hit.bytes, { type: hit.type });
    const upstream = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`, { redirect: "follow" });
    if (!upstream.ok) throw new NotFoundException("Photo unavailable");
    const bytes = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (cache.size > 200) cache.clear();
    cache.set(key, { type, bytes });
    return new StreamableFile(bytes, { type });
  }
}

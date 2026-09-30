import { describe, expect, it } from "vitest";
import { UploadsService } from "./uploads.service";

describe("UploadsService", () => {
  it("mints a same-origin public path without a host", () => {
    const service = new UploadsService({ get: () => undefined } as never);
    const ticket = service.presign("feed");
    expect(ticket.publicUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]+$/i);
    expect(ticket.uploadUrl).toBe(ticket.publicUrl);
    expect(ticket.publicUrl.startsWith("http")).toBe(false);
  });
});

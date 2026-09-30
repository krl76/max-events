import { describe, expect, it } from "vitest";
import { pictured, showPhoto } from "./photos";

describe("showPhoto", () => {
  it("rewrites an absolute upload URL onto the same origin", () => {
    expect(showPhoto("https://127.0.0.1:3100/api/uploads/018f3c5a-0000-7000-8000-0000000000aa")).toBe("/api/uploads/018f3c5a-0000-7000-8000-0000000000aa");
    expect(showPhoto("https://events.versacegus.cc/api/uploads/018f3c5a-0000-7000-8000-0000000000aa")).toBe("/api/uploads/018f3c5a-0000-7000-8000-0000000000aa");
    expect(showPhoto("/api/uploads/018f3c5a-0000-7000-8000-0000000000aa")).toBe("/api/uploads/018f3c5a-0000-7000-8000-0000000000aa");
  });

  it("keeps a hosted cover and maps picsum onto the media proxy", () => {
    expect(showPhoto("https://cdn.example/p.jpg")).toBe("https://cdn.example/p.jpg");
    expect(showPhoto("https://picsum.photos/seed/maxevents-abc/800/1066")).toBe("/api/media/seed/maxevents-abc?w=800&h=1066");
    expect(pictured("abc", null)).toBe("/api/media/seed/maxevents-abc?w=800&h=1066");
  });
});

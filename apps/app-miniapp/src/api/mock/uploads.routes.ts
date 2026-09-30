// START_MODULE_CONTRACT
// PURPOSE: Mock route table for POST /api/uploads and PUT /api/uploads/:id — the short https URL profile avatars and covers must store, instead of a JPEG data URL the profile schema rejects.
// SCOPE: Mint an id, accept a data URL, answer a picsum publicUrl the miniapp can paint via showPhoto. Bytes are not served: img tags do not go through this interceptor.
// DEPENDS: ./fixtures.js (parseBookingBody)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - uploadsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { parseBookingBody } from "./fixtures";

const PURPOSES = new Set(["cover", "feed", "review", "story", "wegroup"]);

function publicUrlFor(id: string): string {
  return `https://picsum.photos/seed/maxevents-upload-${id}/800/400`;
}

export function uploadsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/uploads" && init?.method === "POST") {
    const purpose = parseBookingBody(init)?.purpose;
    if (typeof purpose !== "string" || !PURPOSES.has(purpose)) return new Response(null, { status: 400 });
    const id = crypto.randomUUID();
    const publicUrl = publicUrlFor(id);
    return Response.json({ id, publicUrl, uploadUrl: publicUrl });
  }
  const put = /^\/api\/uploads\/([^/]+)$/.exec(url.pathname);
  if (put && init?.method === "PUT") {
    const dataUrl = parseBookingBody(init)?.dataUrl;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return new Response(null, { status: 400 });
    return Response.json({ publicUrl: publicUrlFor(put[1]!) });
  }
  return null;
}

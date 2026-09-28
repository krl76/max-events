import { describe, expect, it } from "vitest";
import { OWN_BASEMAP, STANDARD_BASEMAP } from "./basemaps";
import { VECTOR_CANVAS_ATTRIBUTES, paintableBasemap, webglAvailable } from "./vectorBasemap";

type Probe = { lost: boolean; released: boolean; kind: string | null; attrs: WebGLContextAttributes | null };

function probeDocument(gl: Probe | null, throwOnContext = false): Pick<Document, "createElement"> {
  return {
    createElement: () =>
      ({
        getContext: (kind: string, attrs?: WebGLContextAttributes) => {
          if (throwOnContext) throw new Error("blocked");
          if (gl === null || kind !== "webgl2") return null;
          gl.kind = kind;
          gl.attrs = attrs ?? null;
          return {
            isContextLost: () => gl.lost,
            getExtension: () => ({
              loseContext: () => {
                gl.released = true;
              },
            }),
          };
        },
      }) as unknown as HTMLCanvasElement,
  };
}

describe("webglAvailable", () => {
  it("accepts a live WebGL2 context with the WebView canvas attributes and releases the probe", () => {
    const gl: Probe = { lost: false, released: false, kind: null, attrs: null };
    expect(webglAvailable(probeDocument(gl))).toBe(true);
    expect(gl.kind).toBe("webgl2");
    expect(gl.attrs).toEqual(VECTOR_CANVAS_ATTRIBUTES);
    expect(gl.released).toBe(true);
  });

  it("rejects WebGL1, a lost context, a missing context, and a probe that throws", () => {
    expect(webglAvailable(probeDocument(null))).toBe(false);
    const lost: Probe = { lost: true, released: false, kind: null, attrs: null };
    expect(webglAvailable(probeDocument(lost))).toBe(false);
    expect(lost.released).toBe(true);
    expect(webglAvailable(probeDocument({ lost: false, released: false, kind: null, attrs: null }, true))).toBe(false);
    expect(webglAvailable(undefined)).toBe(false);
  });
});

describe("paintableBasemap", () => {
  it("keeps a vector basemap when WebGL2 is live and a raster basemap either way", () => {
    expect(paintableBasemap(OWN_BASEMAP, STANDARD_BASEMAP, true)).toBe(OWN_BASEMAP);
    expect(paintableBasemap(STANDARD_BASEMAP, OWN_BASEMAP, false)).toBe(STANDARD_BASEMAP);
  });

  it("opens on the raster fallback when the preferred basemap is vector and WebGL2 is dead", () => {
    expect(paintableBasemap(OWN_BASEMAP, STANDARD_BASEMAP, false)).toBe(STANDARD_BASEMAP);
  });
});

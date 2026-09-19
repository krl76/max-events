import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider, useAuth } from "./AuthContext";

function AuthProbe(): ReactNode {
  return <span>status={useAuth().status}</span>;
}

describe("AuthContext", () => {
  it("defaults useAuth to the loading state outside the provider", () => {
    const html = renderToStaticMarkup(<AuthProbe />);

    expect(html).toContain("status=loading");
  });

  it("renders children inside the provider and keeps the pre-resolution loading state", () => {
    const html = renderToStaticMarkup(
      <AuthProvider>
        <AuthProbe />
        <b>child-marker</b>
      </AuthProvider>,
    );

    expect(html).toContain("status=loading");
    expect(html).toContain("child-marker");
  });
});

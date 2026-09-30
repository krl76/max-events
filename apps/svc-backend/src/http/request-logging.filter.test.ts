import { ArgumentsHost, HttpException, Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RequestLoggingFilter } from "./request-logging.filter";

function hostWith(url: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: "GET", url }),
      getResponse: () => ({ status: () => ({ json: () => {} }) }),
    }),
  } as unknown as ArgumentsHost;
}

describe("RequestLoggingFilter", () => {
  it("logs a 5xx with the path and a 4xx as a warning", () => {
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const filter = new RequestLoggingFilter();
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), "catch").mockImplementation(() => {});

    filter.catch(new Error("db down"), hostWith("/api/plans"));
    filter.catch(new HttpException("Invalid plan geo query", 400), hostWith("/api/plans?lat=x"));

    expect(error.mock.calls[0]?.[0]).toContain("GET /api/plans -> 500");
    expect(warn.mock.calls[0]?.[0]).toContain("GET /api/plans?lat=x -> 400");
  });
});

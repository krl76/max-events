import { describe, expect, it } from "vitest";
import { CreateReportWriteSchema, ReportSchema } from "./report.js";

describe("ReportSchema", () => {
  it("defaults status to open", () => {
    const parsed = ReportSchema.parse({
      id: "018f3c5a-0000-7000-8000-000000000090",
      userId: "018f3c5a-0000-7000-8000-000000000001",
      targetType: "event",
      targetId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
      reason: "spam",
      createdAt: "2026-09-12T10:00:00+03:00",
    });
    expect(parsed.status).toBe("open");
  });
});

describe("CreateReportWriteSchema", () => {
  it("accepts an event report reason", () => {
    expect(CreateReportWriteSchema.parse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90", reason: "inaccurate" }).reason).toBe("inaccurate");
  });
});

// START_MODULE_CONTRACT
// PURPOSE: Moderation endpoints of the api client: reporting a target, the moderator spot check, the moderator queue with what its rows are about, and the two irreversible moderator actions.
// SCOPE: GET/POST /reports, POST /reports/spot-check, POST /reports/:id/resolve, GET /moderation/targets, POST /moderation/unpublish, POST /moderation/ban.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REPORT_REASONS - report reason presets
// - ReportReason - union of the report reason presets
// - CreateReport - report submission payload (user + exactly one of event/place/feed post/micro-event + reason); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - Report - report entity (contract shape)
// - ModerationTarget - what a queue row is about: the reported object's title, its author and how many people it already touches (макет, экраны 46 и 47)
// - withModeration - ApiClient.listOpenReports / listModerationTargets / resolveReport / unpublishTarget / banOrganizer / createReport / createSpotCheck
// END_MODULE_MAP

import { ReportSchema } from "@max-events/api-contracts";
import type { Report as ContractReport, ReportTargetType, UnpublishWrite } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Report reason presets offered by the report button. */
export const REPORT_REASONS = ["spam", "abuse", "inaccurate", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Report submission payload: the author, the reported target (exactly one of the four post-moderated objects) and the reason. */
export interface CreateReport {
  userId: string;
  eventId?: string;
  placeId?: string;
  feedPostId?: string;
  microEventId?: string;
  reason: ReportReason;
}

/** Report entity (contract shape: targetType/targetId/status). */
export type Report = ContractReport;

/**
 * What a queue row is about. A Report carries only ids, and the object behind one stops being readable
 * the moment it is unpublished, so the queue is served with its targets resolved rather than each screen
 * chasing four different detail endpoints and losing the answer after the first sanction.
 */
export interface ModerationTarget {
  targetType: ReportTargetType;
  targetId: string;
  title: string;
  subtitle: string | null;
  organizerId: string | null;
  organizerName: string | null;
  /** How many people the object already reaches — bookings for an event, null where nothing counts them. */
  reachCount: number | null;
}

const ModerationTargetArraySchema: ZodSchema<ModerationTarget[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of moderation targets" };
    const rows: ModerationTarget[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "invalid moderation target" };
      const raw = entry as Record<string, unknown>;
      const type = raw.targetType;
      if (type !== "event" && type !== "place" && type !== "feed_post" && type !== "micro_event") return { success: false as const, error: "invalid moderation target type" };
      if (typeof raw.targetId !== "string" || typeof raw.title !== "string") return { success: false as const, error: "invalid moderation target" };
      if (!(raw.subtitle === null || typeof raw.subtitle === "string") || !(raw.organizerId === null || typeof raw.organizerId === "string") || !(raw.organizerName === null || typeof raw.organizerName === "string") || !(raw.reachCount === null || typeof raw.reachCount === "number")) return { success: false as const, error: "invalid moderation target" };
      rows.push({ targetType: type, targetId: raw.targetId, title: raw.title, subtitle: raw.subtitle as string | null, organizerId: raw.organizerId as string | null, organizerName: raw.organizerName as string | null, reachCount: raw.reachCount as number | null });
    }
    return { success: true as const, data: rows };
  },
};

export function withModeration<TBase extends ApiMixin>(Base: TBase) {
  return class ModerationEndpoints extends Base {
    /** Moderator queue: the backend answers 403 unless the viewer is in MODERATOR_MAX_USER_IDS. */
    listOpenReports(): Promise<Report[]> {
      return this.request("/reports?status=open", ReportSchema.array());
    }

    /** The objects the open queue points at, one row per reported object; 403 outside MODERATOR_MAX_USER_IDS. */
    listModerationTargets(): Promise<ModerationTarget[]> {
      return this.request("/moderation/targets", ModerationTargetArraySchema);
    }

    resolveReport(reportId: string): Promise<Report> {
      return this.request(`/reports/${reportId}/resolve`, ReportSchema, { body: {} });
    }

    async unpublishTarget(payload: UnpublishWrite): Promise<void> {
      await this.requestVoid("/moderation/unpublish", { method: "POST", body: payload });
    }

    async banOrganizer(userId: string): Promise<void> {
      await this.requestVoid("/moderation/ban", { method: "POST", body: { userId } });
    }

    createReport(payload: CreateReport): Promise<Report> {
      return this.request("/reports", ReportSchema, { body: payload });
    }

    /** A moderator pulling a publication for review themselves — the second stream of the queue, not a complaint. */
    createSpotCheck(payload: CreateReport): Promise<Report> {
      return this.request("/reports/spot-check", ReportSchema, { body: payload });
    }
  };
}

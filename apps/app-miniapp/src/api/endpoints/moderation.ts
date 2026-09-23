// START_MODULE_CONTRACT
// PURPOSE: Moderation endpoints of the api client: reporting a target, the moderator queue and the two irreversible moderator actions.
// SCOPE: GET/POST /reports, POST /reports/:id/resolve, POST /moderation/unpublish, POST /moderation/ban.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - REPORT_REASONS - report reason presets
// - ReportReason - union of the report reason presets
// - CreateReport - report submission payload (user + exactly one of event/place/feed post + reason); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - Report - report entity (contract shape)
// - withModeration - ApiClient.listOpenReports / resolveReport / unpublishTarget / banOrganizer / createReport
// END_MODULE_MAP

import { ReportSchema } from "@max-events/api-contracts";
import type { Report as ContractReport, UnpublishWrite } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

/** Report reason presets offered by the report button. */
export const REPORT_REASONS = ["spam", "abuse", "inaccurate", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Report submission payload: the author, the reported target (exactly one of event/place/feed post) and the reason. */
export interface CreateReport {
  userId: string;
  eventId?: string;
  placeId?: string;
  feedPostId?: string;
  reason: ReportReason;
}

/** Report entity (contract shape: targetType/targetId/status). */
export type Report = ContractReport;

export function withModeration<TBase extends ApiMixin>(Base: TBase) {
  return class ModerationEndpoints extends Base {
    /** Moderator queue: the backend answers 403 unless the viewer is in MODERATOR_MAX_USER_IDS. */
    listOpenReports(): Promise<Report[]> {
      return this.request("/reports?status=open", ReportSchema.array());
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
  };
}

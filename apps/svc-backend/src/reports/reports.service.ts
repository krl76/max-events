// START_MODULE_CONTRACT
// PURPOSE: Report queue — one open report per user+target, list open reports, resolve.
// SCOPE: create (event/place/feed_post), listOpen, resolve.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportsService - create/listOpen/resolve
// - toReportDto - entity to Report contract
// END_MODULE_MAP

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { ReportSchema, type CreateReportWrite, type Report, type ReportTargetType } from "@max-events/api-contracts";
import { ReportEntity } from "./report.entity";

@Injectable()
export class ReportsService {
  constructor(@InjectRepository(ReportEntity) private readonly reports: Repository<ReportEntity>) {}

  async create(userId: string, payload: CreateReportWrite): Promise<Report> {
    const target = resolveTarget(payload);
    try {
      const saved = await this.reports.save(this.reports.create({ userId, targetType: target.type, targetId: target.id, reason: payload.reason, status: "open" }));
      return toReportDto(saved);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
        throw new ConflictException("Already reported");
      }
      throw error;
    }
  }

  async listOpen(): Promise<Report[]> {
    const rows = await this.reports.find({ where: { status: "open" } });
    return rows.map(toReportDto);
  }

  async resolve(id: string): Promise<Report> {
    const row = await this.reports.findOneBy({ id });
    if (!row) throw new NotFoundException("Report not found");
    row.status = "resolved";
    return toReportDto(await this.reports.save(row));
  }
}

export function toReportDto(row: ReportEntity): Report {
  return ReportSchema.parse({
    id: row.id,
    userId: row.userId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });
}

function resolveTarget(payload: CreateReportWrite): { type: ReportTargetType; id: string } {
  const bits = [payload.eventId ? { type: "event" as const, id: payload.eventId } : null, payload.placeId ? { type: "place" as const, id: payload.placeId } : null, payload.feedPostId ? { type: "feed_post" as const, id: payload.feedPostId } : null].filter((item): item is { type: ReportTargetType; id: string } => item !== null);
  if (bits.length !== 1) throw new ConflictException("Report must target exactly one object");
  return bits[0]!;
}

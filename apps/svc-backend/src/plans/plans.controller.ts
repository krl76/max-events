// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for shared plans — list/get PlanCard, create, invite, respond, delete.
// SCOPE: GET/POST /plans, GET/DELETE /plans/:id, POST /plans/:id/participants, PATCH /plans/:id/participants/me, GET :id/budget, POST :id/expenses.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./plans.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlansController - /plans CRUD and participant actions
// - parseOrigin - optional latitude/longitude pair
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateAutoPlanWriteSchema, CreatePlanExpenseWriteSchema, CreatePlanWriteSchema, IdSchema, PlanParticipantWriteSchema, type AutoPlanProposal, type PlanBudget, type PlanCard } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { PlansService, type GeoOrigin } from "./plans.service";

@Controller("plans")
export class PlansController {
  constructor(@Inject(PlansService) private readonly plans: PlansService) {}

  @Get()
  async list(@CurrentUser() user: UserEntity, @Query() query: Record<string, string | undefined>): Promise<PlanCard[]> {
    return this.plans.list(user.id, parseOrigin(query));
  }

  @Post("auto")
  async autoplan(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<AutoPlanProposal> {
    const parsed = CreateAutoPlanWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid autoplan payload");
    return this.plans.generateAutoplan(user.id, parsed.data.eventId, { latitude: parsed.data.latitude, longitude: parsed.data.longitude });
  }

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<PlanCard> {
    const parsed = CreatePlanWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid plan payload");
    return this.plans.create(user.id, parsed.data);
  }

  @Get(":id/budget")
  budget(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<PlanBudget> {
    return this.plans.getBudget(user.id, id);
  }

  @Post(":id/expenses")
  async addExpense(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PlanBudget> {
    const parsed = CreatePlanExpenseWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid expense payload");
    return this.plans.addExpense(user.id, id, parsed.data);
  }

  @Get(":id")
  async get(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Query() query: Record<string, string | undefined>): Promise<PlanCard> {
    return this.plans.get(user.id, id, parseOrigin(query));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.plans.remove(user.id, id);
  }

  @Post(":id/participants")
  async addParticipant(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PlanCard> {
    const userId = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as { userId?: unknown }).userId : undefined;
    const parsed = IdSchema.safeParse(userId);
    if (!parsed.success) throw new BadRequestException("Invalid plan payload");
    return this.plans.addParticipant(user.id, id, parsed.data);
  }

  @Patch(":id/participants/me")
  async respond(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PlanCard> {
    const parsed = PlanParticipantWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid plan payload");
    return this.plans.respond(user.id, id, parsed.data.status);
  }
}

export function parseOrigin(query: Record<string, string | undefined>): GeoOrigin | null {
  const latRaw = query.lat;
  const lngRaw = query.lng;
  if ((latRaw === undefined || latRaw === "") && (lngRaw === undefined || lngRaw === "")) return null;
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException("Invalid plan geo query");
  }
  return { latitude, longitude };
}

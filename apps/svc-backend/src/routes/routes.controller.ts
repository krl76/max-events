// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for day routes and optimization.
// SCOPE: POST /routes, POST /routes/optimize.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./routes.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RoutesController - build and optimize
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { CreateDayRouteWriteSchema, type DayRoute, type OptimizeRoute } from "@max-events/api-contracts";
import { RoutesService } from "./routes.service";

@Controller("routes")
export class RoutesController {
  constructor(@Inject(RoutesService) private readonly routes: RoutesService) {}

  @Post()
  async build(@Body() body: unknown): Promise<DayRoute> {
    const parsed = CreateDayRouteWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid route payload");
    return this.routes.build(parsed.data);
  }

  @Post("optimize")
  async optimize(@Body() body: unknown): Promise<OptimizeRoute> {
    const parsed = CreateDayRouteWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid route payload");
    return this.routes.optimize(parsed.data);
  }
}

import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.guard";

@Public()
@Controller("health")
export class HealthController {
  @Get("live")
  live() {
    return { status: "ok" };
  }
}

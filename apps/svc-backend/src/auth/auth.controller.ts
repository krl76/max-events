// START_MODULE_CONTRACT
// PURPOSE: Auth endpoints — public login by initData and protected /me returning the current user.
// SCOPE: POST /api/auth/login (public, body { initData }), GET /api/auth/me (guarded by header).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./auth.service, ./auth.guard, ../users/users.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthController - login (public) and me (protected) endpoints
// END_MODULE_MAP

import { Body, Controller, Get, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { AuthRequestSchema, type AuthResponse } from "@max-events/api-contracts";
import { toUserDto } from "../users/users.service";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./auth.guard";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() body: unknown): Promise<AuthResponse> {
    const parsed = AuthRequestSchema.safeParse(body);
    if (!parsed.success) throw new UnauthorizedException("initData is required");
    const user = await this.auth.authenticate(parsed.data.initData);
    if (!user) throw new UnauthorizedException("Invalid MAX initData");
    return { user: toUserDto(user) };
  }

  @Get("me")
  me(@CurrentUser() user: UserEntity): AuthResponse {
    return { user: toUserDto(user) };
  }
}

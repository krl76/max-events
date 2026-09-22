// START_MODULE_CONTRACT
// PURPOSE: Auth endpoints — public login by initData, public organizer login by env credentials (rate limited), protected organizer logout revoking the Bearer session, and protected /me returning the current user.
// SCOPE: POST /api/auth/login (public, body { initData }), POST /api/auth/organizer/login (public, body { login, password } -> Bearer session; 503 when organizer credentials are not configured, 429 after 5 failed attempts for 60s), POST /api/auth/organizer/logout (Bearer-guarded, revokes the session; frontend does not call it yet), GET /api/auth/me (guarded by header).
// DEPENDS: @nestjs/common, @max-events/api-contracts, ./auth.service, ./auth.guard, ../users/users.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthController - login (public), browser-initdata (public, staging-only), organizer login (public, rate limited), organizer logout (Bearer-guarded) and me (protected) endpoints
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Headers, HttpException, HttpStatus, Inject, NotFoundException, Post, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AuthRequestSchema, OrganizerLoginWriteSchema, type AuthResponse, type BrowserInitData, type OrganizerSession } from "@max-events/api-contracts";
import { toUserDto } from "../users/users.service";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";
import { AUTHORIZATION_HEADER, BEARER_PREFIX, CurrentUser, Public } from "./auth.guard";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("browser-initdata")
  browserInitData(): BrowserInitData {
    const initData = this.auth.issueBrowserInitData();
    if (initData === "disabled") throw new NotFoundException();
    return { initData };
  }

  @Public()
  @Post("login")
  async login(@Body() body: unknown): Promise<AuthResponse> {
    const parsed = AuthRequestSchema.safeParse(body);
    if (!parsed.success) throw new UnauthorizedException("initData is required");
    const user = await this.auth.authenticate(parsed.data.initData);
    if (!user) throw new UnauthorizedException("Invalid MAX initData");
    return { user: toUserDto(user) };
  }

  @Public()
  @Post("organizer/login")
  async organizerLogin(@Body() body: unknown): Promise<OrganizerSession> {
    const parsed = OrganizerLoginWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("login and password are required");
    const result = await this.auth.organizerLogin(parsed.data.login, parsed.data.password);
    if (result === "disabled") throw new ServiceUnavailableException("Organizer login is not configured");
    if (result === "locked") throw new HttpException("Too many failed login attempts, try again later", HttpStatus.TOO_MANY_REQUESTS);
    if (!result) throw new UnauthorizedException("Invalid organizer credentials");
    return { token: result.token, organization: { id: result.user.id, name: parsed.data.login, contacts: null } };
  }

  @Post("organizer/logout")
  async organizerLogout(@Headers(AUTHORIZATION_HEADER) authorization?: string): Promise<{ ok: true }> {
    if (authorization?.startsWith(BEARER_PREFIX)) {
      await this.auth.organizerLogout(authorization.slice(BEARER_PREFIX.length));
    }
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: UserEntity): AuthResponse {
    return { user: toUserDto(user) };
  }
}

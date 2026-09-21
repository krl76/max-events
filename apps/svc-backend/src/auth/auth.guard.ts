// START_MODULE_CONTRACT
// PURPOSE: Global auth guard — protects all routes by organizer Bearer token or MAX initData header, unless marked @Public().
// SCOPE: Authorization: Bearer <organizer token> resolves via Redis session to the organizer user; otherwise validates the x-max-init-data header via AuthService, attaches the upserted user to the request; 401 otherwise.
// DEPENDS: @nestjs/common, @nestjs/core, express (types), ./auth.service, ../users/user.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Public - route/class decorator opting out of the global guard (health, login)
// - MAX_INIT_DATA_HEADER - header carrying the raw initData string
// - AUTHORIZATION_HEADER - header carrying the organizer Bearer token
// - AuthenticatedRequest - express Request with the attached currentUser
// - AuthGuard - global guard: Bearer token -> Redis session, else initData -> validate + upsert -> request.currentUser
// - CurrentUser - param decorator extracting request.currentUser
// END_MODULE_MAP

import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";

const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const MAX_INIT_DATA_HEADER = "x-max-init-data";

export const AUTHORIZATION_HEADER = "authorization";

const BEARER_PREFIX = "Bearer ";

export type AuthenticatedRequest = Request & { currentUser: UserEntity };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.header(AUTHORIZATION_HEADER);
    if (authorization?.startsWith(BEARER_PREFIX)) {
      const organizer = await this.auth.authenticateOrganizerToken(authorization.slice(BEARER_PREFIX.length));
      if (organizer) {
        request.currentUser = organizer;
        return true;
      }
      // Unknown/expired token: fall through to the initData path unchanged.
    }

    const initData = request.header(MAX_INIT_DATA_HEADER);
    if (!initData) throw new UnauthorizedException("Missing MAX initData header");

    const user = await this.auth.authenticate(initData);
    if (!user) throw new UnauthorizedException("Invalid MAX initData");

    request.currentUser = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserEntity => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().currentUser;
});

// START_MODULE_CONTRACT
// PURPOSE: Global auth guard — protects all routes by organizer Bearer token or MAX initData header, unless marked @Public().
// SCOPE: @OrganizerOnly requires a valid organizer Bearer session and attaches currentOrganization (no initData fallback); otherwise Bearer resolves to the organizer user or initData validates via AuthService.
// DEPENDS: @nestjs/common, @nestjs/core, express (types), ./auth.service, ../users/user.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Public - route/class decorator opting out of the global guard (health, login)
// - OrganizerOnly - route/class decorator requiring an organizer Bearer session
// - MAX_INIT_DATA_HEADER - header carrying the raw initData string
// - AUTHORIZATION_HEADER - header carrying the organizer Bearer token
// - BEARER_PREFIX - scheme prefix of the organizer Bearer token
// - AuthenticatedRequest - express Request with currentUser and optional currentOrganization
// - AuthGuard - global guard: OrganizerOnly Bearer -> organization; else Bearer or initData -> currentUser
// - CurrentUser - param decorator extracting request.currentUser
// - CurrentOrganization - param decorator extracting request.currentOrganization
// END_MODULE_MAP

import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { OrganizationEntity } from "../organizations/organization.entity";
import { UserEntity } from "../users/user.entity";
import { AuthService } from "./auth.service";

const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

const IS_ORGANIZER_ONLY_KEY = "isOrganizerOnly";
export const OrganizerOnly = () => SetMetadata(IS_ORGANIZER_ONLY_KEY, true);

export const MAX_INIT_DATA_HEADER = "x-max-init-data";

export const AUTHORIZATION_HEADER = "authorization";

export const BEARER_PREFIX = "Bearer ";

export type AuthenticatedRequest = Request & { currentUser: UserEntity; currentOrganization?: OrganizationEntity };

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
    const organizerOnly = this.reflector.getAllAndOverride<boolean>(IS_ORGANIZER_ONLY_KEY, [context.getHandler(), context.getClass()]);
    const authorization = request.header(AUTHORIZATION_HEADER);

    if (organizerOnly) {
      if (!authorization?.startsWith(BEARER_PREFIX)) throw new UnauthorizedException("Missing organizer token");
      const session = await this.auth.authenticateOrganizerSession(authorization.slice(BEARER_PREFIX.length));
      if (!session) throw new UnauthorizedException("Invalid organizer token");
      request.currentUser = session.user;
      request.currentOrganization = session.organization;
      return true;
    }

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

export const CurrentOrganization = createParamDecorator((_data: unknown, context: ExecutionContext): OrganizationEntity => {
  const organization = context.switchToHttp().getRequest<AuthenticatedRequest>().currentOrganization;
  if (!organization) throw new UnauthorizedException("Missing organizer token");
  return organization;
});

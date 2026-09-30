// START_MODULE_CONTRACT
// PURPOSE: Log every HTTP exception the mini-app hits so a failed screen is traceable in docker logs.
// SCOPE: Global Nest filter; 5xx as error with stack, 4xx as warn with method+url. Response shape stays Nest's.
// DEPENDS: @nestjs/common, @nestjs/core
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RequestLoggingFilter - BaseExceptionFilter that logs then delegates
// END_MODULE_MAP

import { ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

@Catch()
export class RequestLoggingFilter extends BaseExceptionFilter {
  private readonly log = new Logger("HTTP");

  override catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const line = `${request?.method ?? "?"} ${request?.url ?? "?"} -> ${status}`;
    if (status >= 500) this.log.error(line, exception instanceof Error ? exception.stack : String(exception));
    else this.log.warn(`${line} ${exception instanceof HttpException ? exception.message : ""}`.trim());
    super.catch(exception, host);
  }
}

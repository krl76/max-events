// START_MODULE_CONTRACT
// PURPOSE: Shared transport of the typed api client: base URL resolution, ApiError, the auth headers and the schema-validating fetch every domain mixin builds on.
// SCOPE: ApiTransport base class and the ApiMixin constructor type; no endpoint lives here — endpoints belong to the per-domain mixins next to this file.
// DEPENDS: fetch (global), import.meta.env
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ZodSchema - minimal structural shape of a zod schema needed to validate responses
// - ApiError - unified API error with HTTP status
// - MethodOptions - per-request HTTP method and JSON body
// - ApiTransport - base class: baseUrl, init-data/organizer headers, request/requestVoid; retries a dropped MAX webview call and refreshes initData on 401
// - ApiMixin - constructor bound the domain mixins extend
// - isEndpointMissing - the server answered 404 to a path that has nothing to miss, i.e. the endpoint is not there yet
// - whenEndpointMissing - rejection handler turning a missing endpoint into a value, leaving every other failure a failure
// END_MODULE_MAP

/** Minimal structural shape of a zod schema needed to validate responses. */
export interface ZodSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

const DEFAULT_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface MethodOptions {
  /** HTTP method for requests without a body (DELETE) or overriding the POST default for body payloads (PATCH/PUT). */
  method?: "DELETE" | "PATCH" | "PUT" | "POST";
  /** JSON body for POST/PATCH requests; serialized and sent as application/json. */
  body?: unknown;
}

const TRANSIENT_STATUSES = new Set([0, 429, 502, 503, 504]);

function liveInitData(): string | null {
  if (typeof window === "undefined") return null;
  const value = (window as Window & { WebApp?: { initData?: string } }).WebApp?.initData?.trim();
  return value ? value : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ApiTransport {
  private initData: string | null = null;
  private organizerToken: string | null = null;

  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  /** Attach (or clear) the raw MAX initData sent as the x-max-init-data header on every request. */
  setInitData(initData: string | null): void {
    this.initData = initData;
  }

  /** Attach (or clear) the organizer bearer token sent as the authorization header on every request. */
  setOrganizerToken(token: string | null): void {
    this.organizerToken = token;
  }

  /** For an endpoint that answers 204: there is no body to validate, only a status to respect. */
  protected requestVoid(path: string, options: MethodOptions = {}): Promise<void> {
    return this.withRetry(path, async () => {
      const response = await this.send(path, { ...options, method: options.method ?? "POST" });
      if (!response.ok) throw new ApiError(response.status, `API ${path} failed with ${response.status}`);
    });
  }

  protected request<T>(path: string, schema: ZodSchema<T>, options: MethodOptions = {}): Promise<T> {
    return this.withRetry(path, async () => {
      const response = await this.send(path, options);
      if (!response.ok) throw new ApiError(response.status, `API ${path} failed with ${response.status}`);
      const data: unknown = await response.json().catch(() => undefined);
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        throw new ApiError(response.status, `API ${path} returned invalid payload`);
      }
      return parsed.data;
    });
  }

  private headers(options: MethodOptions): Record<string, string> {
    const live = liveInitData();
    if (live) this.initData = live;
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.initData !== null) headers["x-max-init-data"] = this.initData;
    if (this.organizerToken !== null) headers["authorization"] = `Bearer ${this.organizerToken}`;
    if (options.body !== undefined) headers["content-type"] = "application/json";
    return headers;
  }

  private async send(path: string, options: MethodOptions): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers: this.headers(options),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ApiError(0, `network error while fetching ${path}`);
    }
  }

  private async withRetry<T>(path: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 401) {
        const fresh = liveInitData();
        if (fresh && fresh !== this.initData) {
          this.initData = fresh;
          return run();
        }
      }
      if (TRANSIENT_STATUSES.has(error.status)) {
        await sleep(200);
        return run();
      }
      throw error;
    }
  }
}

/**
 * Whether the request failed because the server has no such endpoint. Nest answers 404 both for «нет
 * такого маршрута» and for «нет такой записи», so this only tells the two apart on a path that names
 * no entity — `/notifications/summary`, `/calendar/shared`, `/feed/cards`. Callers use it to keep the
 * two apart in the interface: a block the server cannot answer at all disappears, a block whose
 * request merely failed says so.
 */
export function isEndpointMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Rejection handler for a request the screen can do without: an endpoint the backend does not have
 * becomes the given value, anything else still rejects, so a real failure is not dressed up as an
 * empty answer.
 */
export function whenEndpointMissing<T>(value: T): (error: unknown) => T {
  return (error: unknown) => {
    if (isEndpointMissing(error)) return value;
    throw error;
  };
}

/** Constructor bound every domain mixin extends; the any[] rest is what TypeScript requires of a mixin base. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiMixin = new (...args: any[]) => ApiTransport;

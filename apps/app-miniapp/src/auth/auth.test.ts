import { describe, expect, it, vi } from "vitest";
import { authenticate, type LoginFn } from "./auth";
const okLogin: LoginFn = async () => ({
  user: {
    id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    maxUserId: "1001",
    firstName: "Иван",
    lastName: null,
    avatarUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
});

describe("authenticate", () => {
  it("authenticates inside MAX and stores the user", async () => {
    const state = await authenticate({ initData: "user=%7B%22id%22%3A1%7D" }, okLogin);
    expect(state).toEqual({
      status: "authenticated",
      user: {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        maxUserId: "1001",
        firstName: "Иван",
        lastName: null,
        avatarUrl: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("is unavailable outside MAX without calling login", async () => {
    const login = vi.fn(okLogin);
    const state = await authenticate(null, login);
    expect(state).toEqual({ status: "unavailable" });
    expect(login).not.toHaveBeenCalled();
  });

  it("surfaces a server error with its message", async () => {
    const login: LoginFn = async () => {
      throw new Error("API /auth/login failed with 500");
    };
    const state = await authenticate({ initData: "x" }, login);
    expect(state).toEqual({ status: "error", message: "API /auth/login failed with 500" });
  });

  it("is unavailable when initData is empty", async () => {
    const state = await authenticate({ initData: "" }, okLogin);
    expect(state).toEqual({ status: "unavailable" });
  });
});

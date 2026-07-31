import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { isAdminSdkConfigured } from "./googleAdmin";
import type { TrpcContext } from "./_core/context";

function createContext(user: NonNullable<TrpcContext["user"]> | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Google Admin router", () => {
  it("isConfigured returns false when env vars are empty", () => {
    expect(isAdminSdkConfigured()).toBe(false);
  });

  it("google.isConfigured returns { configured: false } in test env", async () => {
    const caller = appRouter.createCaller(createContext(null));
    const result = await caller.google.isConfigured();
    expect(result).toEqual({ configured: false });
  });

  it("verifyMembership returns { isMember:false, error } when not configured", async () => {
    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "u1",
        email: "test@example.com",
        name: "T",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );
    const result = await caller.google.verifyMembership({
      groupEmail: "testers@googlegroups.com",
    });
    expect(result.isMember).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("verifyMembership accepts userEmail override", async () => {
    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "u1",
        email: "auth@example.com",
        name: "T",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );
    const result = await caller.google.verifyMembership({
      groupEmail: "g@example.com",
      userEmail: "override@example.com",
    });
    expect(result.isMember).toBe(false);
  });
});

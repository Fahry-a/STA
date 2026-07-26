/**
 * Tests for environment validation
 */

import { validateEnvironment } from "../../src/lib/env";

describe("Environment Module", () => {
  it("should return empty array when all bindings are present", () => {
    const env = createMockEnv();
    const errors = validateEnvironment(env);
    expect(errors).toEqual([]);
  });

  it("should return error when CACHE_KV is missing", () => {
    const env = createMockEnv();
    delete (env as any).CACHE_KV;
    const errors = validateEnvironment(env);
    expect(errors).toContain("CACHE_KV binding is required");
  });

  it("should return error when RATE_LIMIT_KV is missing", () => {
    const env = createMockEnv();
    delete (env as any).RATE_LIMIT_KV;
    const errors = validateEnvironment(env);
    expect(errors).toContain("RATE_LIMIT_KV binding is required");
  });

  it("should return both errors when both KV bindings are missing", () => {
    const env = createMockEnv();
    delete (env as any).CACHE_KV;
    delete (env as any).RATE_LIMIT_KV;
    const errors = validateEnvironment(env);
    expect(errors).toHaveLength(2);
  });

  it("should not require PROXY_URLS", () => {
    const env = createMockEnv();
    delete (env as any).PROXY_URLS;
    const errors = validateEnvironment(env);
    expect(errors).toEqual([]);
  });
});

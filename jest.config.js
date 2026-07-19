module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          // Match the runtime: Node 18+/Cloudflare Workers run modern JS,
          // so only transpile TS syntax, not ES2020 features.
          target: "es2020",
          parser: {
            syntax: "typescript",
            // Isolated modules: @swc/jest transpiles each file in isolation
            // (like ts-jest with isolatedModules), so `export const enum`
            // is unsafe. The repo uses no enums, so this is a safe, fast path.
            tsx: false,
            decorators: false,
            dynamicImport: false,
          },
          transform: {
            legacyDecorator: false,
          },
        },
        module: {
          // CommonJS so jest.mock("../src/lib", ...) hoists and resolves
          // the same way it did under ts-jest's commonjs module setting.
          type: "commonjs",
        },
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testTimeout: 30000,
};

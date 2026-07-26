/**
 * Tests for structured logging module
 */

import {
  generateRequestId,
  createLogEntry,
  writeLog,
  logger,
} from "../../src/lib/logger";

describe("Logger Module", () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();
  });

  describe("generateRequestId", () => {
    it("should generate a string ID", () => {
      const id = generateRequestId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it("should contain timestamp and random component", () => {
      const id = generateRequestId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe("createLogEntry", () => {
    it("should create a log entry with required fields", () => {
      const entry = createLogEntry("info", "test message");

      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test message");
      expect(entry.timestamp).toBeDefined();
      expect(typeof entry.timestamp).toBe("string");
    });

    it("should include optional context fields", () => {
      const entry = createLogEntry("warn", "warning message", {
        requestId: "req-123",
        endpoint: "/translate",
        clientIP: "192.168.1.1",
        duration: 150,
        cacheHit: true,
      });

      expect(entry.requestId).toBe("req-123");
      expect(entry.endpoint).toBe("/translate");
      expect(entry.clientIP).toBe("192.168.1.1");
      expect(entry.duration).toBe(150);
      expect(entry.cacheHit).toBe(true);
    });

    it("should create valid ISO timestamp", () => {
      const entry = createLogEntry("error", "error occurred");
      const date = new Date(entry.timestamp);
      expect(date.toISOString()).toBe(entry.timestamp);
    });
  });

  describe("writeLog", () => {
    it("should write to console based on log level", () => {
      const entry = createLogEntry("info", "info message");
      writeLog(mockEnv, entry);

      expect(console.log).toHaveBeenCalled();
    });

    it("should use console.error for error level", () => {
      const entry = createLogEntry("error", "error message");
      writeLog(mockEnv, entry);

      expect(console.error).toHaveBeenCalled();
    });

    it("should use console.warn for warn level", () => {
      const entry = createLogEntry("warn", "warn message");
      writeLog(mockEnv, entry);

      expect(console.warn).toHaveBeenCalled();
    });

    it("should write to Analytics Engine when available", () => {
      const entry = createLogEntry("info", "analytics test", {
        duration: 100,
        cacheHit: true,
      });
      writeLog(mockEnv, entry);

      expect(mockEnv.ANALYTICS.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          blobs: expect.arrayContaining([
            entry.timestamp,
            "info",
            "analytics test",
          ]),
          doubles: expect.arrayContaining([100, 1]),
        })
      );
    });

    it("should handle missing Analytics Engine gracefully", () => {
      const envNoAnalytics = { ...mockEnv, ANALYTICS: undefined } as any;
      const entry = createLogEntry("info", "no analytics");
      expect(() => writeLog(envNoAnalytics, entry)).not.toThrow();
    });

    it("should catch and log Analytics write errors (line 81)", () => {
      (mockEnv.ANALYTICS.writeDataPoint as jest.Mock).mockImplementation(
        () => {
          throw new Error("Analytics engine unavailable");
        }
      );

      const entry = createLogEntry("info", "test analytics failure");
      writeLog(mockEnv, entry);

      expect(console.error).toHaveBeenCalledWith(
        "Analytics write failed:",
        expect.objectContaining({ message: "Analytics engine unavailable" })
      );
    });

    it("should still write to console even when Analytics throws", () => {
      (mockEnv.ANALYTICS.writeDataPoint as jest.Mock).mockImplementation(
        () => {
          throw new Error("Analytics write failed");
        }
      );

      jest.clearAllMocks();
      const entry = createLogEntry("warn", "test warning with analytics failure");
      writeLog(mockEnv, entry);

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("logger", () => {
    it("should have info, warn, error, debug methods", () => {
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("logger.info should create and write an info entry", () => {
      logger.info(mockEnv, "test info", { requestId: "123" });
      expect(console.log).toHaveBeenCalled();
    });

    it("logger.warn should create and write a warn entry", () => {
      logger.warn(mockEnv, "test warn");
      expect(console.warn).toHaveBeenCalled();
    });

    it("logger.error should create and write an error entry", () => {
      logger.error(mockEnv, "test error");
      expect(console.error).toHaveBeenCalled();
    });

    it("logger.debug should create and write a debug entry", () => {
      logger.debug(mockEnv, "test debug");
      expect(console.log).toHaveBeenCalled();
    });

    it("logger should include metadata in log entries", () => {
      logger.info(mockEnv, "with metadata", {
        metadata: { key: "value", nested: { a: 1 } },
      });
      expect(console.log).toHaveBeenCalled();
    });

    it("logger should handle undefined env", () => {
      expect(() => logger.info(undefined, "no env")).not.toThrow();
    });
  });
});

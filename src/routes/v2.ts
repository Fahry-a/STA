/**
 * V2 batch translation route handler
 */

import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  PAYLOAD_LIMITS,
  getSecureClientIP,
  validateV2Request,
  getV2ItemChargeCount,
  checkCombinedRateLimit,
  createV2Response,
  translateBatch,
} from "../lib";
import { createErrorResponse } from "../lib/errorHandler";
import type { V2RequestParams } from "../lib/types";
import type { V2ValidationResult } from "../lib/v2Validation";

type V2Context = {
  env: Env;
  req: {
    json: () => Promise<unknown>;
    header: (name: string) => string | undefined;
    raw: Request;
  };
  json: (data: unknown, status?: number) => Response;
};

/**
 * V2 Batch Translation endpoint handler
 * POST /v2/translate - Batch translation with APR (Array Per Request) support
 */
export async function handleV2Translation(c: V2Context) {
  const env = c.env;
  const clientIP = getSecureClientIP(c.req.raw) || "unknown";

  // Validate Content-Type header
  const contentType = c.req.header("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return c.json(createV2Response(415, [], { apr: false }), 415);
  }

  // Check Content-Length at middleware level
  const contentLength = c.req.header("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > PAYLOAD_LIMITS.MAX_REQUEST_SIZE) {
    return c.json(createV2Response(413, [], { apr: false }), 413);
  }

  let validation: V2ValidationResult | undefined;

  try {
    // Parse request body
    let params: Record<string, unknown>;
    try {
      params = (await c.req.json()) as Record<string, unknown>;
    } catch (parseError) {
      return c.json(createV2Response(400, [], { apr: false }), 400);
    }

    // Validate early so we know how many items the batch will produce before
    // we spend any rate-limit tokens.
    validation = validateV2Request(params);
    if (!validation.isValid) {
      return c.json(
        createV2Response(400, [], {
          apr: validation.sanitizedInput?.APR ?? false,
        }),
        400
      );
    }

    // Rate-limit charging that matches the actual upstream cost.
    const charges = getV2ItemChargeCount(validation);
    const validatedApr = validation.sanitizedInput!.APR;

    for (let i = 0; i < charges; i++) {
      const rateLimitResult = await checkCombinedRateLimit(
        clientIP,
        "deepl",
        env
      );

      if (!rateLimitResult.allowed) {
        return c.json(createV2Response(429, [], { apr: validatedApr }), 429);
      }
    }

    // Translate batch
    const result = await translateBatch(validation.sanitizedInput as V2RequestParams, {
      env,
      clientIP,
    });

    return c.json(result, result.code as ContentfulStatusCode);
  } catch (error) {
    const errorResponse = createErrorResponse(error, {
      endpoint: "/v2/translate",
      clientIP,
    });

    return c.json(
      createV2Response(errorResponse.httpStatus, [], {
        apr: validation?.sanitizedInput?.APR ?? false,
      }),
      errorResponse.httpStatus as ContentfulStatusCode
    );
  }
}

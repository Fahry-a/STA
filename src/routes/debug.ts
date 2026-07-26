/**
 * Debug route handler
 */

import { getSecureClientIP, validateLanguageCode, createStandardResponse } from "../lib";

type DebugContext = {
  env: Env;
  req: {
    json: () => Promise<unknown>;
    header: (name: string) => string | undefined;
    raw: Request;
  };
  json: (data: unknown, status?: number) => Response;
};

function isDebugModeEnabled(value?: string): boolean {
  if (!value) {
    return false;
  }
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Debug endpoint for request format validation and troubleshooting
 * SECURITY: This endpoint is disabled in production unless DEBUG_MODE is explicitly enabled
 * POST /debug
 */
export async function handleDebug(c: DebugContext) {
  if (!isDebugModeEnabled(c.env.DEBUG_MODE)) {
    return c.json(createStandardResponse(404, null), 404);
  }

  try {
    const params = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

    // Import buildRequestBody from query module for debugging
    const { buildRequestBody } = await import("../lib/query");

    if (!params.text || typeof params.text !== "string") {
      return c.json(
        createStandardResponse(400, "Missing text parameter"),
        400
      );
    }

    // Basic text validation
    const sanitizedText = params.text;
    if (!sanitizedText.trim()) {
      return c.json(
        createStandardResponse(400, "Invalid text parameter"),
        400
      );
    }

    // Validate language codes
    const sourceLang = params.source_lang
      ? validateLanguageCode(params.source_lang as string)
      : "auto";
    const targetLang = params.target_lang
      ? validateLanguageCode(params.target_lang as string)
      : "en";

    if (!sourceLang || !targetLang) {
      return c.json(
        createStandardResponse(400, "Invalid language codes"),
        400
      );
    }

    const sanitizedParams = {
      text: sanitizedText,
      source_lang: sourceLang,
      target_lang: targetLang,
    };

    try {
      const requestBody = buildRequestBody(sanitizedParams);
      const parsedBody = JSON.parse(requestBody);

      const debugInfo = {
        status: "Request format is valid",
        validation: {
          text_length: sanitizedText.length,
          has_source_lang: !!sourceLang,
          has_target_lang: !!targetLang,
          request_id: parsedBody.id,
          has_timestamp: typeof parsedBody.params?.timestamp === "number",
          method_format: requestBody.includes('"method" : "')
            ? "spaced"
            : "normal",
          normalized_source_lang: sourceLang,
          normalized_target_lang: targetLang,
        },
      };

      return c.json(
        createStandardResponse(200, JSON.stringify(debugInfo)),
        200
      );
    } catch (buildError) {
      const errorMessage =
        buildError instanceof Error
          ? buildError.message
          : "Request build failed";
      return c.json(createStandardResponse(400, errorMessage), 400);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return c.json(createStandardResponse(400, errorMessage), 400);
  }
}

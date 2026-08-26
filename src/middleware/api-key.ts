import { NextFunction, Request, Response } from "express";

function readApiKeyFromBody(body: unknown) {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as { apiKey?: unknown };
      return typeof parsed.apiKey === "string" ? parsed.apiKey : undefined;
    } catch {
      return undefined;
    }
  }

  if (body && typeof body === "object" && "apiKey" in body) {
    const apiKey = (body as { apiKey?: unknown }).apiKey;
    return typeof apiKey === "string" ? apiKey : undefined;
  }

  return undefined;
}

function readReceivedApiKey(req: Request) {
  const headerApiKey = req.header("x-api-key");
  const authorization = req.header("authorization");
  const bearerApiKey = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const queryApiKey = typeof req.query.apiKey === "string" ? req.query.apiKey : undefined;

  return headerApiKey ?? bearerApiKey ?? queryApiKey ?? readApiKeyFromBody(req.body);
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configuredApiKey = process.env.API_KEY;
  const receivedApiKey = readReceivedApiKey(req);

  console.log("API Key debug", {
    method: req.method,
    path: req.path,
    hasConfiguredApiKey: Boolean(configuredApiKey),
    hasReceivedApiKey: Boolean(receivedApiKey),
    receivedApiKeyLength: receivedApiKey?.length ?? 0,
    headerNames: Object.keys(req.headers)
  });

  if (!configuredApiKey) {
    return res.status(500).json({
      success: false,
      error: "API_KEY_NOT_CONFIGURED"
    });
  }

  if (receivedApiKey !== configuredApiKey) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED"
    });
  }

  return next();
}

import express, { Request, Response } from "express";
import { facturaRequestSchema, formatValidationError } from "./facturas/factura.schema";
import {
  buscarFacturaPorVenta,
  crearFacturaSimulada,
  FacturaServiceError
} from "./facturas/factura.service";
import { crearPreviewFactura } from "./facturas/factura-preview.service";
import { emitirFacturaHomologacion, FacturaEmisionError } from "./facturas/factura-emision.service";
import { generarQrFacturaPng } from "./facturas/factura-qr.service";
import { requireApiKey } from "./middleware/api-key";

function maskSensitiveBody(body: unknown) {
  if (typeof body === "string") {
    return body.replace(/"apiKey"\s*:\s*"[^"]*"/g, '"apiKey":"***"');
  }

  if (body && typeof body === "object") {
    return {
      ...(body as Record<string, unknown>),
      apiKey: "apiKey" in body ? "***" : undefined
    };
  }

  return body;
}

function parseRequestBody(body: unknown) {
  if (typeof body !== "string") {
    return { success: true as const, body };
  }

  try {
    return { success: true as const, body: JSON.parse(body) as unknown };
  } catch {
    return { success: false as const };
  }
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.text({ type: ["text/xml", "text/plain", "application/octet-stream"], limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1", requireApiKey);

  app.get("/api/v1/facturas/:origen/:idVenta", async (req: Request, res: Response) => {
    const empresa = typeof req.query.empresa === "string" ? req.query.empresa : "PETSHOP";
    const factura = await buscarFacturaPorVenta({
      empresa,
      origen: req.params.origen,
      idVenta: req.params.idVenta
    });

    if (!factura) {
      return res.status(404).json({
        success: false,
        error: "FACTURA_NOT_FOUND"
      });
    }

    return res.json({
      ...factura,
      idempotente: true
    });
  });

  app.get("/api/v1/facturas/:origen/:idVenta/qr.png", async (req: Request, res: Response) => {
    const empresa = typeof req.query.empresa === "string" ? req.query.empresa : "PETSHOP";
    const png = await generarQrFacturaPng({
      empresa,
      origen: req.params.origen,
      idVenta: req.params.idVenta
    });

    if (!png) {
      return res.status(404).json({
        success: false,
        error: "QR_NOT_FOUND"
      });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.send(png);
  });

  app.post("/api/v1/facturas/preview", (req: Request, res: Response) => {
    const body = parseRequestBody(req.body);

    if (!body.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_JSON_BODY"
      });
    }

    const parsed = facturaRequestSchema.safeParse(body.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details: formatValidationError(parsed.error)
      });
    }

    const preview = crearPreviewFactura(parsed.data);

    console.log("POST /api/v1/facturas/preview result", {
      success: preview.success,
      idVenta: preview.idVenta,
      puntoVenta: preview.normalizado.puntoVenta,
      codigoTipoComprobante: preview.normalizado.codigoTipoComprobante,
      fecha: preview.normalizado.fecha,
      importeNeto: preview.normalizado.importes.importeNeto,
      importeIva: preview.normalizado.importes.importeIva,
      importeTotal: preview.normalizado.importes.importeTotal,
      sumaItems: preview.normalizado.importes.sumaItems,
      errores: preview.validaciones.errores,
      advertencias: preview.validaciones.advertencias
    });

    return res.status(preview.success ? 200 : 422).json(preview);
  });

  app.post("/api/v1/facturas/emitir", async (req: Request, res: Response) => {
    const body = parseRequestBody(req.body);

    if (!body.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_JSON_BODY"
      });
    }

    const parsed = facturaRequestSchema.safeParse(body.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details: formatValidationError(parsed.error)
      });
    }

    try {
      const result = await emitirFacturaHomologacion(parsed.data);
      return res.status(result.statusCode).json(result.body);
    } catch (error) {
      if (error instanceof FacturaEmisionError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.errorCode,
          message: error.message
        });
      }

      console.error("Error inesperado en POST /api/v1/facturas/emitir", error);

      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR"
      });
    }
  });

  app.post("/api/v1/facturas", async (req: Request, res: Response) => {
    const debugHeaders = { ...req.headers };

    if (debugHeaders["x-api-key"]) {
      debugHeaders["x-api-key"] = "***";
    }

    console.log("POST /api/v1/facturas debug", {
      method: req.method,
      headers: debugHeaders,
      contentType: req.headers["content-type"],
      body: maskSensitiveBody(req.body),
      bodyType: typeof req.body
    });

    const body = parseRequestBody(req.body);

    if (!body.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_JSON_BODY"
      });
    }

    const parsed = facturaRequestSchema.safeParse(body.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        details: formatValidationError(parsed.error)
      });
    }

    try {
      const result = await crearFacturaSimulada(parsed.data);
      return res.status(result.statusCode).json(result.body);
    } catch (error) {
      if (!(error instanceof FacturaServiceError)) {
        console.error("Error inesperado en POST /api/v1/facturas", error);
      }

      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR"
      });
    }
  });

  return app;
}

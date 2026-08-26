import { Prisma } from "@prisma/client";
import { loadArcaConfig } from "../arca/arca.config";
import { getWsaaLoginTicket } from "../arca/wsaa";
import {
  buildWsfeAuth,
  WsfeCaeRequest,
  wsfeSolicitarCae,
  wsfeUltimoComprobanteAutorizado
} from "../arca/wsfe";
import { prisma } from "../prisma";
import { crearPreviewFactura } from "./factura-preview.service";
import { FacturaRequest } from "./factura.schema";

export class FacturaEmisionError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string) {
    super(message);
    this.name = "FacturaEmisionError";
  }
}

function toJsonObject<T>(value: T) {
  return value as Prisma.InputJsonObject;
}

function buildIdempotencyKey(payload: FacturaRequest) {
  return `${payload.empresa}:${payload.origen}:${payload.idVenta}`;
}

function normalizeAfipDate(value: string | undefined) {
  if (!value || !/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function findFacturaByKey(idempotencyKey: string) {
  return prisma.factura.findUnique({
    where: { idempotencyKey }
  });
}

function buildClarionResponseFromFactura(factura: NonNullable<Awaited<ReturnType<typeof findFacturaByKey>>>) {
  const response = factura.responseJson as Record<string, unknown>;

  if (response.clarion) {
    return response;
  }

  return {
    ...response,
    clarion: {
      ID_NotaP: factura.idVenta,
      CodigoTipoComprobante: factura.codigoTipoComprobante,
      NumeroPuntoVenta: factura.puntoVenta,
      NumeroComprobante: factura.numeroComprobante,
      FechaEmision: factura.fecha,
      CodigoTipoDocumento: factura.codigoTipoDocumento,
      NumeroDocumento: factura.numeroDocumento,
      ImporteGravado: Number(factura.importeGravado),
      ImporteNoGravado: 0,
      ImporteExento: 0,
      ImporteIva: Number(factura.importeIva),
      ImporteSubTotal: Number(factura.importeGravado),
      ImporteOtrosTributos: 0,
      ImporteTotal: Number(factura.importeTotal),
      CodigoMoneda: "PES",
      CotizacionMoneda: 1,
      CodigoConcepto: 1,
      Resultado: factura.resultado,
      CAE: factura.cae,
      FechaVencimientoCAE: factura.fechaVencimientoCae
    }
  };
}

export async function emitirFacturaHomologacion(payload: FacturaRequest) {
  if (process.env.ARCA_EMISION_HABILITADA !== "true") {
    throw new FacturaEmisionError(403, "EMISION_DISABLED", "La emision ARCA no esta habilitada.");
  }

  const config = loadArcaConfig();

  if (config.production) {
    throw new FacturaEmisionError(403, "PRODUCTION_EMISSION_BLOCKED", "Este endpoint solo permite emitir en homologacion.");
  }

  const idempotencyKey = buildIdempotencyKey(payload);
  const facturaExistente = await findFacturaByKey(idempotencyKey);

  if (facturaExistente) {
    if (facturaExistente.estado !== "AUTORIZADA_HOMOLOGACION") {
      throw new FacturaEmisionError(409, "FACTURA_ALREADY_REGISTERED", "La venta ya existe en la API pero no como factura autorizada de homologacion.");
    }

    return {
      statusCode: 200,
      body: {
        ...buildClarionResponseFromFactura(facturaExistente),
        idempotente: true
      }
    };
  }

  const previewInicial = crearPreviewFactura(payload);

  if (!previewInicial.success) {
    throw new FacturaEmisionError(422, "PREVIEW_VALIDATION_ERROR", "La factura no supera las validaciones de preview.");
  }

  const { ticket } = await getWsaaLoginTicket(config, "wsfe");
  const auth = buildWsfeAuth(config, ticket);
  const ultimo = await wsfeUltimoComprobanteAutorizado(config, auth, {
    puntoVenta: previewInicial.normalizado.puntoVenta,
    tipoComprobante: payload.comprobante.codigoTipoComprobante
  });

  if (ultimo.errors.length > 0) {
    throw new FacturaEmisionError(422, "ULTIMO_COMPROBANTE_ERROR", JSON.stringify(ultimo.errors));
  }

  const numeroComprobante = (ultimo.comprobanteNumero ?? 0) + 1;
  const preview = crearPreviewFactura(payload, { numeroComprobante });
  const caeRequest = preview.arca as WsfeCaeRequest;
  const caeResponse = await wsfeSolicitarCae(config, auth, caeRequest);

  if (caeResponse.errors.length > 0 || caeResponse.resultado !== "A" || !caeResponse.cae) {
    return {
      statusCode: 422,
      body: {
      success: false,
      error: "ARCA_REJECTED",
      idVenta: payload.idVenta,
      resultado: caeResponse.resultado,
      errores: caeResponse.errors,
      observaciones: caeResponse.observaciones
      }
    };
  }

  const responseJson = {
    success: true,
    idVenta: payload.idVenta,
    comprobante: {
      codigoTipoComprobante: payload.comprobante.codigoTipoComprobante,
      tipo: payload.comprobante.tipo ?? `TIPO_${payload.comprobante.codigoTipoComprobante}`,
      puntoVenta: preview.normalizado.puntoVenta,
      numero: caeResponse.comprobanteDesde ?? numeroComprobante,
      fechaEmision: preview.normalizado.fecha,
      codigoTipoDocumento: payload.cliente.tipoDocumento,
      numeroDocumento: payload.cliente.numeroDocumento,
      importeGravado: preview.normalizado.importes.importeNeto,
      importeIva: preview.normalizado.importes.importeIva,
      importeTotal: preview.normalizado.importes.importeTotal,
      cae: caeResponse.cae,
      fechaVencimientoCae: normalizeAfipDate(caeResponse.caeFechaVencimiento),
      resultado: caeResponse.resultado
    },
    clarion: {
      ID_NotaP: payload.idVenta,
      CodigoTipoComprobante: payload.comprobante.codigoTipoComprobante,
      NumeroPuntoVenta: preview.normalizado.puntoVenta,
      NumeroComprobante: caeResponse.comprobanteDesde ?? numeroComprobante,
      FechaEmision: preview.normalizado.fecha,
      CodigoTipoDocumento: payload.cliente.tipoDocumento,
      NumeroDocumento: payload.cliente.numeroDocumento,
      ImporteGravado: preview.normalizado.importes.importeNeto,
      ImporteNoGravado: 0,
      ImporteExento: 0,
      ImporteIva: preview.normalizado.importes.importeIva,
      ImporteSubTotal: preview.normalizado.importes.importeNeto,
      ImporteOtrosTributos: 0,
      ImporteTotal: preview.normalizado.importes.importeTotal,
      CodigoMoneda: "PES",
      CotizacionMoneda: 1,
      CodigoConcepto: 1,
      Resultado: caeResponse.resultado,
      CAE: caeResponse.cae,
      FechaVencimientoCAE: normalizeAfipDate(caeResponse.caeFechaVencimiento)
    },
    observaciones: caeResponse.observaciones
  };

  try {
    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.upsert({
        where: { codigo: payload.empresa },
        update: {
          puntoVenta: preview.normalizado.puntoVenta,
          ambienteArca: "HOMOLOGACION"
        },
        create: {
          codigo: payload.empresa,
          nombre: payload.empresa,
          puntoVenta: preview.normalizado.puntoVenta,
          ambienteArca: "HOMOLOGACION"
        }
      });

      const factura = await tx.factura.create({
        data: {
          empresaId: empresa.id,
          origen: payload.origen,
          idVenta: String(payload.idVenta),
          fecha: preview.normalizado.fecha,
          estado: "AUTORIZADA_HOMOLOGACION",
          idempotencyKey,
          codigoTipoComprobante: payload.comprobante.codigoTipoComprobante,
          tipoComprobante: responseJson.comprobante.tipo,
          puntoVenta: responseJson.comprobante.puntoVenta,
          numeroComprobante: responseJson.comprobante.numero,
          codigoTipoDocumento: responseJson.comprobante.codigoTipoDocumento,
          numeroDocumento: responseJson.comprobante.numeroDocumento,
          importeGravado: responseJson.comprobante.importeGravado,
          importeIva: responseJson.comprobante.importeIva,
          importeTotal: responseJson.comprobante.importeTotal,
          cae: responseJson.comprobante.cae,
          fechaVencimientoCae: responseJson.comprobante.fechaVencimientoCae ?? "",
          resultado: responseJson.comprobante.resultado ?? "A",
          payloadOriginal: toJsonObject(payload),
          responseJson: toJsonObject(responseJson),
          items: {
            create: preview.normalizado.items.map((item) => ({
              renglon: item.renglon,
              idProducto: item.idProducto === undefined ? undefined : String(item.idProducto),
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitarioConIva,
              alicuotaIva: item.alicuotaIva,
              importeTotal: item.importeTotal
            }))
          }
        }
      });

      await tx.arcaRequest.create({
        data: {
          facturaId: factura.id,
          servicio: "WSFE_FECAESolicitar",
          payload: toJsonObject(caeRequest)
        }
      });

      await tx.arcaResponse.create({
        data: {
          facturaId: factura.id,
          servicio: "WSFE_FECAESolicitar",
          payload: toJsonObject({
            resultado: caeResponse.resultado,
            cae: caeResponse.cae,
            caeFechaVencimiento: caeResponse.caeFechaVencimiento,
            comprobanteDesde: caeResponse.comprobanteDesde,
            comprobanteHasta: caeResponse.comprobanteHasta,
            observaciones: caeResponse.observaciones,
            errors: caeResponse.errors
          })
        }
      });
    });
  } catch (error) {
    const existing = await findFacturaByKey(idempotencyKey);

    if (existing && existing.estado === "AUTORIZADA_HOMOLOGACION") {
      return {
        statusCode: 200,
        body: {
          ...buildClarionResponseFromFactura(existing),
          idempotente: true
        }
      };
    }

    throw error;
  }

  return {
    statusCode: 201,
    body: {
      ...responseJson,
      idempotente: false
    }
  };
}

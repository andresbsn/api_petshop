import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { FacturaRequest } from "./factura.schema";

type FacturaResponse = ReturnType<typeof crearComprobanteSimulado>;

export class FacturaServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacturaServiceError";
  }
}

function buildIdempotencyKey(payload: FacturaRequest) {
  return `${payload.empresa}:${payload.origen}:${payload.idVenta}`;
}

function crearComprobanteSimulado(payload: FacturaRequest) {
  const importeIva = Number((payload.venta.total - payload.venta.subtotal).toFixed(2));
  const tipo = payload.comprobante.tipo ?? `TIPO_${payload.comprobante.codigoTipoComprobante}_SIMULADO`;

  return {
    success: true,
    idVenta: payload.idVenta,
    comprobante: {
      codigoTipoComprobante: payload.comprobante.codigoTipoComprobante,
      tipo,
      puntoVenta: 3,
      numero: 1,
      fechaEmision: payload.fecha,
      codigoTipoDocumento: payload.cliente.tipoDocumento,
      numeroDocumento: payload.cliente.numeroDocumento,
      importeGravado: payload.venta.subtotal,
      importeIva,
      importeTotal: payload.venta.total,
      cae: "00000000000000",
      fechaVencimientoCae: payload.fecha,
      resultado: "SIMULADO"
    }
  };
}

function toJsonObject<T>(value: T) {
  return value as Prisma.InputJsonObject;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findFacturaResponseByKey(idempotencyKey: string) {
  const factura = await prisma.factura.findUnique({
    where: { idempotencyKey }
  });

  return factura?.responseJson as FacturaResponse | undefined;
}

export async function buscarFacturaPorVenta(params: {
  empresa: string;
  origen: string;
  idVenta: string;
}) {
  const empresa = await prisma.empresa.findUnique({
    where: { codigo: params.empresa }
  });

  if (!empresa) {
    return undefined;
  }

  const factura = await prisma.factura.findUnique({
    where: {
      empresaId_origen_idVenta: {
        empresaId: empresa.id,
        origen: params.origen,
        idVenta: params.idVenta
      }
    }
  });

  return factura?.responseJson as FacturaResponse | undefined;
}

export async function crearFacturaSimulada(payload: FacturaRequest) {
  const idempotencyKey = buildIdempotencyKey(payload);
  const comprobanteExistente = await findFacturaResponseByKey(idempotencyKey);

  if (comprobanteExistente) {
    return {
      statusCode: 200,
      body: {
        ...comprobanteExistente,
        idempotente: true
      }
    };
  }

  const comprobante = crearComprobanteSimulado(payload);

  try {
    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.upsert({
        where: { codigo: payload.empresa },
        update: {},
        create: {
          codigo: payload.empresa,
          nombre: payload.empresa
        }
      });

      const factura = await tx.factura.create({
        data: {
          empresaId: empresa.id,
          origen: payload.origen,
          idVenta: String(payload.idVenta),
          fecha: payload.fecha,
          idempotencyKey,
          codigoTipoComprobante: comprobante.comprobante.codigoTipoComprobante,
          tipoComprobante: comprobante.comprobante.tipo,
          puntoVenta: comprobante.comprobante.puntoVenta,
          numeroComprobante: comprobante.comprobante.numero,
          codigoTipoDocumento: comprobante.comprobante.codigoTipoDocumento,
          numeroDocumento: comprobante.comprobante.numeroDocumento,
          importeGravado: comprobante.comprobante.importeGravado,
          importeIva: comprobante.comprobante.importeIva,
          importeTotal: comprobante.comprobante.importeTotal,
          cae: comprobante.comprobante.cae,
          fechaVencimientoCae: comprobante.comprobante.fechaVencimientoCae,
          resultado: comprobante.comprobante.resultado,
          payloadOriginal: toJsonObject(payload),
          responseJson: toJsonObject(comprobante),
          items: {
            create: payload.items.map((item, index) => ({
              renglon: index + 1,
              idProducto: item.idProducto === undefined ? undefined : String(item.idProducto),
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              alicuotaIva: item.alicuotaIva,
              importeTotal: item.importeTotal
            }))
          }
        }
      });

      await tx.arcaRequest.create({
        data: {
          facturaId: factura.id,
          servicio: "WSFE_SIMULADO",
          payload: toJsonObject(payload)
        }
      });

      await tx.arcaResponse.create({
        data: {
          facturaId: factura.id,
          servicio: "WSFE_SIMULADO",
          payload: toJsonObject(comprobante)
        }
      });
    });

    console.info("Factura simulada registrada", {
      idempotencyKey,
      idVenta: payload.idVenta,
      origen: payload.origen
    });

    return {
      statusCode: 201,
      body: {
        ...comprobante,
        idempotente: false
      }
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const facturaExistente = await findFacturaResponseByKey(idempotencyKey);

      if (facturaExistente) {
        return {
          statusCode: 200,
          body: {
            ...facturaExistente,
            idempotente: true
          }
        };
      }
    }

    console.error("Error registrando factura simulada", error);
    throw new FacturaServiceError("No se pudo registrar la factura simulada");
  }
}

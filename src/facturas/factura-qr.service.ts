import QRCode from "qrcode";
import { buildArcaQrUrl } from "../arca/qr";
import { prisma } from "../prisma";

function extractQrUrlFromResponse(responseJson: unknown) {
  if (!responseJson || typeof responseJson !== "object") {
    return undefined;
  }

  const response = responseJson as {
    comprobante?: { qrUrl?: unknown };
    clarion?: { QRUrl?: unknown };
  };

  if (typeof response.comprobante?.qrUrl === "string") {
    return response.comprobante.qrUrl;
  }

  if (typeof response.clarion?.QRUrl === "string") {
    return response.clarion.QRUrl;
  }

  return undefined;
}

export async function generarQrFacturaPng(params: {
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

  if (!factura || !["AUTORIZADA_HOMOLOGACION", "AUTORIZADA_PRODUCCION"].includes(factura.estado)) {
    return undefined;
  }

  const qrUrl = extractQrUrlFromResponse(factura.responseJson) ?? (process.env.AFIP_CUIT ? buildArcaQrUrl({
    fecha: factura.fecha,
    cuit: process.env.AFIP_CUIT,
    puntoVenta: factura.puntoVenta,
    tipoComprobante: factura.codigoTipoComprobante,
    numeroComprobante: factura.numeroComprobante,
    importeTotal: Number(factura.importeTotal),
    moneda: "PES",
    cotizacion: 1,
    tipoDocumentoReceptor: factura.codigoTipoDocumento,
    numeroDocumentoReceptor: factura.numeroDocumento,
    cae: factura.cae
  }) : undefined);

  if (!qrUrl) {
    return undefined;
  }

  return QRCode.toBuffer(qrUrl, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280
  });
}

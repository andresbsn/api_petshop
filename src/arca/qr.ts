type ArcaQrParams = {
  fecha: string;
  cuit: string;
  puntoVenta: number;
  tipoComprobante: number;
  numeroComprobante: number;
  importeTotal: number;
  moneda: string;
  cotizacion: number;
  tipoDocumentoReceptor: number;
  numeroDocumentoReceptor: string;
  cae: string;
};

export function buildArcaQrUrl(params: ArcaQrParams) {
  const payload = {
    ver: 1,
    fecha: params.fecha,
    cuit: Number(params.cuit),
    ptoVta: params.puntoVenta,
    tipoCmp: params.tipoComprobante,
    nroCmp: params.numeroComprobante,
    importe: params.importeTotal,
    moneda: params.moneda,
    ctz: params.cotizacion,
    tipoDocRec: params.tipoDocumentoReceptor,
    nroDocRec: Number(params.numeroDocumentoReceptor),
    tipoCodAut: "E",
    codAut: Number(params.cae)
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${encoded}`;
}

import { FacturaRequest } from "./factura.schema";

type PreviewIssue = {
  path: string;
  message: string;
};

const IVA_AFIP_CODES: Record<string, number> = {
  "0": 3,
  "10.5": 4,
  "21": 5,
  "27": 6,
  "5": 8,
  "2.5": 9
};

const CONDICION_IVA_RECEPTOR_CODES: Record<string, number> = {
  RESPONSABLE_INSCRIPTO: 1,
  IVA_RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  IVA_SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  RESPONSABLE_MONOTRIBUTO: 6,
  MONOTRIBUTO: 6,
  SUJETO_NO_CATEGORIZADO: 7,
  IVA_NO_ALCANZADO: 15
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeFecha(fecha: string, advertencias: PreviewIssue[]) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  const ddmmyyyy = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (ddmmyyyy) {
    advertencias.push({
      path: "fecha",
      message: "La fecha llego como DD/MM/YYYY y fue normalizada a YYYY-MM-DD."
    });

    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  advertencias.push({
    path: "fecha",
    message: "Formato de fecha no reconocido. Para AFIP debe usarse YYYY-MM-DD."
  });

  return fecha;
}

function normalizeAlicuota(value: number | undefined) {
  return value ?? 21;
}

function getIvaAfipCode(alicuota: number) {
  return IVA_AFIP_CODES[String(alicuota)];
}

function getCondicionIvaReceptorId(payload: FacturaRequest) {
  if (payload.cliente.condicionIvaReceptorId) {
    return payload.cliente.condicionIvaReceptorId;
  }

  if (!payload.cliente.condicionIva) {
    return undefined;
  }

  return CONDICION_IVA_RECEPTOR_CODES[payload.cliente.condicionIva.toUpperCase()];
}

export function crearPreviewFactura(payload: FacturaRequest, options?: { numeroComprobante?: number }) {
  const errores: PreviewIssue[] = [];
  const advertencias: PreviewIssue[] = [];
  const fecha = normalizeFecha(payload.fecha, advertencias);
  const puntoVenta = payload.comprobante.puntoVenta ?? Number(process.env.AFIP_PTO_VTA ?? 0);
  const condicionIvaReceptorId = getCondicionIvaReceptorId(payload);

  if (!puntoVenta) {
    errores.push({
      path: "comprobante.puntoVenta",
      message: "Falta punto de venta. Enviar comprobante.puntoVenta o configurar AFIP_PTO_VTA."
    });
  }

  if (payload.comprobante.codigoTipoComprobante === 1 && payload.cliente.tipoDocumento === 99) {
    errores.push({
      path: "comprobante.codigoTipoComprobante",
      message: "Factura A no corresponde para consumidor final/sin identificar."
    });
  }

  if (!condicionIvaReceptorId) {
    errores.push({
      path: "cliente.condicionIvaReceptorId",
      message: "Falta condicion IVA receptor requerida por AFIP/ARCA. Enviar cliente.condicionIvaReceptorId o una condicionIva conocida."
    });
  }

  const items = payload.items.map((item, index) => {
    const alicuotaIva = normalizeAlicuota(item.alicuotaIva);
    const ivaAfipCode = getIvaAfipCode(alicuotaIva);
    const importeTotal = round2(item.importeTotal);
    const importeNeto = round2(importeTotal / (1 + alicuotaIva / 100));
    const importeIva = round2(importeTotal - importeNeto);
    const precioUnitarioNeto = round2(item.precioUnitario / (1 + alicuotaIva / 100));

    if (item.precioUnitario <= 0) {
      errores.push({
        path: `items.${index}.precioUnitario`,
        message: "El precio unitario debe ser mayor a 0 para emitir."
      });
    }

    if (item.importeTotal <= 0) {
      errores.push({
        path: `items.${index}.importeTotal`,
        message: "El importe total del item debe ser mayor a 0 para emitir."
      });
    }

    if (!ivaAfipCode) {
      errores.push({
        path: `items.${index}.alicuotaIva`,
        message: `Alicuota IVA no soportada para AFIP: ${alicuotaIva}.`
      });
    }

    return {
      renglon: index + 1,
      idProducto: item.idProducto,
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitarioConIva: item.precioUnitario,
      precioUnitarioNeto,
      alicuotaIva,
      codigoAlicuotaAfip: ivaAfipCode,
      importeNeto,
      importeIva,
      importeTotal
    };
  });

  const totalItems = round2(items.reduce((sum, item) => sum + item.importeTotal, 0));
  const importeNeto = round2(items.reduce((sum, item) => sum + item.importeNeto, 0));
  const importeIva = round2(items.reduce((sum, item) => sum + item.importeIva, 0));
  const importeTotal = round2(payload.venta.total);
  const diferenciaTotal = round2(totalItems - importeTotal);

  if (importeTotal <= 0) {
    errores.push({
      path: "venta.total",
      message: "El total de la venta debe ser mayor a 0 para emitir."
    });
  }

  if (Math.abs(diferenciaTotal) > 0.01) {
    errores.push({
      path: "venta.total",
      message: `La suma de items (${totalItems}) no coincide con venta.total (${importeTotal}).`
    });
  }

  if (round2(payload.venta.subtotal) === importeTotal && importeIva > 0) {
    advertencias.push({
      path: "venta.subtotal",
      message: "El subtotal llego igual al total. Se recalculo el neto gravado porque los importes vienen con IVA incluido."
    });
  }

  const ivaPorAlicuota = items.reduce<Array<{ Id: number; BaseImp: number; Importe: number }>>((result, item) => {
    if (!item.codigoAlicuotaAfip) {
      return result;
    }

    const existing = result.find((iva) => iva.Id === item.codigoAlicuotaAfip);

    if (existing) {
      existing.BaseImp = round2(existing.BaseImp + item.importeNeto);
      existing.Importe = round2(existing.Importe + item.importeIva);
    } else {
      result.push({
        Id: item.codigoAlicuotaAfip,
        BaseImp: item.importeNeto,
        Importe: item.importeIva
      });
    }

    return result;
  }, []);

  return {
    success: errores.length === 0,
    modo: "PREVIEW",
    idVenta: payload.idVenta,
    validaciones: {
      errores,
      advertencias
    },
    normalizado: {
      fecha,
      puntoVenta,
      codigoTipoComprobante: payload.comprobante.codigoTipoComprobante,
      tipo: payload.comprobante.tipo,
      condicionIvaReceptorId,
      importes: {
        importeNeto,
        importeIva,
        importeTotal,
        sumaItems: totalItems
      },
      items
    },
    arca: {
      FeCAEReq: {
        FeCabReq: {
          CantReg: 1,
          PtoVta: puntoVenta,
          CbteTipo: payload.comprobante.codigoTipoComprobante
        },
        FeDetReq: [{
          Concepto: 1,
          DocTipo: payload.cliente.tipoDocumento,
          DocNro: Number(payload.cliente.numeroDocumento),
          CondicionIVAReceptorId: condicionIvaReceptorId,
          CbteDesde: options?.numeroComprobante ?? "PENDIENTE_ULTIMO_AUTORIZADO_MAS_UNO",
          CbteHasta: options?.numeroComprobante ?? "PENDIENTE_ULTIMO_AUTORIZADO_MAS_UNO",
          CbteFch: fecha.replace(/-/g, ""),
          ImpTotal: importeTotal,
          ImpTotConc: 0,
          ImpNeto: importeNeto,
          ImpOpEx: 0,
          ImpTrib: 0,
          ImpIVA: importeIva,
          MonId: "PES",
          MonCotiz: 1,
          Iva: ivaPorAlicuota
        }]
      }
    }
  };
}

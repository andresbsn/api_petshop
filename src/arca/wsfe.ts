import { ArcaConfig } from "./arca.config";
import { postSoap } from "./soap";
import { WsaaLoginTicket } from "./wsaa";
import { firstXmlMatch, parseWsfeErrors, xmlEscape } from "./xml";

export type WsfeAuth = {
  cuit: string;
  token: string;
  sign: string;
};

export function buildWsfeAuth(config: ArcaConfig, ticket: WsaaLoginTicket): WsfeAuth {
  return {
    cuit: config.cuit,
    token: ticket.token,
    sign: ticket.sign
  };
}

export async function wsfeDummy(config: ArcaConfig) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEDummy/>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(config.wsfeUrl, "http://ar.gov.afip.dif.FEV1/FEDummy", body);

  return {
    appServer: firstXmlMatch(response, /<AppServer>([\s\S]*?)<\/AppServer>/),
    dbServer: firstXmlMatch(response, /<DbServer>([\s\S]*?)<\/DbServer>/),
    authServer: firstXmlMatch(response, /<AuthServer>([\s\S]*?)<\/AuthServer>/)
  };
}

export async function wsfeTiposComprobante(config: ArcaConfig, auth: WsfeAuth) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEParamGetTiposCbte>
      <ar:Auth>
        <ar:Token>${xmlEscape(auth.token)}</ar:Token>
        <ar:Sign>${xmlEscape(auth.sign)}</ar:Sign>
        <ar:Cuit>${xmlEscape(auth.cuit)}</ar:Cuit>
      </ar:Auth>
    </ar:FEParamGetTiposCbte>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(config.wsfeUrl, "http://ar.gov.afip.dif.FEV1/FEParamGetTiposCbte", body);
  const errors = parseWsfeErrors(response);
  const count = (response.match(/<CbteTipo>/g) || []).length;

  return { count, errors };
}

export async function wsfePuntosVenta(config: ArcaConfig, auth: WsfeAuth) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEParamGetPtosVenta>
      <ar:Auth>
        <ar:Token>${xmlEscape(auth.token)}</ar:Token>
        <ar:Sign>${xmlEscape(auth.sign)}</ar:Sign>
        <ar:Cuit>${xmlEscape(auth.cuit)}</ar:Cuit>
      </ar:Auth>
    </ar:FEParamGetPtosVenta>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(config.wsfeUrl, "http://ar.gov.afip.dif.FEV1/FEParamGetPtosVenta", body);
  const errors = parseWsfeErrors(response);
  const puntosVenta = [...response.matchAll(/<(?:Nro|PtoVenta)>(\d+)<\/(?:Nro|PtoVenta)>/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  return { puntosVenta: [...new Set(puntosVenta)], errors };
}

export async function wsfeUltimoComprobanteAutorizado(config: ArcaConfig, auth: WsfeAuth, params: {
  puntoVenta: number;
  tipoComprobante: number;
}) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${xmlEscape(auth.token)}</ar:Token>
        <ar:Sign>${xmlEscape(auth.sign)}</ar:Sign>
        <ar:Cuit>${xmlEscape(auth.cuit)}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${params.puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${params.tipoComprobante}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(config.wsfeUrl, "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado", body);
  const errors = parseWsfeErrors(response);
  const cbteNro = firstXmlMatch(response, /<CbteNro>([\s\S]*?)<\/CbteNro>/);

  return {
    comprobanteNumero: cbteNro === undefined ? undefined : Number(cbteNro),
    errors
  };
}

export type WsfeCaeRequest = {
  FeCAEReq: {
    FeCabReq: {
      CantReg: number;
      PtoVta: number;
      CbteTipo: number;
    };
    FeDetReq: Array<{
      Concepto: number;
      DocTipo: number;
      DocNro: number;
      CondicionIVAReceptorId?: number;
      CbteDesde: number;
      CbteHasta: number;
      CbteFch: string;
      ImpTotal: number;
      ImpTotConc: number;
      ImpNeto: number;
      ImpOpEx: number;
      ImpTrib: number;
      ImpIVA: number;
      MonId: string;
      MonCotiz: number;
      Iva: Array<{
        Id: number;
        BaseImp: number;
        Importe: number;
      }>;
    }>;
  };
};

function buildIvaXml(ivas: WsfeCaeRequest["FeCAEReq"]["FeDetReq"][number]["Iva"]) {
  if (ivas.length === 0) {
    return "";
  }

  return `<ar:Iva>${ivas.map((iva) => `
          <ar:AlicIva>
            <ar:Id>${iva.Id}</ar:Id>
            <ar:BaseImp>${iva.BaseImp.toFixed(2)}</ar:BaseImp>
            <ar:Importe>${iva.Importe.toFixed(2)}</ar:Importe>
          </ar:AlicIva>`).join("")}
        </ar:Iva>`;
}

export async function wsfeSolicitarCae(config: ArcaConfig, auth: WsfeAuth, request: WsfeCaeRequest) {
  const cab = request.FeCAEReq.FeCabReq;
  const det = request.FeCAEReq.FeDetReq[0];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${xmlEscape(auth.token)}</ar:Token>
        <ar:Sign>${xmlEscape(auth.sign)}</ar:Sign>
        <ar:Cuit>${xmlEscape(auth.cuit)}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>${cab.CantReg}</ar:CantReg>
          <ar:PtoVta>${cab.PtoVta}</ar:PtoVta>
          <ar:CbteTipo>${cab.CbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${det.Concepto}</ar:Concepto>
            <ar:DocTipo>${det.DocTipo}</ar:DocTipo>
            <ar:DocNro>${det.DocNro}</ar:DocNro>
            ${det.CondicionIVAReceptorId ? `<ar:CondicionIVAReceptorId>${det.CondicionIVAReceptorId}</ar:CondicionIVAReceptorId>` : ""}
            <ar:CbteDesde>${det.CbteDesde}</ar:CbteDesde>
            <ar:CbteHasta>${det.CbteHasta}</ar:CbteHasta>
            <ar:CbteFch>${det.CbteFch}</ar:CbteFch>
            <ar:ImpTotal>${det.ImpTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>${det.ImpTotConc.toFixed(2)}</ar:ImpTotConc>
            <ar:ImpNeto>${det.ImpNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${det.ImpOpEx.toFixed(2)}</ar:ImpOpEx>
            <ar:ImpTrib>${det.ImpTrib.toFixed(2)}</ar:ImpTrib>
            <ar:ImpIVA>${det.ImpIVA.toFixed(2)}</ar:ImpIVA>
            <ar:MonId>${xmlEscape(det.MonId)}</ar:MonId>
            <ar:MonCotiz>${det.MonCotiz}</ar:MonCotiz>
            ${buildIvaXml(det.Iva)}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(config.wsfeUrl, "http://ar.gov.afip.dif.FEV1/FECAESolicitar", body);
  const errors = parseWsfeErrors(response);
  const cae = firstXmlMatch(response, /<CAE>([\s\S]*?)<\/CAE>/);
  const caeFechaVencimiento = firstXmlMatch(response, /<CAEFchVto>([\s\S]*?)<\/CAEFchVto>/);
  const resultado = firstXmlMatch(response, /<Resultado>([\s\S]*?)<\/Resultado>/);
  const cbteDesde = firstXmlMatch(response, /<CbteDesde>([\s\S]*?)<\/CbteDesde>/);
  const cbteHasta = firstXmlMatch(response, /<CbteHasta>([\s\S]*?)<\/CbteHasta>/);
  const observaciones = [...response.matchAll(/<Obs>\s*<Code>([\s\S]*?)<\/Code>\s*<Msg>([\s\S]*?)<\/Msg>\s*<\/Obs>/g)]
    .map((match) => ({ code: match[1], message: match[2] }));

  return {
    rawResponse: response,
    errors,
    observaciones,
    resultado,
    cae,
    caeFechaVencimiento,
    comprobanteDesde: cbteDesde === undefined ? undefined : Number(cbteDesde),
    comprobanteHasta: cbteHasta === undefined ? undefined : Number(cbteHasta)
  };
}

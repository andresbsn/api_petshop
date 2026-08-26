import "dotenv/config";
import { loadArcaConfig } from "../src/arca/arca.config";
import { getWsaaLoginTicket } from "../src/arca/wsaa";
import {
  buildWsfeAuth,
  wsfePuntosVenta,
  wsfeUltimoComprobanteAutorizado
} from "../src/arca/wsfe";

async function main() {
  const config = loadArcaConfig();
  const tipoComprobante = process.env.AFIP_CBTE_TIPO ? Number(process.env.AFIP_CBTE_TIPO) : undefined;

  console.log(`Ambiente: ${config.production ? "produccion" : "homologacion"}`);

  const { ticket, fromCache } = await getWsaaLoginTicket(config, "wsfe");
  const auth = buildWsfeAuth(config, ticket);
  console.log(`WSAA LoginCms: OK, cache=${fromCache ? "hit" : "miss"}`);

  const puntosVenta = await wsfePuntosVenta(config, auth);

  if (puntosVenta.errors.length > 0) {
    console.log(`WSFE FEParamGetPtosVenta: ERROR ${JSON.stringify(puntosVenta.errors)}`);
    process.exit(1);
  }

  const puntos = puntosVenta.puntosVenta.length > 0 ? puntosVenta.puntosVenta.join(",") : "ninguno";
  console.log(`WSFE FEParamGetPtosVenta: OK, puntos recibidos=${puntosVenta.puntosVenta.length} (${puntos})`);

  if (config.puntoVenta !== undefined) {
    console.log(`Punto de venta configurado: ${puntosVenta.puntosVenta.includes(config.puntoVenta) ? "encontrado" : "no_encontrado"}`);
  } else {
    console.log("Punto de venta configurado: falta AFIP_PTO_VTA");
  }

  if (config.puntoVenta === undefined || tipoComprobante === undefined) {
    console.log("WSFE FECompUltimoAutorizado: omitido, requiere AFIP_PTO_VTA y AFIP_CBTE_TIPO");
    return;
  }

  const ultimo = await wsfeUltimoComprobanteAutorizado(config, auth, {
    puntoVenta: config.puntoVenta,
    tipoComprobante
  });

  if (ultimo.errors.length > 0) {
    console.log(`WSFE FECompUltimoAutorizado: ERROR ${JSON.stringify(ultimo.errors)}`);
    process.exit(1);
  }

  console.log(`WSFE FECompUltimoAutorizado: OK, ultimo=${ultimo.comprobanteNumero ?? "sin_dato"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

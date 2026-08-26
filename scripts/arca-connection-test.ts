import "dotenv/config";
import { loadArcaConfig } from "../src/arca/arca.config";
import { getWsaaLoginTicket } from "../src/arca/wsaa";
import { buildWsfeAuth, wsfeDummy, wsfeTiposComprobante } from "../src/arca/wsfe";

async function main() {
  const config = loadArcaConfig();

  console.log(`Ambiente: ${config.production ? "produccion" : "homologacion"}`);
  console.log(`Certificado: ${config.certUsedFallback ? "fallback_en_certs" : "configurado"}`);
  console.log(`Clave privada: ${config.keyUsedFallback ? "fallback_en_certs" : "configurada"}`);

  const { ticket, fromCache } = await getWsaaLoginTicket(config, "wsfe");
  console.log(`WSAA LoginCms: OK${ticket.expirationTime ? `, expira ${ticket.expirationTime}` : ""}, cache=${fromCache ? "hit" : "miss"}`);

  const dummy = await wsfeDummy(config);
  console.log(`WSFE FEDummy: AppServer=${dummy.appServer || "?"}, DbServer=${dummy.dbServer || "?"}, AuthServer=${dummy.authServer || "?"}`);

  const tipos = await wsfeTiposComprobante(config, buildWsfeAuth(config, ticket));

  if (tipos.errors.length > 0) {
    console.log(`WSFE FEParamGetTiposCbte: ERROR ${JSON.stringify(tipos.errors)}`);
    process.exit(1);
  }

  console.log(`WSFE FEParamGetTiposCbte: OK, tipos recibidos=${tipos.count}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

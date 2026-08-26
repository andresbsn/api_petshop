import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { ArcaConfig } from "./arca.config";
import { postSoap } from "./soap";
import { firstXmlMatch, xmlEscape, xmlUnescape } from "./xml";

export type WsaaLoginTicket = {
  token: string;
  sign: string;
  expirationTime?: string;
};

const ticketsByService = new Map<string, WsaaLoginTicket>();

function getCacheFilePath(cacheKey: string) {
  const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.resolve(".arca-cache", `${safeName}.json`);
}

function isTicketValid(ticket: WsaaLoginTicket) {
  if (!ticket.expirationTime) {
    return false;
  }

  const expiresAt = new Date(ticket.expirationTime).getTime();
  const safetyWindowMs = 5 * 60 * 1000;

  return Number.isFinite(expiresAt) && expiresAt - safetyWindowMs > Date.now();
}

function readCachedTicket(cacheKey: string) {
  const cacheFile = getCacheFilePath(cacheKey);

  if (!fs.existsSync(cacheFile)) {
    return undefined;
  }

  try {
    const ticket = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as WsaaLoginTicket;
    return isTicketValid(ticket) ? ticket : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedTicket(cacheKey: string, ticket: WsaaLoginTicket) {
  const cacheFile = getCacheFilePath(cacheKey);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(ticket, null, 2));
}

function buildTra(service: string) {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${xmlEscape(service)}</service>
</loginTicketRequest>`;
}

function signTra(tra: string, certPath: string, keyPath: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arca-wsaa-"));
  const traPath = path.join(tempDir, "tra.xml");
  const cmsPath = path.join(tempDir, "tra.cms");

  try {
    fs.writeFileSync(traPath, tra);

    const result = spawnSync("openssl", [
      "cms",
      "-sign",
      "-in", traPath,
      "-signer", certPath,
      "-inkey", keyPath,
      "-nodetach",
      "-outform", "DER",
      "-out", cmsPath
    ], { encoding: "utf8" });

    if (result.status !== 0) {
      throw new Error(`No se pudo firmar el TRA con OpenSSL. ${result.stderr || result.stdout}`);
    }

    return fs.readFileSync(cmsPath).toString("base64");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function loginCms(cms: string, wsaaUrl: string): Promise<WsaaLoginTicket> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await postSoap(wsaaUrl, "", body);
  const loginCmsReturn = firstXmlMatch(response, /<loginCmsReturn[^>]*>([\s\S]*?)<\/loginCmsReturn>/);

  if (!loginCmsReturn) {
    throw new Error(`WSAA no devolvio loginCmsReturn. ${response.slice(0, 500)}`);
  }

  const ta = xmlUnescape(loginCmsReturn);
  const token = firstXmlMatch(ta, /<token>([\s\S]*?)<\/token>/);
  const sign = firstXmlMatch(ta, /<sign>([\s\S]*?)<\/sign>/);
  const expirationTime = firstXmlMatch(ta, /<expirationTime>([\s\S]*?)<\/expirationTime>/);

  if (!token || !sign) {
    throw new Error(`WSAA respondio sin token/sign. ${ta.slice(0, 500)}`);
  }

  return { token, sign, expirationTime };
}

export async function getWsaaLoginTicket(config: ArcaConfig, service = "wsfe") {
  const cacheKey = `${config.production ? "prod" : "homo"}:${service}:${config.cuit}`;
  const cached = ticketsByService.get(cacheKey);

  if (cached && isTicketValid(cached)) {
    return { ticket: cached, fromCache: true };
  }

  const persisted = readCachedTicket(cacheKey);

  if (persisted) {
    ticketsByService.set(cacheKey, persisted);
    return { ticket: persisted, fromCache: true };
  }

  const cms = signTra(buildTra(service), config.certPath, config.keyPath);
  const ticket = await loginCms(cms, config.wsaaUrl);
  ticketsByService.set(cacheKey, ticket);
  writeCachedTicket(cacheKey, ticket);

  return { ticket, fromCache: false };
}

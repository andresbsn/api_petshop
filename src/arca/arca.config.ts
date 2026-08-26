import fs from "fs";
import path from "path";

export type ArcaConfig = {
  cuit: string;
  puntoVenta?: number;
  production: boolean;
  certPath: string;
  keyPath: string;
  certUsedFallback: boolean;
  keyUsedFallback: boolean;
  wsaaUrl: string;
  wsfeUrl: string;
};

function findFirstFileByExtension(extension: string) {
  const certsDir = path.resolve("certs");

  if (!fs.existsSync(certsDir)) {
    return undefined;
  }

  return fs.readdirSync(certsDir)
    .filter((file) => file.toLowerCase().endsWith(extension))
    .map((file) => path.join(certsDir, file))[0];
}

function resolveExistingFile(configuredPath: string | undefined, fallbackExtension: string) {
  if (configuredPath) {
    const fullPath = path.resolve(configuredPath);

    if (fs.existsSync(fullPath)) {
      return { filePath: fullPath, usedFallback: false };
    }
  }

  const fallback = findFirstFileByExtension(fallbackExtension);

  if (fallback) {
    return { filePath: fallback, usedFallback: true };
  }

  return undefined;
}

export function loadArcaConfig(): ArcaConfig {
  const cuit = process.env.AFIP_CUIT;

  if (!cuit) {
    throw new Error("Falta AFIP_CUIT en .env");
  }

  const cert = resolveExistingFile(process.env.AFIP_CERT, ".crt");
  const key = resolveExistingFile(process.env.AFIP_KEY, ".key");

  if (!cert) {
    throw new Error("No se encontro certificado .crt");
  }

  if (!key) {
    throw new Error("No se encontro clave privada .key");
  }

  const production = String(process.env.AFIP_PRODUCTION).toLowerCase() === "true";
  const puntoVenta = process.env.AFIP_PTO_VTA ? Number(process.env.AFIP_PTO_VTA) : undefined;

  return {
    cuit,
    puntoVenta,
    production,
    certPath: cert.filePath,
    keyPath: key.filePath,
    certUsedFallback: cert.usedFallback,
    keyUsedFallback: key.usedFallback,
    wsaaUrl: production
      ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
      : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfeUrl: production
      ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
      : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
  };
}

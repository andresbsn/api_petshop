export async function postSoap(url: string, soapAction: string, body: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction
    },
    body
  });

  const text = await response.text();

  if (!response.ok) {
    if (text.includes("coe.alreadyAuthenticated")) {
      throw new Error("WSAA_ALREADY_AUTHENTICATED: AFIP/ARCA ya tiene un TA valido para este CUIT/servicio. Si no existe cache local, esperar el vencimiento del TA actual y volver a ejecutar para guardarlo.");
    }

    throw new Error(`SOAP HTTP ${response.status}. ${text.slice(0, 500)}`);
  }

  return text;
}

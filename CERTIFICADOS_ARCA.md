# Certificados ARCA

## Certificado generado

Ambiente: produccion

Archivos locales:

- `certs/api-facturacion-petshop-produccion.key`: clave privada local. No compartir, no subir a AFIP/ARCA, no enviar por chat.
- `certs/api-facturacion-petshop-produccion.csr`: pedido de certificado. Este es el archivo que se carga en AFIP/ARCA.

Subject del CSR:

```text
C=AR, O=PET SHOP, CN=api-facturacion-petshop, serialNumber=CUIT 20379342095
```

## Proximo paso en AFIP/ARCA

1. Ingresar con clave fiscal.
2. Ir al administrador de certificados digitales o servicio equivalente para Web Services.
3. Crear/subir un nuevo certificado para produccion usando el archivo `.csr`.
4. Descargar el certificado emitido, normalmente `.crt`.
5. Guardar el `.crt` junto a la clave privada en `certs/`.

## Seguridad

- La carpeta `certs/` esta ignorada por Git.
- La clave privada `.key` debe quedar protegida.
- Si la clave se pierde, el certificado descargado no sirve y hay que generar un nuevo par `.key` + `.csr`.
- Si la clave se filtra, hay que revocar el certificado en AFIP/ARCA.

## Prueba de conexion sin impacto fiscal

```bash
npm run arca:test-connection
```

La prueba realiza:

- autenticacion WSAA `LoginCms` para servicio `wsfe`;
- consulta `FEDummy` de estado WSFE;
- consulta de parametros `FEParamGetTiposCbte`.

No emite comprobantes y no consulta/progresa numeracion.

## Rutas en .env

Usar rutas relativas desde la carpeta del proyecto. Si el nombre contiene espacios, se puede envolver entre comillas:

```env
AFIP_CERT="certs/facturacion Web_2191f111abc33e87.crt"
AFIP_KEY=certs/api-facturacion-petshop-produccion.key
```

Tambien se puede usar `\` en Windows, pero `/` evita problemas de escape.

## Diagnostico fiscal sin emision

```bash
npm run arca:fiscal-status
```

La prueba realiza:

- autenticacion WSAA `LoginCms` para servicio `wsfe`;
- consulta de puntos de venta `FEParamGetPtosVenta`;
- consulta `FECompUltimoAutorizado` solo si existen `AFIP_PTO_VTA` y `AFIP_CBTE_TIPO`.

`FECompUltimoAutorizado` consulta el ultimo comprobante autorizado para un punto de venta y tipo de comprobante. No emite comprobantes ni avanza numeracion.

Configuracion validada para produccion:

```env
AFIP_PTO_VTA=4
```

Para consultar ultimo autorizado de Factura B:

```env
AFIP_CBTE_TIPO=6
```

## Homologacion

Archivos generados para homologacion:

- `certs/api-facturacion-petshop-homologacion.key`: clave privada local de homologacion. No compartir.
- `certs/api-facturacion-petshop-homologacion.csr`: CSR para subir a AFIP/ARCA homologacion.

Subject del CSR de homologacion:

```text
C=AR, O=PET SHOP, CN=api-facturacion-petshop-homologacion, serialNumber=CUIT 20379342095
```

Cuando AFIP/ARCA devuelva el `.crt` de homologacion, guardarlo en `certs/` y configurar `.env` asi:

```env
AFIP_PRODUCTION=false
AFIP_CERT=certs/nombre-del-certificado-homologacion.crt
AFIP_KEY=certs/api-facturacion-petshop-homologacion.key
AFIP_PTO_VTA=4
AFIP_CBTE_TIPO=6
```

Luego ejecutar:

```bash
npm run arca:test-connection
npm run arca:fiscal-status
```

Estas pruebas no emiten comprobantes.

## Modulos implementados

- `src/arca/arca.config.ts`: lee configuracion AFIP/ARCA desde variables de entorno y resuelve archivos locales.
- `src/arca/wsaa.ts`: genera TRA, firma con OpenSSL, llama a WSAA y cachea el TA en memoria.
- `src/arca/wsfe.ts`: contiene metodos WSFE seguros de diagnostico y consultas de parametros.
- `src/arca/soap.ts`: cliente SOAP HTTP basico.
- `src/arca/xml.ts`: utilidades XML.

El TA se cachea en memoria por ambiente, servicio y CUIT. No se persiste en base ni se imprime en logs.

Tambien se guarda una copia local en `.arca-cache/` para reutilizar el TA entre reinicios mientras no este vencido. Esta carpeta esta ignorada por Git porque contiene token/sign de WSAA.

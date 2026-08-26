# API de Facturacion ARCA

API REST para vincular ventas del sistema Clarion con facturacion electronica ARCA.

Contrato Clarion -> API: ver `CONTRATO_CLARION_API.md`.

## Estado actual

Etapa inicial local. El endpoint de facturacion es simulado y no se conecta aun a ARCA.

## Comandos

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:env -- --name init
npm run dev
npm run build
npm start
```

## Variables de entorno

Copiar `.env.example` a `.env` si se necesita cambiar el puerto.

```env
PORT=3000
API_KEY=generar-una-api-key-larga-y-secreta
DATABASE_URL="postgresql://usuario:password@localhost:5432/api_petshop?schema=public"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=api_petshop
POSTGRES_USER=usuario
POSTGRES_PASSWORD=password
POSTGRES_SCHEMA=public
```

Si se usa `DATABASE_URL`, ejecutar `npm run prisma:migrate -- --name init`.

Si se usan variables separadas `POSTGRES_*`, ejecutar `npm run prisma:migrate:env -- --name init`.

## Endpoints

```http
GET /health
POST /api/v1/facturas
POST /api/v1/facturas/preview
POST /api/v1/facturas/emitir
GET /api/v1/facturas/:origen/:idVenta?empresa=PETSHOP
```

`POST /api/v1/facturas/preview` recibe el mismo JSON que `POST /api/v1/facturas`, normaliza importes con IVA incluido y devuelve el payload fiscal que se enviaria a AFIP/ARCA. No emite comprobantes.

`POST /api/v1/facturas/emitir` emite solamente en homologacion y requiere:

```env
ARCA_EMISION_HABILITADA=true
AFIP_PRODUCTION=false
```

No permite emision si `AFIP_PRODUCTION=true`.

La respuesta de emision incluye un bloque `clarion` con campos planos para guardar en `Comprobantes`:

```json
{
  "success": true,
  "idVenta": 11458,
  "clarion": {
    "ID_NotaP": 11458,
    "CodigoTipoComprobante": 6,
    "NumeroPuntoVenta": 4,
    "NumeroComprobante": 1,
    "FechaEmision": "2026-08-25",
    "CodigoTipoDocumento": 99,
    "NumeroDocumento": "0",
    "ImporteGravado": 4462.81,
    "ImporteNoGravado": 0,
    "ImporteExento": 0,
    "ImporteIva": 937.19,
    "ImporteSubTotal": 4462.81,
    "ImporteOtrosTributos": 0,
    "ImporteTotal": 5400,
    "CodigoMoneda": "PES",
    "CotizacionMoneda": 1,
    "CodigoConcepto": 1,
    "Resultado": "A",
    "CAE": "...",
    "FechaVencimientoCAE": "2026-09-04"
  }
}
```

## Seguridad

Todos los endpoints `/api/v1/*` requieren API Key. Enviar el header:

```http
x-api-key: valor_configurado_en_API_KEY
```

Alternativas para clientes legacy que no puedan enviar headers personalizados:

```http
POST /api/v1/facturas?apiKey=valor_configurado_en_API_KEY
```

O incluirla dentro del JSON:

```json
{
  "apiKey": "valor_configurado_en_API_KEY",
  "empresa": "PETSHOP"
}
```

Preferencia de seguridad: usar header `x-api-key`. Las alternativas son para compatibilidad con Clarion/ClaRunExt.

`GET /health` no requiere API Key.

## Ejemplo de factura simulada

```json
{
  "empresa": "PETSHOP",
  "origen": "PETSHOP_CLARION",
  "idVenta": 15487,
  "fecha": "2026-08-24",
  "comprobante": {
    "codigoTipoComprobante": 6,
    "tipo": "FACTURA_B"
  },
  "cliente": {
    "id": 123,
    "nombre": "Juan Perez",
    "tipoDocumento": 80,
    "numeroDocumento": "20123456789",
    "condicionIva": "RESPONSABLE_INSCRIPTO",
    "condicionIvaReceptorId": 1
  },
  "venta": {
    "subtotal": 82644.63,
    "descuento": 0,
    "recargo": 0,
    "total": 100000
  },
  "items": [
    {
      "idProducto": 25,
      "codigo": "ALIM001",
      "descripcion": "Alimento balanceado",
      "cantidad": 2,
      "precioUnitario": 50000,
      "alicuotaIva": 21,
      "importeTotal": 100000
    }
  ]
}
```

La respuesta incluye un comprobante simulado con `resultado: "SIMULADO"`. La idempotencia se controla en PostgreSQL por `empresa + origen + idVenta`.

`comprobante.codigoTipoComprobante` debe venir desde Clarion usando el codigo AFIP correspondiente. Ejemplos habituales:

- `1`: Factura A.
- `6`: Factura B.
- `11`: Factura C.

Para emitir en AFIP/ARCA tambien se requiere `cliente.condicionIvaReceptorId`. Codigos habituales:

- `1`: IVA Responsable Inscripto.
- `4`: IVA Sujeto Exento.
- `5`: Consumidor Final.
- `6`: Responsable Monotributo.
- `15`: IVA No Alcanzado.

## Consultar factura existente

```http
GET /api/v1/facturas/PETSHOP_CLARION/15487?empresa=PETSHOP
```

Este endpoint permite que Clarion recupere una factura ya registrada si hubo timeout, cierre inesperado o se perdio la respuesta del POST original.

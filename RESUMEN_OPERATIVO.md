# Resumen operativo - API de Facturacion ARCA

## Objetivo

Crear una API REST independiente para facturacion electronica ARCA, integrable inicialmente con un sistema Clarion de Pet Shop, sin reemplazar ni acoplarse al circuito actual de ventas.

## Alcance inmediato

La primera etapa no debe conectarse aun a ARCA. El objetivo inicial es validar el flujo:

```text
Clarion -> POST JSON -> API local -> validacion/registro -> respuesta JSON -> Clarion
```

## Stack propuesto

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- REST/JSON
- Docker y Docker Compose

## Endpoint inicial

```http
POST /api/v1/facturas
```

Responsabilidades iniciales:

- recibir una venta en JSON;
- validar estructura basica;
- registrar la operacion;
- controlar idempotencia por empresa, origen e idVenta;
- devolver una respuesta simulada compatible con Clarion.

## Sistema Clarion existente

Tablas identificadas:

- `notaPedido`: cabecera de venta/pedido.
- `DetNotaPed`: detalle de venta.
- `Cliente`: datos del cliente, pendiente de analizar completo.
- `Producto`: datos de producto, pendiente de analizar completo.
- `Comprobantes`: destino del resultado fiscal autorizado.
- `Combtes_Items`: detalle fiscal asociado.

Regla central:

- una Nota de Pedido puede existir sin factura;
- una factura generada desde una Nota de Pedido debe quedar vinculada a la operacion original;
- no modificar innecesariamente el circuito de ventas existente.

## Idempotencia

Es critica para evitar doble facturacion por doble click, timeouts o reintentos.

Clave conceptual inicial:

```text
empresa + sistema_origen + idVenta
```

Si una venta ya fue procesada, la API debe devolver el comprobante existente y no emitir uno nuevo.

## Modelo propio de la API

Aunque Clarion guarde los datos localmente, la API debe tener base PostgreSQL propia para auditoria y reintentos.

Tablas conceptuales:

- `empresas`
- `facturas`
- `factura_items`
- `arca_requests`
- `arca_responses`

## Multiempresa

No hardcodear CUIT, punto de venta, certificado ni claves del Pet Shop.

Debe existir el concepto `Empresa` con configuracion fiscal y ambiente ARCA.

## Seguridad

- No guardar certificados, private keys, tokens ni credenciales en codigo fuente.
- Usar variables de entorno o almacenamiento seguro.
- Agregar secretos y certificados al `.gitignore` cuando se cree el proyecto.

## Pendientes que no se deben asumir

- Estructura completa de `Cliente`.
- Condicion IVA del cliente.
- Estructura relevante de `Producto`.
- Significado exacto de `PrecioU`.
- Significado exacto de `impuesto`.
- Significado exacto de `porImpuesto`.
- Si los precios almacenados incluyen IVA.
- Relacion exacta `Comprobantes -> notaPedido`.
- Punto de venta ARCA de Pet Shop.
- Condicion fiscal de Pet Shop.
- Tipos de comprobante necesarios.
- Modelo/formato de impresora termica.

## Proximo paso recomendado

Crear la estructura base minima de la API local con endpoint simulado, sin logica fiscal real ni conexion ARCA:

- configuracion Node.js + TypeScript;
- servidor Express;
- endpoint `POST /api/v1/facturas`;
- validacion del payload;
- respuesta mock;
- preparacion para PostgreSQL/Prisma y Docker, preferentemente incremental.

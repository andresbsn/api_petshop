# Proyecto: Integración de Facturación Electrónica ARCA – Pet Shop

## 1. Objetivo

Existe un sistema de gestión de Pet Shop desarrollado en **Clarion**, actualmente en producción y utilizado para ventas, pedidos, clientes, productos, stock y operaciones internas.

El sistema actualmente registra las ventas como **Notas de Pedido**, independientemente de que correspondan a:

- compras realizadas directamente en el local;
- pedidos que posteriormente serán enviados.

Se necesita incorporar **Facturación Electrónica ARCA** sin reemplazar ni reescribir el sistema Clarion existente.

La solución será una **API de facturación independiente**, que centralizará la comunicación con ARCA.

El objetivo futuro es que esta API pueda reutilizarse desde otros sistemas, por lo que NO debe quedar acoplada exclusivamente al Pet Shop ni a Clarion.

---

# 2. Arquitectura general

El flujo esperado es:

```text
Sistema Clarion
      |
      | Venta existente
      |
      | Usuario selecciona:
      | "Facturar ARCA"
      v
API REST de Facturación
      |
      | Validación
      | Autenticación ARCA
      | Facturación electrónica
      v
ARCA
      |
      | CAE + comprobante autorizado
      v
API
      |
      | JSON con resultado
      v
Clarion
      |
      | Guarda datos fiscales
      | asociados a la Nota de Pedido
      v
Impresión ticket térmico
```

La impresora es una **impresora térmica común**, NO un controlador fiscal.

La validez fiscal proviene del comprobante electrónico autorizado por ARCA.

---

# 3. Responsabilidades

## Clarion

Clarion continuará siendo responsable de:

- ventas;
- pedidos;
- clientes;
- productos;
- stock;
- formas de pago;
- interfaz de usuario;
- selección de la venta a facturar;
- envío de la venta hacia la API;
- recepción del resultado;
- almacenamiento local de la factura;
- asociación factura ↔ venta;
- impresión del ticket térmico.

Clarion NO debe implementar directamente la lógica de comunicación con ARCA.

## API de Facturación

La API será responsable de:

- recibir una venta;
- validar la información fiscal;
- determinar/generar los datos necesarios para facturación;
- autenticarse ante ARCA;
- comunicarse con WSFE;
- consultar numeración;
- solicitar CAE;
- procesar errores de ARCA;
- controlar duplicados;
- devolver el comprobante autorizado;
- mantener logs de las operaciones.

La API debe diseñarse para ser reutilizable por múltiples sistemas y empresas.

---

# 4. Tecnología propuesta para la API

Stack inicial:

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- REST
- JSON
- Docker
- Docker Compose

Posteriormente se desplegará en un VPS detrás de Nginx/HTTPS.

La primera etapa de desarrollo será local.

---

# 5. Sistema Clarion existente

La aplicación utiliza archivos/tablas mediante driver **TOPSPEED**.

Las ventas actuales se almacenan como Nota de Pedido.

Las principales tablas involucradas son:

```text
notaPedido
DetNotaPed
Cliente
Producto
Comprobantes
Combtes_Items
```

---

# 6. Cabecera de venta: notaPedido

Tabla:

```text
notaPedido
```

Campos identificados:

```text
idNotaP
Hora
Fecha
Descuento
Descuentop
Recargo
Recargop
Subtotal
Total
saldo
estado
Observacion
FechaPago
idDeptre
idProducto
idCliente
idRemito
idFactura
idUsuario
```

`idNotaP` identifica la operación/venta interna.

La Nota de Pedido debe continuar existiendo independientemente de que posteriormente sea facturada.

---

# 7. Detalle de venta: DetNotaPed

Tabla:

```text
DetNotaPed
```

Campos identificados:

```text
idNotaDet
fecha
Cantidad
stk_pendiente
PrecioU
impuesto
porImpuesto
descuento
porDescuento
Total
facturo
estado
idPresupuesto
idProducto
idNotaP
idCliente
```

La relación con la cabecera es:

```text
notaPedido.idNotaP
        |
        v
DetNotaPed.idNotaP
```

Pendiente confirmar exactamente la semántica de:

```text
PrecioU
impuesto
porImpuesto
Total
```

especialmente si `PrecioU` contiene IVA incluido.

---

# 8. Comprobantes fiscales

Existe una tabla:

```text
Comprobantes
```

Prefix Clarion:

```text
CBT1
```

Campos fiscales identificados:

```text
Codigo
CodigoTipoComprobante
NumeroPuntoVenta
NumeroComprobante
NumComprobAsociado
FechaEmision

CodigoTipoDocumento
NumeroDocumento

ImporteGravado
ImporteNoGravado
ImporteExento
ImporteIva
ImporteSubTotal
ImporteOtrosTributos
ImporteTotal

CodigoMoneda
CotizacionMoneda

Observaciones
CodigoConcepto

Resultado
CUITRepresentado

CAE
FechaVencimientoCAE

Es_Anticipado

ID_Cliente
CODCLI
TIPNUM
NUMERO

Usuario
FechaA
HoraA
Deuda
```

Esta tabla almacenará el resultado de la factura autorizada por ARCA.

Los campos:

```text
CAE
FechaVencimientoCAE
NumeroComprobante
NumeroPuntoVenta
CodigoTipoComprobante
Resultado
```

deben provenir del resultado procesado por la API.

---

# 9. Detalle fiscal: Combtes_Items

Existe una tabla:

```text
Combtes_Items
```

Prefix:

```text
CIT1
```

Campos identificados:

```text
CodigoComprobante
Renglon

UnidadesMtx
CodigoMtx

Codigo
Descripcion

Cantidad
Cantidad_Imp
PesoKg

CodigoUnidadMedida
PrecioUnitario
ImporteBonificacion

ID_Producto

CodigoCondicionIva

ImporteIva
ImporteItem
ImporteGravado
ImporteNoGravado
ImporteExento
ImporteTotal

ID_NotaP
```

Existen además otros campos internos no relevantes inicialmente.

`ID_NotaP` permite vincular el detalle fiscal con la venta original.

La relación conceptual es:

```text
notaPedido
    |
    | idNotaP
    |
    +--------------------+
    |                    |
    v                    v
DetNotaPed         Comprobantes
                         |
                         v
                  Combtes_Items
                         |
                         | ID_NotaP
                         v
                    notaPedido
```

---

# 10. Regla fundamental

Una Nota de Pedido puede existir sin factura.

Pero una factura generada desde una Nota de Pedido debe quedar vinculada con la operación original.

Conceptualmente:

```text
VENTA INTERNA
notaPedido #15487
        |
        +---- DetNotaPed
        |
        +---- Factura B
              PV 00003
              Nro 00001287
              CAE ...
```

No modificar el circuito existente de ventas innecesariamente.

---

# 11. Endpoint principal esperado

La API tendrá inicialmente:

```http
POST /api/v1/facturas
```

Clarion enviará una representación independiente de sus tablas internas.

Ejemplo conceptual:

```json
{
  "origen": "PETSHOP_CLARION",
  "idVenta": 15487,
  "fecha": "2026-08-24",

  "cliente": {
    "id": 123,
    "nombre": "Juan Perez",
    "tipoDocumento": 80,
    "numeroDocumento": "20123456789",
    "condicionIva": "RESPONSABLE_INSCRIPTO"
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

IMPORTANTE:

Este JSON es todavía conceptual.

No asumir definitivamente los cálculos de IVA hasta analizar cómo Clarion almacena actualmente `PrecioU`, `impuesto`, `porImpuesto` y `Total`.

---

# 12. Respuesta esperada

La API debe devolver una respuesta simple y fácil de consumir desde Clarion.

Ejemplo:

```json
{
  "success": true,
  "idVenta": 15487,

  "comprobante": {
    "codigoTipoComprobante": 6,
    "tipo": "FACTURA_B",

    "puntoVenta": 3,
    "numero": 1287,

    "fechaEmision": "2026-08-24",

    "codigoTipoDocumento": 99,
    "numeroDocumento": "0",

    "importeGravado": 82644.63,
    "importeIva": 17355.37,
    "importeTotal": 100000,

    "cae": "76123456789012",
    "fechaVencimientoCae": "2026-09-03",

    "resultado": "A"
  }
}
```

Clarion utilizará esta respuesta para completar `Comprobantes`.

---

# 13. Idempotencia

Este punto es CRÍTICO.

Nunca se debe generar accidentalmente más de una factura para una misma operación debido a:

- doble click;
- timeout;
- pérdida de Internet;
- Clarion cerrado inesperadamente;
- respuesta de ARCA no recibida por Clarion;
- reintento manual.

La identificación inicial será:

```text
empresa
+
sistema_origen
+
idVenta
```

Por ejemplo:

```text
PETSHOP
PETSHOP_CLARION
15487
```

La API debe poder detectar que esa venta ya fue procesada y devolver el comprobante existente en lugar de generar uno nuevo.

---

# 14. Base propia de la API

Aunque Clarion almacene localmente los comprobantes, la API tendrá su propia base PostgreSQL.

Conceptualmente:

```text
empresas
facturas
factura_items
arca_requests
arca_responses
```

La API debe conservar suficiente información para auditar qué ocurrió ante ARCA.

NO depender exclusivamente de las tablas TOPSPEED de Clarion.

---

# 15. Diseño multiempresa

Aunque inicialmente se utilice solamente para Pet Shop, NO desarrollar la API hardcodeando:

```text
CUIT PET SHOP
punto venta PET SHOP
certificado PET SHOP
```

Crear concepto:

```text
Empresa
```

Cada empresa podrá tener:

```text
id
nombre
razonSocial
cuit
condicionIva
ambienteArca
puntoVenta
certificado
privateKey
activo
```

El objetivo futuro es poder utilizar:

```text
Sistema Pet Shop ─────┐
                      |
Otro sistema Clarion ─┤
                      |
Sistema web ──────────┼──> API Facturación ──> ARCA
                      |
Otro cliente ─────────┘
```

---

# 16. Seguridad

No almacenar secretos ARCA directamente en código fuente.

Utilizar variables de entorno/configuración segura.

Nunca commitear:

- private keys;
- certificados privados;
- contraseñas;
- tokens;
- credenciales ARCA.

Agregar los archivos correspondientes a `.gitignore`.

---

# 17. Impresión

La impresora utilizada será térmica común, no fiscal.

La factura es electrónica.

La representación impresa debe contemplar:

- empresa;
- CUIT;
- tipo de comprobante;
- punto de venta;
- número;
- fecha;
- cliente;
- productos;
- cantidades;
- importes;
- total;
- CAE;
- vencimiento CAE;
- QR correspondiente.

La impresión física ocurrirá desde el entorno local/Clarion.

No intentar acceder desde el VPS directamente al USB de la impresora.

---

# 18. Estrategia de implementación

NO implementar todo simultáneamente.

Trabajar incrementalmente.

## Etapa 1

Crear estructura base:

```text
Node.js
TypeScript
Express
PostgreSQL
Prisma
Docker
```

## Etapa 2

Crear endpoint de prueba:

```http
POST /api/v1/facturas
```

Todavía sin ARCA.

Debe:

1. recibir JSON;
2. validar estructura;
3. registrar operación;
4. devolver respuesta simulada.

Esto permitirá probar primero:

```text
Clarion -> HTTP -> API -> HTTP -> Clarion
```

## Etapa 3

Implementar empresas y configuración fiscal.

## Etapa 4

Implementar autenticación ARCA.

## Etapa 5

Implementar WSFE en homologación.

## Etapa 6

Emitir primera factura real de homologación.

## Etapa 7

Integrar resultado con tablas Clarion:

```text
Comprobantes
Combtes_Items
```

## Etapa 8

Generar representación para ticket térmico.

## Etapa 9

Pruebas completas.

## Etapa 10

Pasar a producción.

---

# 19. Principios para modificar Clarion

El sistema Clarion ya está funcionando en producción.

Por lo tanto:

- realizar cambios mínimos;
- no refactorizar funcionalidades existentes sin necesidad;
- no modificar el circuito de ventas actual;
- reutilizar `notaPedido` y `DetNotaPed`;
- reutilizar `Comprobantes` y `Combtes_Items`;
- agregar la integración como una capa adicional;
- evitar dependencias innecesarias;
- mantener compatibilidad con TOPSPEED.

---

# 20. Estado actual

Actualmente estamos en etapa de análisis.

Ya se identificaron:

```text
notaPedido
DetNotaPed
Comprobantes
Combtes_Items
```

Todavía falta analizar/confirmar:

1. estructura completa de `Cliente`;
2. condición IVA del cliente;
3. estructura relevante de `Producto`;
4. significado exacto de `PrecioU`;
5. significado exacto de `impuesto`;
6. significado exacto de `porImpuesto`;
7. si los precios almacenados incluyen IVA;
8. relación exacta `Comprobantes -> notaPedido`;
9. punto de venta ARCA que utilizará Pet Shop;
10. condición fiscal de Pet Shop;
11. tipos de comprobante necesarios;
12. formato/modelo de impresora térmica.

NO asumir estos datos.

Preguntar antes de implementar lógica fiscal dependiente de ellos.

---

# 21. Objetivo inmediato

El próximo objetivo NO es conectarse todavía a ARCA.

Primero debemos conseguir:

```text
Clarion
   |
   | POST venta
   v
API local
   |
   | valida
   | registra
   v
respuesta JSON
   |
   v
Clarion
```

Una vez validada esta comunicación, avanzar con la integración fiscal.

## Instrucción para el agente

Antes de generar código:

1. analizar este contexto;
2. inspeccionar el repositorio existente;
3. identificar si existe infraestructura reutilizable;
4. no asumir datos fiscales que estén marcados como pendientes;
5. proponer el cambio mínimo necesario para la etapa actual;
6. explicar qué archivos se crearán o modificarán;
7. esperar confirmación antes de realizar cambios estructurales importantes.

Priorizar simplicidad, mantenibilidad, seguridad e implementación incremental.
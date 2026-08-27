# Contrato Clarion -> API de Facturacion

Version: borrador 0.1

Estado: contrato para pruebas locales/simuladas. Todavia no emite comprobantes en AFIP/ARCA.

## Objetivo

Definir el JSON que Clarion debe enviar a la API para solicitar la facturacion de una venta existente, manteniendo la venta original en `notaPedido` y `DetNotaPed`.

## Endpoint

```http
POST /api/v1/facturas
Content-Type: application/json
```

## Idempotencia

La API identifica una venta facturada con:

```text
empresa + origen + idVenta
```

Por eso, Clarion debe enviar siempre el mismo `idVenta` para la misma `notaPedido`.

Si Clarion reintenta el POST por timeout, doble click o corte de conexion, la API debe devolver la factura ya registrada en lugar de crear otra.

## Payload requerido

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

## Campos de cabecera

| Campo | Tipo | Obligatorio | Descripcion |
| --- | --- | --- | --- |
| `empresa` | string | no | Codigo interno de empresa. Default actual: `PETSHOP`. |
| `origen` | string | si | Sistema origen. Para Clarion usar `PETSHOP_CLARION`. |
| `idVenta` | string/number | si | Identificador estable de la venta en Clarion. Inicialmente `notaPedido.idNotaP`. |
| `fecha` | string | si | Fecha de la venta/comprobante en formato `YYYY-MM-DD`. |

## Comprobante

| Campo | Tipo | Obligatorio | Descripcion |
| --- | --- | --- | --- |
| `comprobante.codigoTipoComprobante` | number | si | Codigo AFIP del tipo de comprobante a emitir. |
| `comprobante.tipo` | string | no | Etiqueta descriptiva para lectura humana. No debe usarse como fuente fiscal principal. |

Codigos habituales:

| Codigo | Tipo |
| --- | --- |
| `1` | Factura A |
| `6` | Factura B |
| `11` | Factura C |
| `3` | Nota de Credito A |
| `8` | Nota de Credito B |
| `13` | Nota de Credito C |

Regla: Clarion debe decidir el tipo de comprobante segun condicion fiscal de empresa, cliente y operacion. La API validara compatibilidad antes de emitir.

## Cliente

| Campo | Tipo | Obligatorio | Descripcion |
| --- | --- | --- | --- |
| `cliente.id` | string/number | no | ID interno de Cliente en Clarion. |
| `cliente.nombre` | string | si | Nombre o razon social del cliente. |
| `cliente.tipoDocumento` | number | si | Codigo AFIP de documento. |
| `cliente.numeroDocumento` | string | si | Numero de documento sin guiones. |
| `cliente.condicionIva` | string | no | Condicion IVA si Clarion la conoce. |
| `cliente.condicionIvaReceptorId` | number | no | Codigo AFIP de condicion IVA del receptor. Requerido para emision real. |

Codigos de documento habituales:

| Codigo | Documento |
| --- | --- |
| `80` | CUIT |
| `86` | CUIL |
| `96` | DNI |
| `99` | Consumidor Final / Sin identificar |

Codigos habituales de condicion IVA receptor:

| Codigo | Condicion |
| --- | --- |
| `1` | IVA Responsable Inscripto |
| `4` | IVA Sujeto Exento |
| `5` | Consumidor Final |
| `6` | Responsable Monotributo |
| `15` | IVA No Alcanzado |

## Venta

| Campo | Tipo | Obligatorio | Descripcion |
| --- | --- | --- | --- |
| `venta.subtotal` | number | si | Subtotal informado por Clarion. Pendiente confirmar si es neto gravado o subtotal con IVA. |
| `venta.descuento` | number | no | Descuento total de la venta. Default `0`. |
| `venta.recargo` | number | no | Recargo total de la venta. Default `0`. |
| `venta.total` | number | si | Total final de la venta. |

No se debe asumir todavia si `subtotal` y `precioUnitario` incluyen IVA. Este punto debe confirmarse con datos reales de Clarion.

## Items

| Campo | Tipo | Obligatorio | Descripcion |
| --- | --- | --- | --- |
| `items[].idProducto` | string/number | no | ID interno de Producto en Clarion. |
| `items[].codigo` | string | no | Codigo interno o SKU. |
| `items[].descripcion` | string | si | Descripcion que saldra en el comprobante/ticket. |
| `items[].cantidad` | number | si | Cantidad vendida. Debe ser mayor a `0`. |
| `items[].precioUnitario` | number | si | Precio unitario informado por Clarion. Pendiente confirmar si incluye IVA. |
| `items[].alicuotaIva` | number | no | Alicuota IVA: `0`, `10.5`, `21`, etc. |
| `items[].importeTotal` | number | si | Total del renglon informado por Clarion. |

## Respuesta exitosa simulada

```json
{
  "success": true,
  "idVenta": 15487,
  "comprobante": {
    "codigoTipoComprobante": 6,
    "tipo": "FACTURA_B",
    "puntoVenta": 3,
    "numero": 1,
    "fechaEmision": "2026-08-24",
    "codigoTipoDocumento": 80,
    "numeroDocumento": "20123456789",
    "importeGravado": 82644.63,
    "importeIva": 17355.37,
    "importeTotal": 100000,
    "cae": "00000000000000",
    "fechaVencimientoCae": "2026-08-24",
    "resultado": "SIMULADO"
  },
  "idempotente": false
}
```

## Respuesta de emision para Clarion

Cuando la emision homologacion es autorizada, la API devuelve el bloque `comprobante` y ademas un bloque plano `clarion` pensado para completar `Comprobantes`.

```json
{
  "success": true,
  "idVenta": 11458,
  "comprobante": {
    "codigoTipoComprobante": 6,
    "tipo": "FACTURA_B",
    "puntoVenta": 4,
    "numero": 1,
    "fechaEmision": "2026-08-25",
    "codigoTipoDocumento": 99,
    "numeroDocumento": "0",
    "importeGravado": 4462.81,
    "importeIva": 937.19,
    "importeTotal": 5400,
    "cae": "86340803813797",
    "fechaVencimientoCae": "2026-09-04",
    "resultado": "A",
    "qrUrl": "https://www.afip.gob.ar/fe/qr/?p=..."
  },
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
    "CAE": "86340803813797",
    "FechaVencimientoCAE": "2026-09-04",
    "QRUrl": "https://www.afip.gob.ar/fe/qr/?p=..."
  },
  "idempotente": false
}
```

Mapeo sugerido a `Comprobantes`:

| Respuesta `clarion` | Tabla `Comprobantes` |
| --- | --- |
| `CodigoTipoComprobante` | `CodigoTipoComprobante` |
| `NumeroPuntoVenta` | `NumeroPuntoVenta` |
| `NumeroComprobante` | `NumeroComprobante` |
| `FechaEmision` | `FechaEmision` |
| `CodigoTipoDocumento` | `CodigoTipoDocumento` |
| `NumeroDocumento` | `NumeroDocumento` |
| `ImporteGravado` | `ImporteGravado` |
| `ImporteNoGravado` | `ImporteNoGravado` |
| `ImporteExento` | `ImporteExento` |
| `ImporteIva` | `ImporteIva` |
| `ImporteSubTotal` | `ImporteSubTotal` |
| `ImporteOtrosTributos` | `ImporteOtrosTributos` |
| `ImporteTotal` | `ImporteTotal` |
| `CodigoMoneda` | `CodigoMoneda` |
| `CotizacionMoneda` | `CotizacionMoneda` |
| `CodigoConcepto` | `CodigoConcepto` |
| `Resultado` | `Resultado` |
| `CAE` | `CAE` |
| `FechaVencimientoCAE` | `FechaVencimientoCAE` |
| `QRUrl` | URL fiscal para generar/imprimir QR |
| `ID_NotaP` | referencia a `notaPedido.idNotaP` o `Combtes_Items.ID_NotaP` |

## Respuesta idempotente

Si la venta ya fue registrada, la API devuelve `200` con el mismo comprobante y:

```json
{
  "idempotente": true
}
```

## Errores actuales

Payload invalido:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    {
      "path": "cliente.nombre",
      "message": "Required"
    }
  ]
}
```

Factura no encontrada en consulta:

```json
{
  "success": false,
  "error": "FACTURA_NOT_FOUND"
}
```

## Ejemplo Factura A

```json
{
  "empresa": "PETSHOP",
  "origen": "PETSHOP_CLARION",
  "idVenta": 15488,
  "fecha": "2026-08-24",
  "comprobante": {
    "codigoTipoComprobante": 1,
    "tipo": "FACTURA_A"
  },
  "cliente": {
    "id": 456,
    "nombre": "Cliente Responsable Inscripto SA",
    "tipoDocumento": 80,
    "numeroDocumento": "30700000001",
    "condicionIva": "RESPONSABLE_INSCRIPTO"
  },
  "venta": {
    "subtotal": 100000,
    "descuento": 0,
    "recargo": 0,
    "total": 121000
  },
  "items": [
    {
      "idProducto": 25,
      "codigo": "ALIM001",
      "descripcion": "Alimento balanceado",
      "cantidad": 2,
      "precioUnitario": 50000,
      "alicuotaIva": 21,
      "importeTotal": 121000
    }
  ]
}
```

## Ejemplo Factura B

```json
{
  "empresa": "PETSHOP",
  "origen": "PETSHOP_CLARION",
  "idVenta": 15489,
  "fecha": "2026-08-24",
  "comprobante": {
    "codigoTipoComprobante": 6,
    "tipo": "FACTURA_B"
  },
  "cliente": {
    "id": 789,
    "nombre": "Consumidor Final",
    "tipoDocumento": 99,
    "numeroDocumento": "0",
    "condicionIva": "CONSUMIDOR_FINAL"
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

## Pendientes para cerrar contrato

1. Confirmar si `notaPedido.idNotaP` sera siempre `idVenta`.
2. Confirmar formato real de fecha que Clarion puede enviar.
3. Confirmar de donde sale `codigoTipoComprobante` en Clarion.
4. Confirmar si `PrecioU` incluye IVA.
5. Confirmar significado exacto de `impuesto` y `porImpuesto` en `DetNotaPed`.
6. Confirmar si `DetNotaPed.Total` es total con IVA, neto o total del renglon.
7. Confirmar si los descuentos se aplican por item, por venta o ambos.
8. Confirmar como se identifica consumidor final.
9. Confirmar donde esta guardado CUIT/DNI del cliente y condicion IVA.
10. Confirmar si hay productos exentos/no gravados o todos usan IVA general.
11. Confirmar si se emitiran notas de credito/debito desde la misma API.
12. Confirmar si Clarion enviara punto de venta o si la API lo toma de configuracion por empresa.

## Decision actual

Para el desarrollo inmediato, Clarion enviara `codigoTipoComprobante` y la API usara el punto de venta configurado por empresa. La emision real quedara bloqueada hasta validar los calculos fiscales con ventas reales.

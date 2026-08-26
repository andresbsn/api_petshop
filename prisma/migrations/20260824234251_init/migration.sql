-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "cuit" TEXT,
    "condicionIva" TEXT,
    "ambienteArca" TEXT,
    "puntoVenta" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "idVenta" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'SIMULADA',
    "idempotencyKey" TEXT NOT NULL,
    "codigoTipoComprobante" INTEGER NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "numeroComprobante" INTEGER NOT NULL,
    "codigoTipoDocumento" INTEGER NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "importeGravado" DECIMAL(14,2) NOT NULL,
    "importeIva" DECIMAL(14,2) NOT NULL,
    "importeTotal" DECIMAL(14,2) NOT NULL,
    "cae" TEXT NOT NULL,
    "fechaVencimientoCae" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "payloadOriginal" JSONB NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_items" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "renglon" INTEGER NOT NULL,
    "idProducto" TEXT,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "alicuotaIva" DECIMAL(5,2),
    "importeTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "factura_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arca_requests" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "servicio" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arca_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arca_responses" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "servicio" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arca_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_codigo_key" ON "empresas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_idempotencyKey_key" ON "facturas"("idempotencyKey");

-- CreateIndex
CREATE INDEX "facturas_origen_idVenta_idx" ON "facturas"("origen", "idVenta");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_empresaId_origen_idVenta_key" ON "facturas"("empresaId", "origen", "idVenta");

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arca_requests" ADD CONSTRAINT "arca_requests_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arca_responses" ADD CONSTRAINT "arca_responses_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

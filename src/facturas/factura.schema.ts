import { ZodError, z } from "zod";

export const facturaRequestSchema = z.object({
  empresa: z.string().min(1).default("PETSHOP"),
  origen: z.string().min(1),
  idVenta: z.union([z.string().min(1), z.number().int().positive()]),
  fecha: z.string().min(1),
  comprobante: z.object({
    codigoTipoComprobante: z.number().int().positive(),
    tipo: z.string().min(1).optional(),
    puntoVenta: z.number().int().positive().optional()
  }),
  cliente: z.object({
    id: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    nombre: z.string().min(1),
    tipoDocumento: z.number().int().nonnegative(),
    numeroDocumento: z.string().min(1),
    condicionIva: z.string().min(1).optional(),
    condicionIvaReceptorId: z.number().int().positive().optional()
  }),
  venta: z.object({
    subtotal: z.number().nonnegative(),
    descuento: z.number().nonnegative().default(0),
    recargo: z.number().nonnegative().default(0),
    total: z.number().nonnegative()
  }),
  items: z.array(
    z.object({
      idProducto: z.union([z.string().min(1), z.number().int().positive()]).optional(),
      codigo: z.string().min(1).optional(),
      descripcion: z.string().min(1),
      cantidad: z.number().positive(),
      precioUnitario: z.number().nonnegative(),
      alicuotaIva: z.number().nonnegative().optional(),
      importeTotal: z.number().nonnegative()
    })
  ).min(1)
});

export type FacturaRequest = z.infer<typeof facturaRequestSchema>;

export function formatValidationError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

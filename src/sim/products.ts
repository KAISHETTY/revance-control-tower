import type { Product } from "./types";

/**
 * Brand names are from public sources and used as plain text only. SKUs, pack
 * variants, prices and shelf lives are synthetic. Nothing here says which
 * products need temperature control: that is assigned at random per lot.
 */
export const PRODUCTS: readonly Product[] = [
  { sku: "AES-DXF-1", name: "DAXXIFY", category: "Aesthetics", unitPrice: 590, shelfLifeDays: 730 },
  { sku: "AES-DXF-2", name: "DAXXIFY (clinic pack)", category: "Aesthetics", unitPrice: 1150, shelfLifeDays: 730 },
  {
    sku: "AES-RHA-1",
    name: "RHA Collection filler",
    category: "Aesthetics",
    unitPrice: 310,
    shelfLifeDays: 540,
    note: "Distributed in the US via a partner",
  },
  {
    sku: "AES-RHA-2",
    name: "RHA Collection filler (clinic pack)",
    category: "Aesthetics",
    unitPrice: 1180,
    shelfLifeDays: 540,
    note: "Distributed in the US via a partner",
  },
  { sku: "DEV-SKP-1", name: "SkinPen microneedling kit", category: "Device", unitPrice: 95, shelfLifeDays: 1095 },
  { sku: "DEV-SKP-10", name: "SkinPen microneedling kit (10-pack)", category: "Device", unitPrice: 850, shelfLifeDays: 1095 },
  { sku: "CON-PNX-1", name: "PanOxyl", category: "Consumer skincare", unitPrice: 9, shelfLifeDays: 1000 },
  { sku: "CON-BLZ-1", name: "Blue Lizard", category: "Consumer skincare", unitPrice: 11, shelfLifeDays: 1000 },
  { sku: "CON-STV-1", name: "StriVectin", category: "Consumer skincare", unitPrice: 38, shelfLifeDays: 950 },
  { sku: "CON-BJV-1", name: "BIOJUVE", category: "Consumer skincare", unitPrice: 52, shelfLifeDays: 900 },
  { sku: "CON-SRN-1", name: "Sarna", category: "Consumer skincare", unitPrice: 8, shelfLifeDays: 1100 },
];

const BY_SKU = new Map(PRODUCTS.map((p) => [p.sku, p]));

export function productBySku(sku: string): Product {
  const p = BY_SKU.get(sku);
  if (!p) throw new Error(`Unknown SKU ${sku}`);
  return p;
}

export function productName(sku: string): string {
  return BY_SKU.get(sku)?.name ?? sku;
}

import type { Product } from "./types";

/** Generic catalog. Prices are synthetic wholesale prices per unit. */
export const PRODUCTS: readonly Product[] = [
  { sku: "NT-100", name: "Neurotoxin 100U Vial", category: "Injectable", unitPrice: 610, coldChain: true, shelfLifeDays: 730 },
  { sku: "NT-050", name: "Neurotoxin 50U Vial", category: "Injectable", unitPrice: 330, coldChain: true, shelfLifeDays: 730 },
  { sku: "DF-100", name: "Dermal Filler 1mL", category: "Injectable", unitPrice: 320, coldChain: true, shelfLifeDays: 540 },
  { sku: "DFL-100", name: "Dermal Filler Lidocaine 1mL", category: "Injectable", unitPrice: 340, coldChain: true, shelfLifeDays: 365 },
  { sku: "MN-001", name: "Microneedling Kit (Single)", category: "Device Kit", unitPrice: 95, coldChain: false, shelfLifeDays: 1095 },
  { sku: "MN-010", name: "Microneedling Kit (10-pack)", category: "Device Kit", unitPrice: 850, coldChain: false, shelfLifeDays: 1095 },
  { sku: "AG-006", name: "Acne Gel Wash 6oz", category: "Skincare", unitPrice: 28, coldChain: false, shelfLifeDays: 1000 },
  { sku: "AT-002", name: "Acne Treatment Cream", category: "Skincare", unitPrice: 36, coldChain: false, shelfLifeDays: 900 },
  { sku: "SS-050", name: "Mineral Sunscreen SPF 50", category: "Skincare", unitPrice: 32, coldChain: false, shelfLifeDays: 1000 },
  { sku: "AS-008", name: "After-Sun Lotion", category: "Skincare", unitPrice: 24, coldChain: false, shelfLifeDays: 1100 },
  { sku: "BR-030", name: "Barrier Repair Serum", category: "Skincare", unitPrice: 58, coldChain: false, shelfLifeDays: 950 },
  { sku: "AN-050", name: "Anti-Aging Night Cream", category: "Skincare", unitPrice: 72, coldChain: false, shelfLifeDays: 1050 },
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

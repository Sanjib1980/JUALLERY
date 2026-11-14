export interface MetalRateItem {
  id?: string;
  material: string;
  purity: string;
  ratePerGram: string | number;
  effectiveFrom?: string | Date;
}

export interface ProductImageItem {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductItem {
  id: string;
  productCode: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  material: string;
  purity: string;
  weightGrams: string | number;
  useLiveMetalRate: boolean;
  fixedBasePrice: string | number;
  makingCharges: string | number;
  stoneCharges: string | number;
  gstPercent: string | number;
  stockQty: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  isBridal: boolean;
  offerPercent: string | number;
  isActive: boolean;
  categoryName?: string;
  categorySlug?: string;
  images?: ProductImageItem[];
  avgRating?: number;
  reviewCount?: number;
}

export interface PriceBreakdown {
  ratePerGram: number;
  metalValue: number;
  makingCharges: number;
  stoneCharges: number;
  discount: number;
  taxableValue: number;
  gstAmount: number;
  finalPrice: number;
}

export function calculateJewelleryPrice(
  product: Pick<
    ProductItem,
    | 'material'
    | 'purity'
    | 'weightGrams'
    | 'useLiveMetalRate'
    | 'fixedBasePrice'
    | 'makingCharges'
    | 'stoneCharges'
    | 'gstPercent'
    | 'offerPercent'
  >,
  rates: MetalRateItem[]
): PriceBreakdown {
  const weight = Number(product.weightGrams) || 0;
  const making = Number(product.makingCharges) || 0;
  const stone = Number(product.stoneCharges) || 0;
  const gstPct = Number(product.gstPercent) || 0;
  const offerPct = Number(product.offerPercent) || 0;

  let ratePerGram = 0;
  let metalValue = Number(product.fixedBasePrice) || 0;

  if (product.useLiveMetalRate) {
    const matched = rates.find(
      (r) =>
        r.material.toLowerCase() === product.material.toLowerCase() &&
        r.purity.toLowerCase() === product.purity.toLowerCase()
    );
    ratePerGram = matched ? Number(matched.ratePerGram) : 0;
    metalValue = Number((weight * ratePerGram).toFixed(2));
  }

  const subtotalBeforeDiscount = metalValue + making + stone;
  const discount = Number(((subtotalBeforeDiscount * offerPct) / 100).toFixed(2));
  const taxableValue = Math.max(Number((subtotalBeforeDiscount - discount).toFixed(2)), 0);
  const gstAmount = Number(((taxableValue * gstPct) / 100).toFixed(2));
  const finalPrice = Number((taxableValue + gstAmount).toFixed(2));

  return {
    ratePerGram,
    metalValue,
    makingCharges: making,
    stoneCharges: stone,
    discount,
    taxableValue,
    gstAmount,
    finalPrice,
  };
}

export function formatINR(value: number | string): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.ts';
import {
  categories,
  metalRates,
  productImages,
  products,
  siteSettings,
} from './schema.ts';

export async function seedInitialDatabase() {
  // 1. Site Settings
  await db
    .insert(siteSettings)
    .values({
      id: 1,
      brandName: 'Aurelia Heritage Jewels',
      tagline: 'Timeless Craftsmanship in Gold, Diamond & Silver',
      gstin: '27AABCA9603R1ZM',
      supportEmail: 'concierge@aureliajewels.com',
      supportPhone: '+91 98765 43210',
      headquartersAddress: 'Zaveri Bazaar Heritage Arcade, Mumbai 400002',
      upiId: 'aureliajewels@icici',
      bankDetails: 'Aurelia Jewels Pvt Ltd | A/C: 001122334455 | IFSC: ICIC0000011',
      defaultDeliveryCharge: '250.00',
      freeDeliveryThreshold: '25000.00',
      heroBannerTitle: 'The Royal Bridal & Heritage Edit',
      heroBannerSubtitle: 'BIS Hallmarked 22K Gold, 925 Sterling Silver & Certified Solitaires',
    })
    .onConflictDoNothing({ target: siteSettings.id });

  // 2. Categories
  const categorySeeds = [
    {
      name: 'Necklace',
      slug: 'necklace',
      description: 'Handcrafted chokers, rani haars, and heirloom gold necklaces',
      imageUrl: '/src/assets/images/necklace_royal_gold_1794651704151.jpg',
      sortOrder: 1,
    },
    {
      name: 'Earrings',
      slug: 'earrings',
      description: 'Artisanal jhumkas, chandbalis, and solitaire studs',
      imageUrl: '/src/assets/images/earrings_chandbali_gold_1794651704939.jpg',
      sortOrder: 2,
    },
    {
      name: 'Rings',
      slug: 'rings',
      description: 'Certified diamond solitaires and timeless gold bands',
      imageUrl: '/src/assets/images/ring_diamond_solitaire_1794651705553.jpg',
      sortOrder: 3,
    },
    {
      name: 'Bangles',
      slug: 'bangles',
      description: 'Carved 22K gold kadas and 925 sterling silver filigree bangles',
      imageUrl: '/src/assets/images/bangles_heritage_pair_1794651705194.jpg',
      sortOrder: 4,
    },
    {
      name: 'Bridal Collection',
      slug: 'bridal-collection',
      description: 'Curated wedding trousseaus in uncut polki and 22K gold',
      imageUrl: '/src/assets/images/hero_bridal_jewellery_1794651704752.jpg',
      sortOrder: 5,
    },
  ];

  for (const cat of categorySeeds) {
    await db
      .insert(categories)
      .values(cat)
      .onConflictDoNothing({ target: categories.slug });
  }

  const allCategories = await db.select().from(categories);
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  // 3. Baseline Live Metal Rates
  const rateSeeds = [
    { material: 'Gold', purity: '24K', ratePerGram: '7850.00' },
    { material: 'Gold', purity: '22K', ratePerGram: '7200.00' },
    { material: 'Gold', purity: '18K', ratePerGram: '5900.00' },
    { material: 'Silver', purity: '925 Silver', ratePerGram: '98.00' },
  ];

  for (const r of rateSeeds) {
    await db
      .insert(metalRates)
      .values(r)
      .onConflictDoNothing({ target: [metalRates.material, metalRates.purity] });
  }

  // 4. Initial Jewellery Products & Images
  const productSeeds = [
    {
      productCode: 'JWL-1001',
      categorySlug: 'bridal-collection',
      name: 'Maharani Polki Bridal Necklace Set',
      slug: 'maharani-polki-bridal-necklace-set',
      description:
        'Heirloom 22K BIS hallmarked gold bridal haar handcrafted with uncut syndicate polki diamonds, baroque pearl drops, and matching chandbali earrings.',
      material: 'Gold',
      purity: '22K',
      weightGrams: '48.500',
      useLiveMetalRate: true,
      fixedBasePrice: '0.00',
      makingCharges: '24000.00',
      stoneCharges: '45000.00',
      gstPercent: '3.00',
      stockQty: 4,
      lowStockThreshold: 3,
      isFeatured: true,
      isBridal: true,
      offerPercent: '0.00',
      images: [
        '/src/assets/images/hero_bridal_jewellery_1794651704752.jpg',
        '/src/assets/images/necklace_royal_gold_1794651704151.jpg',
      ],
    },
    {
      productCode: 'JWL-1002',
      categorySlug: 'necklace',
      name: 'Rajputana Ruby Filigree Gold Choker',
      slug: 'rajputana-ruby-filigree-gold-choker',
      description:
        'Intricate 22K yellow gold filigree collar choker studded with Burmese cabochon rubies and hand-engraved floral motifs.',
      material: 'Gold',
      purity: '22K',
      weightGrams: '26.400',
      useLiveMetalRate: true,
      fixedBasePrice: '0.00',
      makingCharges: '15500.00',
      stoneCharges: '18000.00',
      gstPercent: '3.00',
      stockQty: 6,
      lowStockThreshold: 3,
      isFeatured: true,
      isBridal: true,
      offerPercent: '5.00',
      images: ['/src/assets/images/necklace_royal_gold_1794651704151.jpg'],
    },
    {
      productCode: 'JWL-1003',
      categorySlug: 'earrings',
      name: 'Noor Pearl Drop Chandbali Jhumkas',
      slug: 'noor-pearl-drop-chandbali-jhumkas',
      description:
        'Classic crescent chandbali jhumkas in 22K gold finished with fine granulation work and natural freshwater pearl clusters.',
      material: 'Gold',
      purity: '22K',
      weightGrams: '14.200',
      useLiveMetalRate: true,
      fixedBasePrice: '0.00',
      makingCharges: '8200.00',
      stoneCharges: '4500.00',
      gstPercent: '3.00',
      stockQty: 8,
      lowStockThreshold: 3,
      isFeatured: true,
      isBridal: false,
      offerPercent: '0.00',
      images: ['/src/assets/images/earrings_chandbali_gold_1794651704939.jpg'],
    },
    {
      productCode: 'JWL-1004',
      categorySlug: 'rings',
      name: 'Celeste Pave Solitaire Diamond Ring',
      slug: 'celeste-pave-solitaire-diamond-ring',
      description:
        'IGI-certified VVS-EF 1.05 ct round brilliant solitaire set in 18K yellow gold with micro-pave diamond gallery shoulders.',
      material: 'Diamond',
      purity: 'VVS-EF',
      weightGrams: '4.800',
      useLiveMetalRate: false,
      fixedBasePrice: '85000.00',
      makingCharges: '12000.00',
      stoneCharges: '68000.00',
      gstPercent: '3.00',
      stockQty: 5,
      lowStockThreshold: 3,
      isFeatured: true,
      isBridal: false,
      offerPercent: '10.00',
      images: ['/src/assets/images/ring_diamond_solitaire_1794651705553.jpg'],
    },
    {
      productCode: 'JWL-1005',
      categorySlug: 'bangles',
      name: 'Udaipur Carved Heritage Gold Kadas (Pair)',
      slug: 'udaipur-carved-heritage-gold-kadas',
      description:
        'Deep-relief floral nakshi carved 22K gold hinged kadas crafted as an heirloom bridal bangle pair.',
      material: 'Gold',
      purity: '22K',
      weightGrams: '32.000',
      useLiveMetalRate: true,
      fixedBasePrice: '0.00',
      makingCharges: '18000.00',
      stoneCharges: '0.00',
      gstPercent: '3.00',
      stockQty: 2,
      lowStockThreshold: 3,
      isFeatured: true,
      isBridal: true,
      offerPercent: '0.00',
      images: ['/src/assets/images/bangles_heritage_pair_1794651705194.jpg'],
    },
    {
      productCode: 'JWL-1006',
      categorySlug: 'bangles',
      name: 'Jaipur Sterling Filigree Silver Bangles',
      slug: 'jaipur-sterling-filigree-silver-bangles',
      description:
        'Hand-woven 925 sterling silver jaali filigree bangle pair with rhodium anti-tarnish lustre.',
      material: 'Silver',
      purity: '925 Silver',
      weightGrams: '42.000',
      useLiveMetalRate: true,
      fixedBasePrice: '0.00',
      makingCharges: '3200.00',
      stoneCharges: '0.00',
      gstPercent: '3.00',
      stockQty: 14,
      lowStockThreshold: 3,
      isFeatured: false,
      isBridal: false,
      offerPercent: '15.00',
      images: ['/src/assets/images/bangles_heritage_pair_1794651705194.jpg'],
    },
  ];

  for (const item of productSeeds) {
    const categoryId = categoryBySlug.get(item.categorySlug);
    if (!categoryId) continue;

    await db
      .insert(products)
      .values({
        productCode: item.productCode,
        categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        material: item.material,
        purity: item.purity,
        weightGrams: item.weightGrams,
        useLiveMetalRate: item.useLiveMetalRate,
        fixedBasePrice: item.fixedBasePrice,
        makingCharges: item.makingCharges,
        stoneCharges: item.stoneCharges,
        gstPercent: item.gstPercent,
        stockQty: item.stockQty,
        lowStockThreshold: item.lowStockThreshold,
        isFeatured: item.isFeatured,
        isBridal: item.isBridal,
        offerPercent: item.offerPercent,
        isActive: true,
      })
      .onConflictDoNothing({ target: products.productCode });

    const [prodRow] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.productCode, item.productCode))
      .limit(1);

    if (prodRow) {
      const existingImgs = await db
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, prodRow.id))
        .limit(1);

      if (existingImgs.length === 0) {
        await db.insert(productImages).values(
          item.images.map((url, idx) => ({
            productId: prodRow.id,
            imageUrl: url,
            isPrimary: idx === 0,
            sortOrder: idx,
          }))
        );
      }
    }
  }

  console.log('Seed completed: site_settings, categories, metal_rates, and products verified.');
}

// Execute when run directly via `tsx src/db/seed.ts`
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('seed.ts');

if (isDirectRun) {
  seedInitialDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Database seed failed:', err);
      await pool.end();
      process.exit(1);
    });
}

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: text('firebase_uid').unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  mobile: text('mobile').notNull().default(''),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('customer'), // 'customer' | 'shopkeeper' | 'super_admin'
    permissions: jsonb('permissions').$type<Record<string, boolean>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_roles_user_role_idx').on(table.userId, table.role)]
);

export const shopkeepers = pgTable('shopkeepers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  shopName: text('shop_name').notNull(),
  gstin: text('gstin'),
  shopAddress: text('shop_address').notNull().default(''),
  contactNumber: text('contact_number').notNull().default(''),
  logoUrl: text('logo_url'),
  isVerified: boolean('is_verified').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  brandName: text('brand_name').notNull().default('Aurelia Heritage Jewels'),
  tagline: text('tagline').notNull().default('Timeless Craftsmanship in Gold, Diamond & Silver'),
  gstin: text('gstin').notNull().default('27AABCA9603R1ZM'),
  supportEmail: text('support_email').notNull().default('concierge@aureliajewels.com'),
  supportPhone: text('support_phone').notNull().default('+91 98765 43210'),
  headquartersAddress: text('headquarters_address')
    .notNull()
    .default('Zaveri Bazaar Heritage Arcade, Mumbai 400002'),
  upiId: text('upi_id').notNull().default('aureliajewels@icici'),
  bankDetails: text('bank_details')
    .notNull()
    .default('Aurelia Jewels Pvt Ltd | A/C: 001122334455 | IFSC: ICIC0000011'),
  defaultDeliveryCharge: numeric('default_delivery_charge', { precision: 10, scale: 2 })
    .notNull()
    .default('250.00'),
  freeDeliveryThreshold: numeric('free_delivery_threshold', { precision: 10, scale: 2 })
    .notNull()
    .default('25000.00'),
  heroBannerTitle: text('hero_banner_title')
    .notNull()
    .default('The Royal Bridal & Heritage Edit'),
  heroBannerSubtitle: text('hero_banner_subtitle')
    .notNull()
    .default('BIS Hallmarked 22K Gold, 925 Sterling Silver & Certified Solitaires'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const metalRates = pgTable(
  'metal_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopkeeperId: uuid('shopkeeper_id').references(() => shopkeepers.id, { onDelete: 'set null' }),
    material: text('material').notNull(), // 'Gold' | 'Silver' | 'Diamond' | 'Artificial'
    purity: text('purity').notNull(), // '24K', '22K', '18K', '925 Silver'
    ratePerGram: numeric('rate_per_gram', { precision: 12, scale: 2 }).notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (table) => [uniqueIndex('metal_rates_material_purity_idx').on(table.material, table.purity)]
);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  productCode: text('product_code').notNull().unique(),
  shopkeeperId: uuid('shopkeeper_id').references(() => shopkeepers.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  material: text('material').notNull(), // 'Gold' | 'Silver' | 'Diamond' | 'Artificial'
  purity: text('purity').notNull(),
  weightGrams: numeric('weight_grams', { precision: 10, scale: 3 }).notNull().default('0.000'),
  useLiveMetalRate: boolean('use_live_metal_rate').notNull().default(true),
  fixedBasePrice: numeric('fixed_base_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  makingCharges: numeric('making_charges', { precision: 12, scale: 2 }).notNull().default('0.00'),
  stoneCharges: numeric('stone_charges', { precision: 12, scale: 2 }).notNull().default('0.00'),
  gstPercent: numeric('gst_percent', { precision: 5, scale: 2 }).notNull().default('3.00'),
  stockQty: integer('stock_qty').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(3),
  isFeatured: boolean('is_featured').notNull().default(false),
  isBridal: boolean('is_bridal').notNull().default(false),
  offerPercent: numeric('offer_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const carts = pgTable('carts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('cart_items_cart_product_idx').on(table.cartId, table.productId)]
);

export const wishlists = pgTable(
  'wishlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('wishlists_user_product_idx').on(table.userId, table.productId)]
);

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default('Home'),
  recipientName: text('recipient_name').notNull(),
  mobile: text('mobile').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  country: text('country').notNull().default('India'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  shopkeeperId: uuid('shopkeeper_id').references(() => shopkeepers.id, { onDelete: 'set null' }),
  addressSnapshot: jsonb('address_snapshot').$type<Record<string, unknown>>().notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  gstTotal: numeric('gst_total', { precision: 12, scale: 2 }).notNull(),
  deliveryCharge: numeric('delivery_charge', { precision: 12, scale: 2 }).notNull().default('0.00'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).notNull().default('0.00'),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull().default('New Order'),
  customerNotes: text('customer_notes'),
  rejectionReason: text('rejection_reason'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  material: text('material').notNull(),
  purity: text('purity').notNull(),
  weightGrams: numeric('weight_grams', { precision: 10, scale: 3 }).notNull(),
  metalRateApplied: numeric('metal_rate_applied', { precision: 12, scale: 2 }).notNull(),
  makingCharges: numeric('making_charges', { precision: 12, scale: 2 }).notNull(),
  stoneCharges: numeric('stone_charges', { precision: 12, scale: 2 }).notNull(),
  gstAmount: numeric('gst_amount', { precision: 12, scale: 2 }).notNull(),
  unitFinalPrice: numeric('unit_final_price', { precision: 12, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  method: text('method').notNull(), // 'COD' | 'UPI' | 'QR Code' | 'Online Gateway' | 'Bank Transfer'
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Paid' | 'Failed' | 'Refunded'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  transactionReference: text('transaction_reference'),
  proofImageUrl: text('proof_image_url'),
  verifiedBy: uuid('verified_by').references(() => profiles.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  receiptNumber: text('receipt_number').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliveries = pgTable('deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  deliveryAddress: jsonb('delivery_address').$type<Record<string, unknown>>().notNull(),
  customerMobile: text('customer_mobile').notNull(),
  deliveryCharges: numeric('delivery_charges', { precision: 10, scale: 2 }).notNull().default('0.00'),
  partnerName: text('partner_name'),
  partnerMobile: text('partner_mobile'),
  trackingNumber: text('tracking_number'),
  dispatchDate: text('dispatch_date'),
  expectedDeliveryDate: text('expected_delivery_date'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  deliveryStatus: text('delivery_status').notNull().default('Pending Dispatch'),
  updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  shopSnapshot: jsonb('shop_snapshot').$type<Record<string, unknown>>().notNull(),
  customerSnapshot: jsonb('customer_snapshot').$type<Record<string, unknown>>().notNull(),
  taxSummary: jsonb('tax_summary').$type<Record<string, unknown>>().notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('reviews_product_customer_idx').on(table.productId, table.customerId)]
);

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('order'),
  link: text('link'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('Open'),
  adminReply: text('admin_reply'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'set null' }),
  mimeType: text('mime_type').notNull(),
  filename: text('filename').notNull(),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable('password_resets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import bcrypt from 'bcryptjs';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  addresses,
  cartItems,
  carts,
  categories,
  customers,
  deliveries,
  invoices,
  mediaAssets,
  metalRates,
  notifications,
  orderItems,
  orders,
  passwordResets,
  payments,
  productImages,
  products,
  profiles,
  reviews,
  shopkeepers,
  siteSettings,
  supportTickets,
  userRoles,
  wishlists,
} from './src/db/schema.ts';
import {
  type AuthRequest,
  loadAuthUserById,
  requireAuth,
  requireStaff,
  requireSuperAdmin,
  resolveAuthUser,
  signSessionToken,
} from './src/middleware/auth.ts';
import { calculateJewelleryPrice } from './src/lib/pricing.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '12mb' }));

function setSessionCookie(res: express.Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `aurelia_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
}

function clearSessionCookie(res: express.Response) {
  res.setHeader('Set-Cookie', 'aurelia_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

async function notifyStaff(title: string, message: string, type = 'order', link = '/dashboard/manage-orders') {
  const staffRoles = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.role, ['shopkeeper', 'super_admin']));

  const uniqueIds = Array.from(new Set(staffRoles.map((r) => r.userId)));
  if (uniqueIds.length > 0) {
    await db.insert(notifications).values(
      uniqueIds.map((userId) => ({ userId, title, message, type, link }))
    );
  }
}

// ==========================================
// 1. AUTHENTICATION & PROFILE ROUTES
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, mobile, email, password } = req.body || {};
    if (!fullName || !email || !password || !mobile) {
      return res.status(400).json({ error: 'Name, mobile number, email, and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const createdUser = await db.transaction(async (tx) => {
      const [prof] = await tx
        .insert(profiles)
        .values({
          fullName: String(fullName).trim(),
          email: normalizedEmail,
          mobile: String(mobile).trim(),
          passwordHash,
        })
        .returning();

      await tx.insert(userRoles).values({ userId: prof.id, role: 'customer' });

      const existingAdmins = await tx
        .select()
        .from(userRoles)
        .where(eq(userRoles.role, 'super_admin'))
        .limit(1);
      if (normalizedEmail === 'iaitkaliabor@gmail.com' || existingAdmins.length === 0) {
        await tx
          .insert(userRoles)
          .values({ userId: prof.id, role: 'super_admin' })
          .onConflictDoNothing();
      }

      await tx.insert(customers).values({ userId: prof.id });
      await tx.insert(carts).values({ userId: prof.id });
      return prof;
    });

    const token = signSessionToken(createdUser.id);
    setSessionCookie(res, token);
    const authUser = await loadAuthUserById(createdUser.id);
    res.status(201).json({ user: authUser, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const [prof] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail))
      .limit(1);

    if (!prof || !prof.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!prof.isActive) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact administrator.' });
    }

    const valid = await bcrypt.compare(String(password), prof.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const authUser = await loadAuthUserById(prof.id);
    if (!authUser) {
      return res.status(403).json({ error: 'Account unavailable.' });
    }

    if (
      portal === 'shopkeeper' &&
      !authUser.roles.some((r) => r === 'shopkeeper' || r === 'super_admin')
    ) {
      return res.status(403).json({
        error: 'This account is not a Shopkeeper account. Please sign in via Customer Login.',
      });
    }

    const token = signSessionToken(prof.id);
    setSessionCookie(res, token);
    res.json({ user: authUser, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Invalid Google authentication token.' });
    }
    const token = signSessionToken(user.id);
    setSessionCookie(res, token);
    res.json({ user, token });
  } catch (error) {
    console.error('Google auth sync error:', error);
    res.status(500).json({ error: 'Unable to complete Google Sign-In.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email address is required.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const [prof] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail))
      .limit(1);

    if (!prof) {
      return res.json({
        message: 'If an account matches this email, a password reset link has been generated.',
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(passwordResets).values({
      userId: prof.id,
      token: resetToken,
      expiresAt,
    });

    res.json({
      message: 'Password reset token generated. Proceed to set your new password.',
      resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Valid reset token and a 6+ character password are required.' });
    }

    const [resetRow] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, String(token)))
      .limit(1);

    if (!resetRow || resetRow.used || new Date(resetRow.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(profiles.id, resetRow.userId));
      await tx
        .update(passwordResets)
        .set({ used: true })
        .where(eq(passwordResets.id, resetRow.id));
    });

    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) return res.json({ user: null });
    const [shop] = await db
      .select()
      .from(shopkeepers)
      .where(eq(shopkeepers.userId, user.id))
      .limit(1);
    res.json({ user, shopkeeper: shop || null });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to fetch current user.' });
  }
});

app.put('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, mobile } = req.body || {};
    if (!fullName) return res.status(400).json({ error: 'Full name is required.' });
    await db
      .update(profiles)
      .set({
        fullName: String(fullName).trim(),
        mobile: String(mobile || '').trim(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, req.authUser!.id));
    const updated = await loadAuthUserById(req.authUser!.id);
    res.json({ user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ==========================================
// 2. PUBLIC SETTINGS, CATEGORIES, METAL RATES & MEDIA
// ==========================================
app.get('/api/settings', async (_req, res) => {
  try {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    res.json(row || {});
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to load website settings.' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder, categories.name);
    res.json(rows);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

app.get('/api/metal-rates', async (_req, res) => {
  try {
    const rows = await db.select().from(metalRates).orderBy(metalRates.material, metalRates.purity);
    res.json(rows);
  } catch (error) {
    console.error('Metal rates error:', error);
    res.status(500).json({ error: 'Failed to load metal rates.' });
  }
});

app.post('/api/media', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { filename, mimeType, dataBase64 } = req.body || {};
    if (!filename || !mimeType || !dataBase64) {
      return res.status(400).json({ error: 'Invalid media payload.' });
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(String(mimeType))) {
      return res.status(400).json({ error: 'Only JPG, PNG, WEBP, or GIF images are allowed.' });
    }

    const cleanBase64 = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerId: req.authUser!.id,
        filename: String(filename).slice(0, 120),
        mimeType: String(mimeType),
        dataBase64: cleanBase64,
      })
      .returning({ id: mediaAssets.id });

    res.status(201).json({ id: asset.id, url: `/api/media/${asset.id}` });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

app.get('/api/media/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send('Invalid media ID');
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) return res.status(404).send('Not found');
    const buffer = Buffer.from(asset.dataBase64, 'base64');
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (error) {
    console.error('Serve media error:', error);
    res.status(500).send('Error loading media');
  }
});

// ==========================================
// 3. PRODUCTS & REVIEWS (CENTRAL CATALOG)
// ==========================================
async function hydrateProducts(prodRows: Array<typeof products.$inferSelect>) {
  if (prodRows.length === 0) return [];
  const prodIds = prodRows.map((p) => p.id);
  const [catRows, imgRows, revRows] = await Promise.all([
    db.select().from(categories),
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, prodIds))
      .orderBy(productImages.sortOrder),
    db.select().from(reviews).where(inArray(reviews.productId, prodIds)),
  ]);

  const catMap = new Map(catRows.map((c) => [c.id, c]));
  return prodRows.map((p) => {
    const cat = catMap.get(p.categoryId);
    const imgs = imgRows.filter((i) => i.productId === p.id);
    const pRevs = revRows.filter((r) => r.productId === p.id);
    const avgRating = pRevs.length
      ? Number((pRevs.reduce((s, r) => s + r.rating, 0) / pRevs.length).toFixed(1))
      : 0;
    return {
      ...p,
      categoryName: cat?.name || '',
      categorySlug: cat?.slug || '',
      images: imgs,
      avgRating,
      reviewCount: pRevs.length,
    };
  });
}

app.get('/api/products', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const user = includeInactive ? await resolveAuthUser(req) : null;
    const isStaff = user && ['shopkeeper', 'super_admin'].includes(user.activeRole);

    const rows = isStaff
      ? await db.select().from(products).orderBy(desc(products.createdAt))
      : await db
          .select()
          .from(products)
          .where(eq(products.isActive, true))
          .orderBy(desc(products.createdAt));

    const hydrated = await hydrateProducts(rows);
    res.json(hydrated);
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({ error: 'Failed to load jewellery catalog.' });
  }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.slug, req.params.slug))
      .limit(1);
    if (!prod) return res.status(404).json({ error: 'Product not found.' });

    const [hydrated] = await hydrateProducts([prod]);
    const prodReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
        customerName: profiles.fullName,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.customerId, profiles.id))
      .where(eq(reviews.productId, prod.id))
      .orderBy(desc(reviews.createdAt));

    res.json({ product: hydrated, reviews: prodReviews });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Failed to load product details.' });
  }
});

app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { productId, rating, comment } = req.body || {};
    const r = Number(rating);
    if (!productId || !Number.isInteger(r) || r < 1 || r > 5 || !comment) {
      return res.status(400).json({ error: 'Valid rating (1-5) and comment are required.' });
    }

    const deliveredOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, req.authUser!.id),
          eq(orders.status, 'Delivered'),
          eq(orderItems.productId, String(productId))
        )
      )
      .limit(1);

    await db
      .insert(reviews)
      .values({
        productId: String(productId),
        customerId: req.authUser!.id,
        rating: r,
        comment: String(comment).trim(),
        isVerifiedPurchase: deliveredOrders.length > 0,
      })
      .onConflictDoUpdate({
        target: [reviews.productId, reviews.customerId],
        set: { rating: r, comment: String(comment).trim() },
      });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to save review.' });
  }
});

// ==========================================
// 4. CUSTOMER CART, WISHLIST & ADDRESSES
// ==========================================
app.get('/api/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    let [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, req.authUser!.id))
      .limit(1);

    if (!cart) {
      [cart] = await db.insert(carts).values({ userId: req.authUser!.id }).returning();
    }

    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        productId: cartItems.productId,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    if (items.length === 0) return res.json({ cartId: cart.id, items: [] });

    const prodRows = await db
      .select()
      .from(products)
      .where(inArray(products.id, items.map((i) => i.productId)));
    const hydrated = await hydrateProducts(prodRows);
    const prodMap = new Map(hydrated.map((p) => [p.id, p]));

    res.json({
      cartId: cart.id,
      items: items
        .map((i) => ({ ...i, product: prodMap.get(i.productId) || null }))
        .filter((i) => i.product !== null),
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to load shopping cart.' });
  }
});

app.post('/api/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { productId, quantity = 1 } = req.body || {};
    const qty = Number(quantity);
    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Valid product and positive quantity required.' });
    }

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, String(productId)))
      .limit(1);

    if (!prod || !prod.isActive) {
      return res.status(400).json({ error: 'This product is currently unavailable.' });
    }

    let [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, req.authUser!.id))
      .limit(1);
    if (!cart) {
      [cart] = await db.insert(carts).values({ userId: req.authUser!.id }).returning();
    }

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, prod.id)))
      .limit(1);

    const nextQty = (existingItem?.quantity || 0) + qty;
    if (prod.stockQty < nextQty) {
      return res.status(400).json({
        error: `Only ${prod.stockQty} piece(s) of ${prod.name} available in stock.`,
      });
    }

    if (existingItem) {
      await db
        .update(cartItems)
        .set({ quantity: nextQty })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId: prod.id,
        quantity: qty,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

app.patch('/api/cart/:itemId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const qty = Number(req.body?.quantity);
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, req.authUser!.id))
      .limit(1);
    if (!cart) return res.status(404).json({ error: 'Cart not found.' });

    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, req.params.itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);
    if (!item) return res.status(404).json({ error: 'Cart item not found.' });

    if (qty <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, item.id));
      return res.json({ success: true });
    }

    const [prod] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!prod || prod.stockQty < qty) {
      return res.status(400).json({ error: `Only ${prod?.stockQty ?? 0} piece(s) in stock.` });
    }

    await db.update(cartItems).set({ quantity: qty }).where(eq(cartItems.id, item.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update quantity.' });
  }
});

app.delete('/api/cart/:itemId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, req.authUser!.id))
      .limit(1);
    if (!cart) return res.json({ success: true });
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, req.params.itemId), eq(cartItems.cartId, cart.id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete cart item error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart.' });
  }
});

app.get('/api/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ productId: wishlists.productId })
      .from(wishlists)
      .where(eq(wishlists.userId, req.authUser!.id));
    res.json(rows.map((r) => r.productId));
  } catch (error) {
    console.error('Wishlist error:', error);
    res.status(500).json({ error: 'Failed to load wishlist.' });
  }
});

app.post('/api/wishlist/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'Product ID required.' });

    const [existing] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, req.authUser!.id), eq(wishlists.productId, String(productId))))
      .limit(1);

    if (existing) {
      await db.delete(wishlists).where(eq(wishlists.id, existing.id));
      return res.json({ wishlisted: false });
    } else {
      await db.insert(wishlists).values({ userId: req.authUser!.id, productId: String(productId) });
      return res.json({ wishlisted: true });
    }
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(500).json({ error: 'Failed to update wishlist.' });
  }
});

app.get('/api/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, req.authUser!.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
    res.json(rows);
  } catch (error) {
    console.error('Addresses error:', error);
    res.status(500).json({ error: 'Failed to load addresses.' });
  }
});

app.post('/api/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { label, recipientName, mobile, line1, line2, city, state, pincode, isDefault } = req.body || {};
    if (!recipientName || !mobile || !line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'All required address fields must be filled.' });
    }

    const created = await db.transaction(async (tx) => {
      if (isDefault) {
        await tx
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.userId, req.authUser!.id));
      }
      const existingCount = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, req.authUser!.id));

      const [addr] = await tx
        .insert(addresses)
        .values({
          userId: req.authUser!.id,
          label: label || 'Home',
          recipientName: String(recipientName).trim(),
          mobile: String(mobile).trim(),
          line1: String(line1).trim(),
          line2: line2 ? String(line2).trim() : null,
          city: String(city).trim(),
          state: String(state).trim(),
          pincode: String(pincode).trim(),
          isDefault: Boolean(isDefault) || existingCount.length === 0,
        })
        .returning();
      return addr;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to save address.' });
  }
});

app.delete('/api/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, req.params.id), eq(addresses.userId, req.authUser!.id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address.' });
  }
});

// ==========================================
// 5. ATOMIC ORDER PLACEMENT, TRACKING, CANCELLATION & PAYMENT PROOFS
// ==========================================
async function hydrateOrders(orderRows: Array<typeof orders.$inferSelect>) {
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((o) => o.id);
  const customerIds = Array.from(new Set(orderRows.map((o) => o.customerId)));

  const [itemRows, payRows, delRows, invRows, profRows] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
    db.select().from(payments).where(inArray(payments.orderId, orderIds)),
    db.select().from(deliveries).where(inArray(deliveries.orderId, orderIds)),
    db.select().from(invoices).where(inArray(invoices.orderId, orderIds)),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        mobile: profiles.mobile,
      })
      .from(profiles)
      .where(inArray(profiles.id, customerIds)),
  ]);

  const profMap = new Map(profRows.map((p) => [p.id, p]));
  return orderRows.map((o) => ({
    ...o,
    customer: profMap.get(o.customerId) || null,
    items: itemRows.filter((it) => it.orderId === o.id),
    payment: payRows.find((p) => p.orderId === o.id) || null,
    delivery: delRows.find((d) => d.orderId === o.id) || null,
    invoice: invRows.find((inv) => inv.orderId === o.id) || null,
  }));
}

app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      addressId,
      paymentMethod,
      idempotencyKey,
      customerNotes,
      transactionReference,
      proofImageUrl,
    } = req.body || {};

    const validMethods = ['COD', 'UPI', 'QR Code', 'Online Gateway', 'Bank Transfer'];
    if (!addressId || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Valid delivery address and payment method are required.' });
    }

    const uid = req.authUser!.id;

    if (idempotencyKey) {
      const [dup] = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, String(idempotencyKey)))
        .limit(1);
      if (dup) {
        return res.json({ orderId: dup.id, orderNumber: dup.orderNumber, duplicate: true });
      }
    }

    const result = await db.transaction(async (tx) => {
      const [addr] = await tx
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, String(addressId)), eq(addresses.userId, uid)))
        .limit(1);
      if (!addr) throw new Error('Invalid delivery address selected.');

      const [cart] = await tx.select().from(carts).where(eq(carts.userId, uid)).limit(1);
      if (!cart) throw new Error('Shopping cart not found.');

      const cItems = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id));

      if (cItems.length === 0) throw new Error('Your shopping cart is empty.');

      const prodIds = cItems.map((c) => c.productId);
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, prodIds))
        .for('update');

      const prodMap = new Map(lockedProducts.map((p) => [p.id, p]));
      const rates = await tx.select().from(metalRates);
      const [settings] = await tx.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

      let subtotal = 0;
      let gstTotal = 0;
      let discountTotal = 0;
      let shopkeeperId: string | null = null;

      const computedItems: Array<{
        product: typeof products.$inferSelect;
        quantity: number;
        pricing: ReturnType<typeof calculateJewelleryPrice>;
      }> = [];

      for (const ci of cItems) {
        const prod = prodMap.get(ci.productId);
        if (!prod || !prod.isActive) {
          throw new Error(`Product ${prod?.name || ''} is no longer available.`);
        }
        if (prod.stockQty < ci.quantity) {
          throw new Error(`Insufficient stock for ${prod.name}. Available: ${prod.stockQty}`);
        }
        if (!shopkeeperId && prod.shopkeeperId) shopkeeperId = prod.shopkeeperId;

        const pricing = calculateJewelleryPrice(prod, rates);
        subtotal += pricing.taxableValue * ci.quantity;
        gstTotal += pricing.gstAmount * ci.quantity;
        discountTotal += pricing.discount * ci.quantity;
        computedItems.push({ product: prod, quantity: ci.quantity, pricing });
      }

      const threshold = Number(settings?.freeDeliveryThreshold ?? 25000);
      const baseDelivery = Number(settings?.defaultDeliveryCharge ?? 250);
      const deliveryCharge = subtotal + gstTotal < threshold ? baseDelivery : 0;
      const grandTotal = Number((subtotal + gstTotal + deliveryCharge).toFixed(2));

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randTag = crypto.randomBytes(3).toString('hex').toUpperCase();
      const orderNumber = `JWL-${dateTag}-${randTag}`;
      const invoiceNumber = `INV-${dateTag}-${randTag}`;
      const receiptNumber = `RCP-${dateTag}-${randTag}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: uid,
          shopkeeperId,
          addressSnapshot: addr as unknown as Record<string, unknown>,
          subtotal: subtotal.toFixed(2),
          gstTotal: gstTotal.toFixed(2),
          deliveryCharge: deliveryCharge.toFixed(2),
          discountTotal: discountTotal.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          status: 'New Order',
          customerNotes: customerNotes ? String(customerNotes).trim() : null,
          idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
        })
        .returning();

      for (const item of computedItems) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.product.id,
          productCode: item.product.productCode,
          productName: item.product.name,
          material: item.product.material,
          purity: item.product.purity,
          weightGrams: String(item.product.weightGrams),
          metalRateApplied: item.pricing.ratePerGram.toFixed(2),
          makingCharges: item.pricing.makingCharges.toFixed(2),
          stoneCharges: item.pricing.stoneCharges.toFixed(2),
          gstAmount: (item.pricing.gstAmount * item.quantity).toFixed(2),
          unitFinalPrice: item.pricing.finalPrice.toFixed(2),
          quantity: item.quantity,
          lineTotal: (item.pricing.finalPrice * item.quantity).toFixed(2),
        });

        await tx
          .update(products)
          .set({
            stockQty: sql`${products.stockQty} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.product.id));
      }

      // IMPORTANT: Payment always starts 'Pending' — never marked Paid solely from screenshot upload
      await tx.insert(payments).values({
        orderId: newOrder.id,
        customerId: uid,
        method: paymentMethod,
        status: 'Pending',
        amount: grandTotal.toFixed(2),
        transactionReference: transactionReference ? String(transactionReference).trim() : null,
        proofImageUrl: proofImageUrl ? String(proofImageUrl).trim() : null,
        receiptNumber,
      });

      await tx.insert(deliveries).values({
        orderId: newOrder.id,
        deliveryAddress: addr as unknown as Record<string, unknown>,
        customerMobile: addr.mobile,
        deliveryCharges: deliveryCharge.toFixed(2),
        deliveryStatus: 'Pending Dispatch',
      });

      await tx.insert(invoices).values({
        invoiceNumber,
        orderId: newOrder.id,
        customerId: uid,
        shopSnapshot: {
          brandName: settings?.brandName || 'Aurelia Heritage Jewels',
          gstin: settings?.gstin || '27AABCA9603R1ZM',
          address: settings?.headquartersAddress || '',
          phone: settings?.supportPhone || '',
        },
        customerSnapshot: {
          name: req.authUser!.fullName,
          email: req.authUser!.email,
          mobile: addr.mobile,
          address: addr,
        },
        taxSummary: {
          subtotal: Number(subtotal.toFixed(2)),
          gstTotal: Number(gstTotal.toFixed(2)),
          deliveryCharge: Number(deliveryCharge.toFixed(2)),
          discountTotal: Number(discountTotal.toFixed(2)),
        },
        totalAmount: grandTotal.toFixed(2),
      });

      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

      await tx.insert(notifications).values({
        userId: uid,
        title: `Order Placed: ${orderNumber}`,
        message: `Your order for ₹${grandTotal.toLocaleString('en-IN')} has been received and awaits confirmation.`,
        type: 'order',
        link: '/dashboard/orders',
      });

      return { orderId: newOrder.id, orderNumber, grandTotal };
    });

    await notifyStaff(
      `New Jewellery Order: ${result.orderNumber}`,
      `₹${result.grandTotal.toLocaleString('en-IN')} via ${paymentMethod}`,
      'order',
      '/dashboard/manage-orders'
    );

    res.status(201).json({ ...result, duplicate: false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to place order.';
    console.error('Place order error:', error);
    res.status(400).json({ error: msg });
  }
});

app.get('/api/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, req.authUser!.id))
      .orderBy(desc(orders.createdAt));
    res.json(await hydrateOrders(rows));
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reason = req.body?.reason || 'Cancelled by customer';
    const uid = req.authUser!.id;

    const cancelledOrderNumber = await db.transaction(async (tx) => {
      const [ord] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, req.params.id), eq(orders.customerId, uid)))
        .for('update')
        .limit(1);

      if (!ord) throw new Error('Order not found.');
      if (!['New Order', 'Pending Confirmation', 'Confirmed'].includes(ord.status)) {
        throw new Error('Order cannot be cancelled once processing or dispatch has started.');
      }

      await tx
        .update(orders)
        .set({ status: 'Cancelled', rejectionReason: String(reason), updatedAt: new Date() })
        .where(eq(orders.id, ord.id));

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, ord.id));
      for (const it of items) {
        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} + ${it.quantity}` })
          .where(eq(products.id, it.productId));
      }

      await tx.insert(notifications).values({
        userId: uid,
        title: `Order Cancelled: ${ord.orderNumber}`,
        message: 'Your order has been cancelled and reserved items returned to inventory.',
        type: 'order',
        link: '/dashboard/orders',
      });

      return ord.orderNumber;
    });

    await notifyStaff(
      `Order Cancelled: ${cancelledOrderNumber}`,
      'Customer cancelled an eligible order.',
      'order',
      '/dashboard/manage-orders'
    );

    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unable to cancel order.';
    console.error('Cancel order error:', error);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/orders/:id/payment-proof', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { transactionReference, proofImageUrl } = req.body || {};
    const [pay] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, req.params.id), eq(payments.customerId, req.authUser!.id)))
      .limit(1);

    if (!pay) return res.status(404).json({ error: 'Payment record not found.' });
    if (pay.status !== 'Pending') {
      return res.status(400).json({ error: 'Payment proof can only be updated while status is Pending.' });
    }

    await db
      .update(payments)
      .set({
        transactionReference: transactionReference ? String(transactionReference).trim() : pay.transactionReference,
        proofImageUrl: proofImageUrl ? String(proofImageUrl).trim() : pay.proofImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pay.id));

    await notifyStaff(
      'Payment Proof Submitted',
      `Customer uploaded payment verification details for order.`,
      'payment',
      '/dashboard/manage-orders'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({ error: 'Failed to submit payment proof.' });
  }
});

// ==========================================
// 6. NOTIFICATIONS & SUPPORT TICKETS
// ==========================================
app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.authUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json(rows);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.authUser!.id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.authUser!.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Read all error:', error);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

app.get('/api/support', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, req.authUser!.id))
      .orderBy(desc(supportTickets.createdAt));
    res.json(rows);
  } catch (error) {
    console.error('Support load error:', error);
    res.status(500).json({ error: 'Failed to load support tickets.' });
  }
});

app.post('/api/support', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orderId, subject, message } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: req.authUser!.id,
        orderId: orderId || null,
        subject: String(subject).trim(),
        message: String(message).trim(),
      })
      .returning();

    await notifyStaff(
      `New Support Inquiry: ${subject}`,
      `${req.authUser!.fullName} submitted a concierge support ticket.`,
      'system',
      '/dashboard/manage-orders'
    );
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Support submit error:', error);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

// ==========================================
// 7. SHOPKEEPER / ADMIN MANAGEMENT ROUTES
// ==========================================
app.get('/api/staff/overview', requireStaff, async (_req: AuthRequest, res) => {
  try {
    const [allProds, allCusts, allOrders, allPays] = await Promise.all([
      db.select().from(products),
      db.select({ id: customers.id }).from(customers),
      db.select().from(orders).orderBy(orders.createdAt),
      db.select().from(payments),
    ]);

    const pendingOrders = allOrders.filter((o) =>
      ['New Order', 'Pending Confirmation'].includes(o.status)
    ).length;
    const confirmedOrders = allOrders.filter((o) =>
      ['Confirmed', 'Processing', 'Ready for Dispatch', 'Shipped', 'Out for Delivery'].includes(o.status)
    ).length;
    const deliveredOrders = allOrders.filter((o) => o.status === 'Delivered').length;
    const totalSales = allOrders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Returned')
      .reduce((acc, o) => acc + Number(o.grandTotal), 0);
    const pendingPayments = allPays.filter((p) => p.status === 'Pending').length;
    const lowStockProducts = allProds.filter((p) => p.stockQty <= p.lowStockThreshold);

    // Daily, Weekly, Monthly aggregations
    const dailyMap = new Map<string, number>();
    const weeklyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    for (const o of allOrders) {
      if (o.status === 'Cancelled' || o.status === 'Returned') continue;
      const dt = new Date(o.createdAt);
      const amt = Number(o.grandTotal);
      const dayKey = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + amt);

      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      const weekKey = `Wk ${weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + amt);

      const monthKey = dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + amt);
    }

    res.json({
      kpis: {
        totalProducts: allProds.length,
        totalCustomers: allCusts.length,
        totalOrders: allOrders.length,
        pendingOrders,
        confirmedOrders,
        deliveredOrders,
        totalSales: Number(totalSales.toFixed(2)),
        pendingPayments,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      salesReports: {
        daily: Array.from(dailyMap.entries()).map(([label, sales]) => ({ label, sales })),
        weekly: Array.from(weeklyMap.entries()).map(([label, sales]) => ({ label, sales })),
        monthly: Array.from(monthlyMap.entries()).map(([label, sales]) => ({ label, sales })),
      },
    });
  } catch (error) {
    console.error('Staff overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

app.post('/api/staff/products', requireStaff, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.productCode || !b.name || !b.categoryId || !b.material || !b.purity || !b.description) {
      return res.status(400).json({ error: 'Product code, name, category, material, purity, and description are required.' });
    }

    const [shop] = await db
      .select()
      .from(shopkeepers)
      .where(eq(shopkeepers.userId, req.authUser!.id))
      .limit(1);

    const slug = `${String(b.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

    const created = await db.transaction(async (tx) => {
      const [prod] = await tx
        .insert(products)
        .values({
          productCode: String(b.productCode).trim().toUpperCase(),
          shopkeeperId: shop?.id || null,
          categoryId: String(b.categoryId),
          name: String(b.name).trim(),
          slug,
          description: String(b.description).trim(),
          material: String(b.material),
          purity: String(b.purity).trim(),
          weightGrams: Number(b.weightGrams || 0).toFixed(3),
          useLiveMetalRate: b.useLiveMetalRate !== false,
          fixedBasePrice: Number(b.fixedBasePrice || 0).toFixed(2),
          makingCharges: Number(b.makingCharges || 0).toFixed(2),
          stoneCharges: Number(b.stoneCharges || 0).toFixed(2),
          gstPercent: Number(b.gstPercent ?? 3).toFixed(2),
          stockQty: Math.max(0, Number(b.stockQty || 0)),
          lowStockThreshold: Math.max(1, Number(b.lowStockThreshold || 3)),
          isFeatured: Boolean(b.isFeatured),
          isBridal: Boolean(b.isBridal),
          offerPercent: Number(b.offerPercent || 0).toFixed(2),
          isActive: b.isActive !== false,
        })
        .returning();

      const imageUrls: string[] = Array.isArray(b.imageUrls) ? b.imageUrls.filter(Boolean) : [];
      if (imageUrls.length > 0) {
        await tx.insert(productImages).values(
          imageUrls.map((url, idx) => ({
            productId: prod.id,
            imageUrl: String(url),
            isPrimary: idx === 0,
            sortOrder: idx,
          }))
        );
      }

      return prod;
    });

    res.status(201).json(created);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create product.';
    console.error('Create product error:', error);
    res.status(400).json({ error: msg.includes('unique') ? 'Product code already exists.' : msg });
  }
});

app.put('/api/staff/products/:id', requireStaff, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: b.name ? String(b.name).trim() : undefined,
          categoryId: b.categoryId || undefined,
          description: b.description ? String(b.description).trim() : undefined,
          material: b.material || undefined,
          purity: b.purity || undefined,
          weightGrams: b.weightGrams !== undefined ? Number(b.weightGrams).toFixed(3) : undefined,
          useLiveMetalRate: b.useLiveMetalRate !== undefined ? Boolean(b.useLiveMetalRate) : undefined,
          fixedBasePrice: b.fixedBasePrice !== undefined ? Number(b.fixedBasePrice).toFixed(2) : undefined,
          makingCharges: b.makingCharges !== undefined ? Number(b.makingCharges).toFixed(2) : undefined,
          stoneCharges: b.stoneCharges !== undefined ? Number(b.stoneCharges).toFixed(2) : undefined,
          gstPercent: b.gstPercent !== undefined ? Number(b.gstPercent).toFixed(2) : undefined,
          stockQty: b.stockQty !== undefined ? Math.max(0, Number(b.stockQty)) : undefined,
          isFeatured: b.isFeatured !== undefined ? Boolean(b.isFeatured) : undefined,
          isBridal: b.isBridal !== undefined ? Boolean(b.isBridal) : undefined,
          offerPercent: b.offerPercent !== undefined ? Number(b.offerPercent).toFixed(2) : undefined,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(products.id, req.params.id));

      if (Array.isArray(b.imageUrls)) {
        await tx.delete(productImages).where(eq(productImages.productId, req.params.id));
        const cleanUrls = b.imageUrls.filter(Boolean);
        if (cleanUrls.length > 0) {
          await tx.insert(productImages).values(
            cleanUrls.map((url: string, idx: number) => ({
              productId: req.params.id,
              imageUrl: String(url),
              isPrimary: idx === 0,
              sortOrder: idx,
            }))
          );
        }
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

app.delete('/api/staff/products/:id', requireStaff, async (req, res) => {
  try {
    await db.delete(products).where(eq(products.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({ error: 'Cannot delete a product linked to existing orders. Deactivate it instead.' });
  }
});

app.get('/api/staff/products/:id/review-summary', requireStaff, async (req, res) => {
  try {
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, req.params.id))
      .limit(1);

    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [hydrated] = await hydrateProducts([prod]);

    const prodReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
        customerName: profiles.fullName,
        customerEmail: profiles.email,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.customerId, profiles.id))
      .where(eq(reviews.productId, prod.id))
      .orderBy(desc(reviews.createdAt));

    const itemRows = await db
      .select({
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.productId, prod.id));

    const totalUnitsOrdered = itemRows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const totalRevenue = Number(
      itemRows.reduce((s, r) => s + Number(r.lineTotal || 0), 0).toFixed(2)
    );

    res.json({
      product: hydrated,
      reviews: prodReviews,
      salesStats: {
        totalUnitsOrdered,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Staff product review summary error:', error);
    res.status(500).json({ error: 'Failed to load product review summary.' });
  }
});

app.delete('/api/staff/reviews/:id', requireStaff, async (req, res) => {
  try {
    await db.delete(reviews).where(eq(reviews.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to remove review.' });
  }
});

app.post('/api/staff/categories', requireStaff, async (req, res) => {
  try {
    const { name, description, imageUrl, sortOrder } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [cat] = await db
      .insert(categories)
      .values({
        name: String(name).trim(),
        slug,
        description: description ? String(description).trim() : null,
        imageUrl: imageUrl || null,
        sortOrder: Number(sortOrder || 0),
      })
      .returning();
    res.status(201).json(cat);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(400).json({ error: 'Failed to create category (name may already exist).' });
  }
});

app.delete('/api/staff/categories/:id', requireStaff, async (req, res) => {
  try {
    await db.delete(categories).where(eq(categories.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(400).json({ error: 'Category has products assigned and cannot be deleted.' });
  }
});

app.put('/api/staff/metal-rates', requireStaff, async (req: AuthRequest, res) => {
  try {
    const { material, purity, ratePerGram } = req.body || {};
    if (!material || !purity || Number(ratePerGram) < 0) {
      return res.status(400).json({ error: 'Valid material, purity, and rate per gram are required.' });
    }
    const [row] = await db
      .insert(metalRates)
      .values({
        material: String(material),
        purity: String(purity).trim(),
        ratePerGram: Number(ratePerGram).toFixed(2),
        updatedBy: req.authUser!.id,
      })
      .onConflictDoUpdate({
        target: [metalRates.material, metalRates.purity],
        set: {
          ratePerGram: Number(ratePerGram).toFixed(2),
          effectiveFrom: new Date(),
          updatedBy: req.authUser!.id,
        },
      })
      .returning();
    res.json(row);
  } catch (error) {
    console.error('Metal rate update error:', error);
    res.status(500).json({ error: 'Failed to update metal rate.' });
  }
});

app.get('/api/staff/orders', requireStaff, async (_req, res) => {
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    res.json(await hydrateOrders(rows));
  } catch (error) {
    console.error('Staff orders error:', error);
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

app.patch('/api/staff/orders/:id/status', requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, rejectionReason } = req.body || {};
    const validStatuses = [
      'New Order',
      'Pending Confirmation',
      'Confirmed',
      'Processing',
      'Ready for Dispatch',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Returned',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    await db.transaction(async (tx) => {
      const [ord] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, req.params.id))
        .for('update')
        .limit(1);
      if (!ord) throw new Error('Order not found.');

      const wasCancelled = ord.status === 'Cancelled' || ord.status === 'Returned';
      const nowCancelled = status === 'Cancelled' || status === 'Returned';

      if (!wasCancelled && nowCancelled) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, ord.id));
        for (const it of items) {
          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} + ${it.quantity}` })
            .where(eq(products.id, it.productId));
        }
      }

      await tx
        .update(orders)
        .set({
          status,
          rejectionReason: rejectionReason ? String(rejectionReason) : ord.rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, ord.id));

      if (status === 'Delivered') {
        await tx
          .update(deliveries)
          .set({
            deliveryStatus: 'Delivered',
            deliveredAt: new Date(),
            updatedBy: req.authUser!.id,
            updatedAt: new Date(),
          })
          .where(eq(deliveries.orderId, ord.id));
      }

      await tx.insert(notifications).values({
        userId: ord.customerId,
        title: `Order ${ord.orderNumber}: ${status}`,
        message:
          status === 'Confirmed'
            ? 'Your jewellery order has been confirmed by our showroom.'
            : status === 'Shipped'
            ? 'Your insured jewellery parcel has been dispatched.'
            : status === 'Delivered'
            ? 'Your jewellery order has been delivered. Thank you for choosing Aurelia.'
            : `Order status updated to ${status}.`,
        type: status === 'Delivered' || status === 'Shipped' ? 'delivery' : 'order',
        link: '/dashboard/orders',
      });
    });

    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update order status.';
    console.error('Update order status error:', error);
    res.status(400).json({ error: msg });
  }
});

app.patch('/api/staff/payments/:orderId', requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body || {};
    if (!['Pending', 'Paid', 'Failed', 'Refunded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status.' });
    }

    const [pay] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, req.params.orderId))
      .limit(1);
    if (!pay) return res.status(404).json({ error: 'Payment record not found.' });

    const [ord] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);

    await db
      .update(payments)
      .set({
        status,
        verifiedBy: req.authUser!.id,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pay.id));

    await db.insert(notifications).values({
      userId: pay.customerId,
      title: `Payment ${status}: ${ord?.orderNumber || ''}`,
      message: `Your payment (${pay.method}) has been verified as ${status}. Receipt: ${pay.receiptNumber}`,
      type: 'payment',
      link: '/dashboard/orders',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to update payment status.' });
  }
});

app.patch('/api/staff/deliveries/:orderId', requireStaff, async (req: AuthRequest, res) => {
  try {
    const { partnerName, partnerMobile, trackingNumber, dispatchDate, expectedDeliveryDate, deliveryStatus } =
      req.body || {};

    const [del] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.orderId, req.params.orderId))
      .limit(1);
    if (!del) return res.status(404).json({ error: 'Delivery record not found.' });

    const [ord] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);

    await db
      .update(deliveries)
      .set({
        partnerName: partnerName !== undefined ? String(partnerName) : del.partnerName,
        partnerMobile: partnerMobile !== undefined ? String(partnerMobile) : del.partnerMobile,
        trackingNumber: trackingNumber !== undefined ? String(trackingNumber) : del.trackingNumber,
        dispatchDate: dispatchDate !== undefined ? String(dispatchDate) : del.dispatchDate,
        expectedDeliveryDate:
          expectedDeliveryDate !== undefined ? String(expectedDeliveryDate) : del.expectedDeliveryDate,
        deliveryStatus: deliveryStatus || del.deliveryStatus,
        deliveredAt: deliveryStatus === 'Delivered' ? new Date() : del.deliveredAt,
        updatedBy: req.authUser!.id,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, del.id));

    if (ord) {
      await db.insert(notifications).values({
        userId: ord.customerId,
        title: `Delivery Update: ${ord.orderNumber}`,
        message: `Status: ${deliveryStatus || del.deliveryStatus}${
          trackingNumber ? ` · Tracking #${trackingNumber}` : ''
        }`,
        type: 'delivery',
        link: '/dashboard/orders',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delivery update error:', error);
    res.status(500).json({ error: 'Failed to update delivery details.' });
  }
});

app.get('/api/staff/customers', requireStaff, async (_req, res) => {
  try {
    const custRows = await db
      .select({
        userId: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        mobile: profiles.mobile,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
        loyaltyPoints: customers.loyaltyPoints,
      })
      .from(customers)
      .innerJoin(profiles, eq(customers.userId, profiles.id))
      .orderBy(desc(profiles.createdAt));

    const ordRows = await db.select().from(orders);
    const enriched = custRows.map((c) => {
      const cOrds = ordRows.filter((o) => o.customerId === c.userId);
      const totalSpend = cOrds
        .filter((o) => o.status !== 'Cancelled')
        .reduce((s, o) => s + Number(o.grandTotal), 0);
      return { ...c, orderCount: cOrds.length, totalSpend };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Staff customers error:', error);
    res.status(500).json({ error: 'Failed to load customers.' });
  }
});

app.get('/api/staff/support', requireStaff, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        message: supportTickets.message,
        status: supportTickets.status,
        adminReply: supportTickets.adminReply,
        createdAt: supportTickets.createdAt,
        customerName: profiles.fullName,
        customerEmail: profiles.email,
      })
      .from(supportTickets)
      .innerJoin(profiles, eq(supportTickets.userId, profiles.id))
      .orderBy(desc(supportTickets.createdAt));
    res.json(rows);
  } catch (error) {
    console.error('Staff support error:', error);
    res.status(500).json({ error: 'Failed to load support tickets.' });
  }
});

app.patch('/api/staff/support/:id', requireStaff, async (req, res) => {
  try {
    const { status, adminReply } = req.body || {};
    await db
      .update(supportTickets)
      .set({
        status: status || 'Resolved',
        adminReply: adminReply ? String(adminReply).trim() : null,
      })
      .where(eq(supportTickets.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Reply support error:', error);
    res.status(500).json({ error: 'Failed to update support ticket.' });
  }
});

// ==========================================
// 8. SUPER ADMIN ROUTES
// ==========================================
app.get('/api/admin/users', requireSuperAdmin, async (_req, res) => {
  try {
    const [profRows, roleRows, shopRows] = await Promise.all([
      db
        .select({
          id: profiles.id,
          fullName: profiles.fullName,
          email: profiles.email,
          mobile: profiles.mobile,
          isActive: profiles.isActive,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .orderBy(desc(profiles.createdAt)),
      db.select().from(userRoles),
      db.select().from(shopkeepers),
    ]);

    const out = profRows.map((p) => {
      const roles = roleRows.filter((r) => r.userId === p.id);
      const shop = shopRows.find((s) => s.userId === p.id) || null;
      return {
        ...p,
        roles: roles.map((r) => r.role),
        permissions: roles[0]?.permissions || {},
        shopkeeper: shop,
      };
    });
    res.json(out);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load user accounts.' });
  }
});

app.post('/api/admin/shopkeepers', requireSuperAdmin, async (req, res) => {
  try {
    const { fullName, email, mobile, password, shopName, gstin, shopAddress } = req.body || {};
    if (!fullName || !email || !mobile || !password || !shopName) {
      return res.status(400).json({ error: 'Name, email, mobile, password, and shop name are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await db.transaction(async (tx) => {
      const [prof] = await tx
        .insert(profiles)
        .values({
          fullName: String(fullName).trim(),
          email: normalizedEmail,
          mobile: String(mobile).trim(),
          passwordHash,
        })
        .returning();

      await tx.insert(userRoles).values({
        userId: prof.id,
        role: 'shopkeeper',
        permissions: { manageProducts: true, manageOrders: true, managePayments: true, manageRates: true },
      });
      await tx.insert(shopkeepers).values({
        userId: prof.id,
        shopName: String(shopName).trim(),
        gstin: gstin ? String(gstin).trim() : null,
        shopAddress: shopAddress ? String(shopAddress).trim() : '',
        contactNumber: String(mobile).trim(),
      });
      await tx.insert(carts).values({ userId: prof.id });
      return prof;
    });

    res.status(201).json({ id: created.id, email: created.email });
  } catch (error) {
    console.error('Create shopkeeper error:', error);
    res.status(500).json({ error: 'Failed to create shopkeeper account.' });
  }
});

app.patch('/api/admin/users/:id/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role, permissions, isActive } = req.body || {};
    await db.transaction(async (tx) => {
      if (isActive !== undefined) {
        await tx
          .update(profiles)
          .set({ isActive: Boolean(isActive), updatedAt: new Date() })
          .where(eq(profiles.id, req.params.id));
      }
      if (role && ['customer', 'shopkeeper', 'super_admin'].includes(role)) {
        await tx.delete(userRoles).where(eq(userRoles.userId, req.params.id));
        await tx.insert(userRoles).values({
          userId: req.params.id,
          role,
          permissions: permissions || {},
        });
        if (role === 'shopkeeper') {
          const [prof] = await tx.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1);
          const [shop] = await tx.select().from(shopkeepers).where(eq(shopkeepers.userId, req.params.id)).limit(1);
          if (!shop && prof) {
            await tx.insert(shopkeepers).values({
              userId: prof.id,
              shopName: `${prof.fullName}'s Showroom`,
              contactNumber: prof.mobile,
            });
          }
        }
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role & permissions.' });
  }
});

app.put('/api/admin/settings', requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const [updated] = await db
      .update(siteSettings)
      .set({
        brandName: b.brandName || undefined,
        tagline: b.tagline || undefined,
        gstin: b.gstin || undefined,
        supportEmail: b.supportEmail || undefined,
        supportPhone: b.supportPhone || undefined,
        headquartersAddress: b.headquartersAddress || undefined,
        upiId: b.upiId || undefined,
        bankDetails: b.bankDetails || undefined,
        defaultDeliveryCharge:
          b.defaultDeliveryCharge !== undefined ? Number(b.defaultDeliveryCharge).toFixed(2) : undefined,
        freeDeliveryThreshold:
          b.freeDeliveryThreshold !== undefined ? Number(b.freeDeliveryThreshold).toFixed(2) : undefined,
        heroBannerTitle: b.heroBannerTitle || undefined,
        heroBannerSubtitle: b.heroBannerSubtitle || undefined,
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Update site settings error:', error);
    res.status(500).json({ error: 'Failed to update website settings.' });
  }
});

// ==========================================
// 9. VITE DEV / PRODUCTION STATIC SERVING
// ==========================================
async function startServer() {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Aurelia Heritage Jewels server listening on http://0.0.0.0:${port}`);
  });
}

startServer();

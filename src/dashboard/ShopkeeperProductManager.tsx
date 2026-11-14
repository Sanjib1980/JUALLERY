import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Search, Star, Trash2, X } from 'lucide-react';
import { apiFetch, uploadImageFile } from '../lib/api';
import { calculateJewelleryPrice, formatINR, type ProductItem } from '../lib/pricing';
import { useStore } from '../context/StoreContext';

const STUDIO_ASSET_PRESETS = [
  { label: 'Bridal Polki Set', url: '/src/assets/images/hero_bridal_jewellery_1794651704752.jpg' },
  { label: '22K Gold Choker', url: '/src/assets/images/necklace_royal_gold_1794651704151.jpg' },
  { label: 'Chandbali Earrings', url: '/src/assets/images/earrings_chandbali_gold_1794651704939.jpg' },
  { label: 'Solitaire Ring', url: '/src/assets/images/ring_diamond_solitaire_1794651705553.jpg' },
  { label: 'Gold & Silver Bangles', url: '/src/assets/images/bangles_heritage_pair_1794651705194.jpg' },
];

interface StaffReviewItem {
  id: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  customerName: string;
  customerEmail: string;
}

interface ReviewSummaryPayload {
  product: ProductItem;
  reviews: StaffReviewItem[];
  salesStats: {
    totalUnitsOrdered: number;
    totalRevenue: number;
  };
}

export const ShopkeeperProductManager: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const { categories, metalRates, refreshCatalogConfig } = useStore();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Search, filter & product review panel state
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'low_stock' | 'inactive' | 'featured'>(
    'all'
  );
  const [reviewSummary, setReviewSummary] = useState<ReviewSummaryPayload | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [form, setForm] = useState({
    productCode: '',
    name: '',
    categoryId: '',
    material: 'Gold',
    purity: '22K',
    weightGrams: 12.5,
    useLiveMetalRate: true,
    fixedBasePrice: 0,
    makingCharges: 6500,
    stoneCharges: 0,
    gstPercent: 3,
    stockQty: 5,
    offerPercent: 0,
    isFeatured: true,
    isBridal: false,
    description: '',
    imageUrls: [] as string[],
  });

  const loadProducts = async () => {
    const data = await apiFetch<ProductItem[]>('/api/products?includeInactive=true');
    setProducts(data);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (categories[0] && !form.categoryId) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories]);

  const openProductReview = async (productId: string) => {
    setReviewLoading(true);
    try {
      const data = await apiFetch<ReviewSummaryPayload>(
        `/api/staff/products/${productId}/review-summary`
      );
      setReviewSummary(data);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to load product review.');
    } finally {
      setReviewLoading(false);
    }
  };

  const toggleProductFlag = async (
    p: ProductItem,
    field: 'isActive' | 'isFeatured' | 'isBridal'
  ) => {
    const nextVal = !p[field];
    try {
      await apiFetch(`/api/staff/products/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: nextVal }),
      });
      await loadProducts();
      if (reviewSummary?.product.id === p.id) {
        await openProductReview(p.id);
      }
      onFeedback(
        field === 'isActive'
          ? `Product ${nextVal ? 'activated for customers' : 'hidden from storefront'}.`
          : field === 'isFeatured'
          ? `Product ${nextVal ? 'marked as featured' : 'removed from featured'}.`
          : `Product ${nextVal ? 'added to Bridal Collection' : 'removed from Bridal Collection'}.`
      );
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleDeleteReview = async (reviewId: string, productId: string) => {
    try {
      await apiFetch(`/api/staff/reviews/${reviewId}`, { method: 'DELETE' });
      onFeedback('Customer review removed.');
      await loadProducts();
      await openProductReview(productId);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to delete review.');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (catalogFilter === 'low_stock' && p.stockQty > p.lowStockThreshold) return false;
      if (catalogFilter === 'inactive' && p.isActive) return false;
      if (catalogFilter === 'featured' && !p.isFeatured) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.productCode.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, searchQuery, catalogFilter]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageFile(files[i]);
        urls.push(url);
      }
      setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...urls] }));
      onFeedback(`Uploaded ${urls.length} product photograph(s).`);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/api/staff/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        onFeedback('Product updated in central catalog.');
      } else {
        await apiFetch('/api/staff/products', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        onFeedback('New jewellery piece published to central catalog.');
      }
      setEditingId(null);
      setForm({
        productCode: '',
        name: '',
        categoryId: categories[0]?.id || '',
        material: 'Gold',
        purity: '22K',
        weightGrams: 12.5,
        useLiveMetalRate: true,
        fixedBasePrice: 0,
        makingCharges: 6500,
        stoneCharges: 0,
        gstPercent: 3,
        stockQty: 5,
        offerPercent: 0,
        isFeatured: true,
        isBridal: false,
        description: '',
        imageUrls: [],
      });
      loadProducts();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to save product.');
    }
  };

  const startEdit = (p: ProductItem) => {
    setEditingId(p.id);
    setForm({
      productCode: p.productCode,
      name: p.name,
      categoryId: p.categoryId,
      material: p.material,
      purity: p.purity,
      weightGrams: Number(p.weightGrams),
      useLiveMetalRate: p.useLiveMetalRate,
      fixedBasePrice: Number(p.fixedBasePrice),
      makingCharges: Number(p.makingCharges),
      stoneCharges: Number(p.stoneCharges),
      gstPercent: Number(p.gstPercent),
      stockQty: p.stockQty,
      offerPercent: Number(p.offerPercent),
      isFeatured: p.isFeatured,
      isBridal: p.isBridal,
      description: p.description,
      imageUrls: (p.images || []).map((im) => im.imageUrl),
    });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/staff/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      setCatName('');
      setCatDesc('');
      await refreshCatalogConfig();
      onFeedback('Category added.');
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to add category.');
    }
  };

  const previewPrice = calculateJewelleryPrice(form, metalRates);
  const reviewedPricing = reviewSummary
    ? calculateJewelleryPrice(reviewSummary.product, metalRates)
    : null;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-maroon-900">
            Product Review, Inventory &amp; Categories
          </h2>
          <p className="text-xs text-ink/65 mt-1">
            Review product specifications, live pricing breakdowns, customer ratings, and publish or
            update showroom inventory.
          </p>
        </div>
        <div className="text-xs text-ink/70 font-mono tabular-nums">
          Total Catalog: {products.length} piece(s)
        </div>
      </div>

      {/* Shopkeeper Product Review & Inspection Panel */}
      {(reviewLoading || reviewSummary) && (
        <section className="bg-white border border-champagne-200 rounded-2xl p-6 space-y-6 shadow-sm">
          {reviewLoading && !reviewSummary ? (
            <p className="text-sm text-ink/60">Loading product review inspection...</p>
          ) : (
            reviewSummary &&
            reviewedPricing && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-champagne-100 pb-4">
                  <div>
                    <div className="text-xs text-ink/60 flex items-center gap-2">
                      <span className="font-mono font-semibold text-maroon-900">
                        {reviewSummary.product.productCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{reviewSummary.product.categoryName || 'Jewellery'}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {reviewSummary.product.isActive ? 'Active on Storefront' : 'Hidden / Draft'}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl text-maroon-900 mt-1">
                      Product Review: {reviewSummary.product.name}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReviewSummary(null)}
                    aria-label="Close product review"
                    className="p-2 border border-champagne-200 rounded-lg text-ink/65 hover:text-maroon-900 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                  {/* Left: Images & Quick Flags */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-champagne-200 bg-champagne-50">
                      {reviewSummary.product.images?.[0]?.imageUrl ? (
                        <img
                          src={reviewSummary.product.images[0].imageUrl}
                          alt={reviewSummary.product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-ink/50">
                          No product image
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleProductFlag(reviewSummary.product, 'isActive')}
                        className={`w-full py-2 px-3 rounded-lg font-semibold border transition-colors cursor-pointer ${
                          reviewSummary.product.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-champagne-50 border-champagne-200 text-maroon-900'
                        }`}
                      >
                        {reviewSummary.product.isActive
                          ? 'Visible to Customers (Click to Hide)'
                          : 'Hidden from Customers (Click to Publish)'}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleProductFlag(reviewSummary.product, 'isFeatured')}
                          className={`py-2 px-3 rounded-lg font-medium border cursor-pointer ${
                            reviewSummary.product.isFeatured
                              ? 'bg-maroon-800 text-champagne-50 border-maroon-800'
                              : 'bg-white border-champagne-200 text-maroon-900'
                          }`}
                        >
                          {reviewSummary.product.isFeatured ? 'Featured: Yes' : 'Featured: No'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleProductFlag(reviewSummary.product, 'isBridal')}
                          className={`py-2 px-3 rounded-lg font-medium border cursor-pointer ${
                            reviewSummary.product.isBridal
                              ? 'bg-maroon-800 text-champagne-50 border-maroon-800'
                              : 'bg-white border-champagne-200 text-maroon-900'
                          }`}
                        >
                          {reviewSummary.product.isBridal ? 'Bridal: Yes' : 'Bridal: No'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          startEdit(reviewSummary.product);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full py-2 px-3 rounded-lg border border-maroon-800 text-maroon-900 font-semibold hover:bg-champagne-50 cursor-pointer"
                      >
                        Edit Specifications &amp; Images
                      </button>
                    </div>
                  </div>

                  {/* Middle: Specs, Live Rate Breakdown & Sales */}
                  <div className="lg:col-span-4 space-y-4 text-sm">
                    <p className="text-xs text-ink/75 leading-relaxed">
                      {reviewSummary.product.description}
                    </p>

                    <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-4 space-y-2 text-xs">
                      <div className="font-semibold text-maroon-900 pb-1 border-b border-champagne-200">
                        Price &amp; Margin Inspection
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/70">
                          Material / Purity ({reviewSummary.product.material}{' '}
                          {reviewSummary.product.purity})
                        </span>
                        <span className="font-mono tabular-nums">
                          {Number(reviewSummary.product.weightGrams)}g
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/70">Metal / Base Value</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(reviewedPricing.metalValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/70">Making Charges</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(reviewedPricing.makingCharges)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/70">Stone Charges</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(reviewedPricing.stoneCharges)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/70">
                          GST ({Number(reviewSummary.product.gstPercent)}%)
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatINR(reviewedPricing.gstAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-maroon-900 pt-2 border-t border-champagne-200 text-sm">
                        <span>Customer Selling Price</span>
                        <span className="font-mono tabular-nums">
                          {formatINR(reviewedPricing.finalPrice)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center bg-white border border-champagne-200 rounded-xl p-3">
                      <div>
                        <div className="text-[11px] text-ink/60">Stock</div>
                        <div className="font-mono font-bold text-maroon-900 tabular-nums">
                          {reviewSummary.product.stockQty}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-ink/60">Units Sold</div>
                        <div className="font-mono font-bold text-maroon-900 tabular-nums">
                          {reviewSummary.salesStats.totalUnitsOrdered}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-ink/60">Revenue</div>
                        <div className="font-mono font-bold text-maroon-900 tabular-nums">
                          {formatINR(reviewSummary.salesStats.totalRevenue)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Customer Reviews & Moderation */}
                  <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-base font-semibold text-maroon-900">
                        Customer Reviews ({reviewSummary.reviews.length})
                      </h4>
                      {reviewSummary.product.avgRating ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {reviewSummary.product.avgRating} / 5
                        </span>
                      ) : null}
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                      {reviewSummary.reviews.length === 0 ? (
                        <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-4 text-xs text-ink/65">
                          No customer reviews submitted for this piece yet.
                        </div>
                      ) : (
                        reviewSummary.reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="bg-champagne-50 border border-champagne-200 rounded-xl p-3.5 space-y-1.5 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-maroon-900">
                                  {rev.customerName}
                                  {rev.isVerifiedPurchase ? ' · Verified Buyer' : ''}
                                </div>
                                <div className="text-[11px] text-ink/55">{rev.customerEmail}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-gold-600 font-semibold">
                                  {'★'.repeat(rev.rating)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteReview(rev.id, reviewSummary.product.id)
                                  }
                                  aria-label="Remove customer review"
                                  className="text-red-700 hover:text-red-900 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-ink/80 leading-relaxed">{rev.comment}</p>
                            <div className="text-[11px] text-ink/50 tabular-nums">
                              {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </section>
      )}

      {/* Search & Filter Toolbar for Product Review Table */}
      <div className="bg-white border border-champagne-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-ink/45 absolute left-3 top-2.5" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by title, code (JWL-1001), or material..."
            className="w-full border border-champagne-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-maroon-800"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 bg-champagne-50 p-1 rounded-lg border border-champagne-200 text-xs">
          {(
            [
              { id: 'all', label: 'All Products' },
              { id: 'low_stock', label: 'Low Stock' },
              { id: 'featured', label: 'Featured' },
              { id: 'inactive', label: 'Hidden / Draft' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCatalogFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                catalogFilter === tab.id
                  ? 'bg-white text-maroon-900 shadow-sm'
                  : 'text-ink/70 hover:text-maroon-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Inventory & Review Table */}
      <div className="bg-white border border-champagne-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-maroon-800 text-champagne-50 text-xs">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Jewellery Piece</th>
              <th className="p-3">Specification</th>
              <th className="p-3">Reviews</th>
              <th className="p-3 text-right">Live Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-100">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink/60">
                  No jewellery pieces matched your filter.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const pr = calculateJewelleryPrice(p, metalRates);
                return (
                  <tr key={p.id} className="hover:bg-champagne-50/50">
                    <td className="p-3 font-mono text-xs">{p.productCode}</td>
                    <td className="p-3">
                      <div className="font-medium text-maroon-900">{p.name}</div>
                      <div className="text-[11px] text-ink/55">
                        {p.isActive ? 'Active' : 'Hidden'}
                        {p.isFeatured ? ' · Featured' : ''}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-ink/70">
                      {p.material} · {p.purity} · {Number(p.weightGrams)}g
                    </td>
                    <td className="p-3 text-xs tabular-nums">
                      {p.reviewCount ? (
                        <span className="inline-flex items-center gap-1 text-gold-600 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {p.avgRating} ({p.reviewCount})
                        </span>
                      ) : (
                        <span className="text-ink/45">No reviews</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {formatINR(pr.finalPrice)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono tabular-nums font-bold ${
                        p.stockQty <= p.lowStockThreshold ? 'text-red-700' : ''
                      }`}
                    >
                      {p.stockQty}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2.5">
                      <button
                        type="button"
                        onClick={() => openProductReview(p.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-maroon-900 bg-champagne-100 hover:bg-champagne-200 px-2.5 py-1 rounded cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs text-maroon-800 underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/staff/products/${p.id}`, { method: 'DELETE' });
                            loadProducts();
                            onFeedback('Product deleted.');
                          } catch (err: unknown) {
                            onFeedback(err instanceof Error ? err.message : 'Delete failed.');
                          }
                        }}
                        className="text-xs text-red-700 underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Jewellery Form */}
      <form
        onSubmit={handleSubmitProduct}
        className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4 text-sm"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-serif text-lg text-maroon-900">
            {editingId ? `Edit Product (${form.productCode})` : 'Publish New Jewellery Piece'}
          </h3>
          <span className="text-xs font-mono text-maroon-800 font-semibold tabular-nums">
            Live Calculated Price: {formatINR(previewPrice.finalPrice)}
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <input
            required
            disabled={Boolean(editingId)}
            placeholder="Unique Product ID (e.g. JWL-1007)"
            value={form.productCode}
            onChange={(e) => setForm({ ...form, productCode: e.target.value })}
            className="border border-champagne-200 rounded-lg px-3 py-2 font-mono"
          />
          <input
            required
            placeholder="Jewellery Title"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          >
            {['Gold', 'Silver', 'Diamond', 'Artificial'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Purity (22K, 18K, 925 Silver, VVS-EF)"
            value={form.purity}
            onChange={(e) => setForm({ ...form, purity: e.target.value })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
          <input
            type="number"
            step="0.001"
            placeholder="Weight (grams)"
            value={form.weightGrams}
            onChange={(e) => setForm({ ...form, weightGrams: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />

          <input
            type="number"
            placeholder="Making Charges (INR)"
            value={form.makingCharges}
            onChange={(e) => setForm({ ...form, makingCharges: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Stone Charges (INR)"
            value={form.stoneCharges}
            onChange={(e) => setForm({ ...form, stoneCharges: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Stock Quantity"
            value={form.stockQty}
            onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />

          {!form.useLiveMetalRate && (
            <input
              type="number"
              placeholder="Fixed Base Price (INR)"
              value={form.fixedBasePrice}
              onChange={(e) => setForm({ ...form, fixedBasePrice: Number(e.target.value) })}
              className="border border-champagne-200 rounded-lg px-3 py-2"
            />
          )}
          <input
            type="number"
            step="0.1"
            placeholder="GST %"
            value={form.gstPercent}
            onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
          <input
            type="number"
            step="0.5"
            placeholder="Offer Discount %"
            value={form.offerPercent}
            onChange={(e) => setForm({ ...form, offerPercent: Number(e.target.value) })}
            className="border border-champagne-200 rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap gap-5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.useLiveMetalRate}
              onChange={(e) => setForm({ ...form, useLiveMetalRate: e.target.checked })}
            />
            <span>Calculate using Live Metal Rate</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            <span>Featured on Homepage</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isBridal}
              onChange={(e) => setForm({ ...form, isBridal: e.target.checked })}
            />
            <span>Bridal Collection</span>
          </label>
        </div>

        <textarea
          required
          rows={2}
          placeholder="Craftsmanship description, hallmark details, dimensions..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-champagne-200 rounded-lg p-3"
        />

        {/* Multi-image uploader & studio asset selector */}
        <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-maroon-900">
                Upload Multiple Product Photographs
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                disabled={uploading}
                onChange={(e) => handleFileUpload(e.target.files)}
                className="text-xs mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STUDIO_ASSET_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      imageUrls: f.imageUrls.includes(preset.url)
                        ? f.imageUrls
                        : [...f.imageUrls, preset.url],
                    }))
                  }
                  className="px-2.5 py-1 bg-white border border-champagne-200 rounded text-[11px] hover:bg-champagne-100 cursor-pointer"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {form.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {form.imageUrls.map((url, idx) => (
                <div key={url + idx} className="relative w-20 h-16 rounded-lg overflow-hidden border border-champagne-200">
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        imageUrls: f.imageUrls.filter((_, i) => i !== idx),
                      }))
                    }
                    className="absolute top-0.5 right-0.5 bg-maroon-900 text-white text-[10px] px-1 rounded cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading}
            className="bg-maroon-800 hover:bg-maroon-900 text-champagne-50 px-6 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
          >
            {editingId ? 'Save Product Changes' : 'Publish Product'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2.5 border border-champagne-200 rounded-lg text-xs cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Category Management */}
      <div className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
        <h3 className="font-serif text-lg text-maroon-900">Category Management</h3>
        <form onSubmit={handleCreateCategory} className="flex flex-wrap gap-3 text-sm">
          <input
            required
            placeholder="New Category Name (e.g. Mangalsutra)"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="border border-champagne-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
          />
          <input
            placeholder="Short description"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            className="border border-champagne-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]"
          />
          <button
            type="submit"
            className="bg-maroon-800 text-champagne-50 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Add Category
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border border-champagne-200 bg-champagne-50 px-3 py-1.5 rounded-lg text-xs"
            >
              <span>{c.name}</span>
              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/api/staff/categories/${c.id}`, { method: 'DELETE' });
                    await refreshCatalogConfig();
                  } catch (err: unknown) {
                    onFeedback(err instanceof Error ? err.message : 'Cannot delete category.');
                  }
                }}
                className="text-red-700 font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

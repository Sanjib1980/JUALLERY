import React, { useEffect, useState } from 'react';
import { ArrowLeft, Gem, Heart, Scale, Star } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { calculateJewelleryPrice, formatINR, type ProductItem } from '../lib/pricing';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  customerName: string;
}

interface ProductDetailProps {
  slug: string;
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  slug,
  onNavigate,
  onFeedback,
}) => {
  const { user } = useAuth();
  const { metalRates, addToCart, toggleWishlist, wishlistIds, toggleCompare } = useStore();
  const [product, setProduct] = useState<ProductItem | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [zoom, setZoom] = useState({ x: 50, y: 50, active: false });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ product: ProductItem; reviews: ReviewItem[] }>(
        `/api/products/${slug}`
      );
      setProduct(res.product);
      setReviews(res.reviews || []);
      const firstImg =
        res.product.images?.find((i) => i.isPrimary)?.imageUrl ||
        res.product.images?.[0]?.imageUrl ||
        '';
      setActiveImage(firstImg);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to load product.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-14 text-center text-sm text-ink/60">
        Loading jewellery specifications...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-14 text-center space-y-4">
        <p className="font-serif text-2xl text-maroon-900">Jewellery piece not found</p>
        <button
          onClick={() => onNavigate('/shop')}
          className="px-5 py-2.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  const pricing = calculateJewelleryPrice(product, metalRates);
  const outOfStock = product.stockQty <= 0;
  const isWishlisted = wishlistIds.includes(product.id);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onFeedback('Please sign in to submit a product review.');
    setSubmittingReview(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, rating, comment }),
      });
      setComment('');
      onFeedback('Thank you! Your review has been published.');
      await loadDetail();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Could not post review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <button
        onClick={() => onNavigate('/shop')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-maroon-800 hover:underline mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Collection</span>
      </button>

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        {/* Left: Zoomable Image Gallery */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-24">
          <div
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setZoom({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
                active: true,
              });
            }}
            onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
            className="aspect-[4/3] rounded-2xl border border-champagne-200 bg-champagne-50 overflow-hidden cursor-zoom-in relative"
          >
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                style={
                  zoom.active
                    ? { transformOrigin: `${zoom.x}% ${zoom.y}%`, transform: 'scale(2)' }
                    : undefined
                }
                className="w-full h-full object-cover transition-transform duration-150"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-maroon-800/40">
                <Gem className="w-12 h-12 mb-2" />
                <span className="text-sm">{product.name}</span>
              </div>
            )}
          </div>

          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.images.map((im) => (
                <button
                  key={im.id}
                  type="button"
                  onClick={() => setActiveImage(im.imageUrl)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    activeImage === im.imageUrl ? 'border-maroon-800' : 'border-champagne-200'
                  }`}
                >
                  <img
                    src={im.imageUrl}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-ink/55">Hover over the photograph to inspect craftsmanship detail.</p>
        </div>

        {/* Right: Contiguous Purchase & Specification Module */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="text-xs text-ink/60 flex items-center gap-2">
              <span>{product.categoryName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.productCode}</span>
              {product.reviewCount ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-gold-600 font-medium">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {product.avgRating} ({product.reviewCount})
                  </span>
                </>
              ) : null}
            </div>
            <h1 className="font-serif text-3xl text-maroon-900 mt-1">{product.name}</h1>
            <p className="text-sm text-ink/75 leading-relaxed mt-3">{product.description}</p>
          </div>

          {/* Core Jewellery Specs */}
          <div className="grid grid-cols-2 gap-3 bg-champagne-50 border border-champagne-200 rounded-xl p-4 text-sm">
            <div>
              <div className="text-xs text-ink/55">Material</div>
              <div className="font-semibold text-maroon-900">{product.material}</div>
            </div>
            <div>
              <div className="text-xs text-ink/55">Purity</div>
              <div className="font-semibold text-maroon-900">{product.purity}</div>
            </div>
            <div>
              <div className="text-xs text-ink/55">Gross Weight</div>
              <div className="font-semibold text-maroon-900 tabular-nums">
                {Number(product.weightGrams)} g
              </div>
            </div>
            <div>
              <div className="text-xs text-ink/55">Availability</div>
              <div
                className={`font-semibold tabular-nums ${
                  outOfStock ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {outOfStock ? 'Out of Stock' : `In Stock (${product.stockQty} available)`}
              </div>
            </div>
          </div>

          {/* Transparent Price Breakdown */}
          <div className="bg-white border border-champagne-200 rounded-xl p-5 space-y-2.5 text-sm">
            <h2 className="font-serif text-base font-semibold text-maroon-900 pb-2 border-b border-champagne-100">
              Live Price Breakdown
            </h2>
            <div className="flex justify-between">
              <span className="text-ink/70">
                Metal / Base Value{' '}
                {pricing.ratePerGram > 0 ? `(${formatINR(pricing.ratePerGram)}/g)` : ''}
              </span>
              <span className="font-mono tabular-nums">{formatINR(pricing.metalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/70">Making Charges</span>
              <span className="font-mono tabular-nums">{formatINR(pricing.makingCharges)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/70">Stone Charges</span>
              <span className="font-mono tabular-nums">{formatINR(pricing.stoneCharges)}</span>
            </div>
            {pricing.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Offer Discount ({Number(product.offerPercent)}%)</span>
                <span className="font-mono tabular-nums">-{formatINR(pricing.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-ink/70">GST ({Number(product.gstPercent)}%)</span>
              <span className="font-mono tabular-nums">{formatINR(pricing.gstAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-maroon-900 pt-3 border-t border-champagne-200">
              <span>Final Selling Price</span>
              <span className="font-mono tabular-nums">{formatINR(pricing.finalPrice)}</span>
            </div>
          </div>

          {/* Purchase Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => {
                if (!user) {
                  onFeedback('Please sign in via Customer Login to add items to your bag.');
                  onNavigate(`/customer-login?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
                  return;
                }
                addToCart(product.id, 1)
                  .then(() => onFeedback(`Added "${product.name}" to shopping bag.`))
                  .catch((e) => onFeedback(e.message));
              }}
              className="flex-1 border-2 border-maroon-800 text-maroon-900 hover:bg-champagne-50 py-3 px-5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            >
              Add to Cart
            </button>
            <button
              type="button"
              disabled={outOfStock}
              onClick={async () => {
                if (!user) {
                  onFeedback('Please sign in via Customer Login to purchase.');
                  onNavigate(`/customer-login?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
                  return;
                }
                try {
                  await addToCart(product.id, 1);
                  onNavigate('/checkout');
                } catch (e: unknown) {
                  onFeedback(e instanceof Error ? e.message : 'Please sign in first.');
                }
              }}
              className="flex-1 bg-maroon-800 hover:bg-maroon-900 text-champagne-50 py-3 px-5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            >
              Buy Now
            </button>
            <button
              type="button"
              onClick={() =>
                toggleWishlist(product.id)
                  .then(() => onFeedback(isWishlisted ? 'Removed from wishlist.' : 'Saved to wishlist.'))
                  .catch((e) => onFeedback(e.message))
              }
              aria-label="Save to wishlist"
              className="p-3 border border-champagne-200 rounded-xl text-maroon-800 hover:bg-champagne-50 cursor-pointer"
            >
              <Heart className="w-5 h-5" fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={() => {
                toggleCompare(product);
                onFeedback('Updated comparison tray.');
              }}
              aria-label="Compare product"
              className="p-3 border border-champagne-200 rounded-xl text-maroon-800 hover:bg-champagne-50 cursor-pointer"
            >
              <Scale className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <section className="mt-16 pt-10 border-t border-champagne-200 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <h2 className="font-serif text-2xl text-maroon-900 mb-3">Customer Reviews</h2>
          <form
            onSubmit={handleSubmitReview}
            className="bg-white border border-champagne-200 rounded-xl p-5 space-y-3 text-sm"
          >
            <div className="flex items-center justify-between">
              <label className="font-medium text-maroon-900">Your Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="border border-champagne-200 rounded-lg px-3 py-1.5"
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} Stars
                  </option>
                ))}
              </select>
            </div>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your impression of purity, finish, and packaging..."
              className="w-full border border-champagne-200 rounded-lg p-3 focus:outline-none focus:border-maroon-800"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="w-full bg-maroon-800 text-champagne-50 py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {reviews.length === 0 ? (
            <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-6 text-sm text-ink/65">
              No reviews yet for this ornament. Be the first verified buyer to share feedback.
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="bg-white border border-champagne-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-ink/60">
                  <span className="font-semibold text-maroon-900">
                    {rev.customerName}
                    {rev.isVerifiedPurchase ? ' · Verified Purchase' : ''}
                  </span>
                  <span className="text-gold-600 font-semibold">{'★'.repeat(rev.rating)}</span>
                </div>
                <p className="text-sm text-ink/80 mt-2">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

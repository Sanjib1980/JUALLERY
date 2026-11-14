import React, { useState } from 'react';
import { Gem, Heart, Scale, ShoppingBag } from 'lucide-react';
import { calculateJewelleryPrice, formatINR, type ProductItem } from '../lib/pricing';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

interface ProductCardProps {
  product: ProductItem;
  onOpenDetail: (slug: string) => void;
  onFeedback?: (msg: string) => void;
  onRequireLogin?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onFeedback,
  onRequireLogin,
}) => {
  const { user } = useAuth();
  const { metalRates, addToCart, toggleWishlist, wishlistIds, toggleCompare, compareList } =
    useStore();
  const [imgError, setImgError] = useState(false);
  const [adding, setAdding] = useState(false);

  const pricing = calculateJewelleryPrice(product, metalRates);
  const primaryImage =
    product.images?.find((i) => i.isPrimary)?.imageUrl || product.images?.[0]?.imageUrl;
  const isWishlisted = wishlistIds.includes(product.id);
  const isCompared = compareList.some((c) => c.id === product.id);
  const outOfStock = product.stockQty <= 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    if (!user) {
      onFeedback?.('Please sign in via Customer Login to add jewellery to your bag.');
      onRequireLogin?.();
      return;
    }
    setAdding(true);
    try {
      await addToCart(product.id, 1);
      onFeedback?.(`Added "${product.name}" to your shopping bag.`);
    } catch (err: unknown) {
      onFeedback?.(err instanceof Error ? err.message : 'Unable to add item.');
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      onFeedback?.('Please sign in via Customer Login to save pieces to your wishlist.');
      onRequireLogin?.();
      return;
    }
    try {
      await toggleWishlist(product.id);
      onFeedback?.(isWishlisted ? 'Removed from wishlist.' : 'Saved to wishlist.');
    } catch (err: unknown) {
      onFeedback?.(err instanceof Error ? err.message : 'Sign in to save wishlist.');
    }
  };

  return (
    <article
      onClick={() => onOpenDetail(product.slug)}
      className="group bg-white border border-champagne-200 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col cursor-pointer"
    >
      <div className="aspect-[4/3] bg-champagne-50 relative overflow-hidden">
        {primaryImage && !imgError ? (
          <img
            src={primaryImage}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-champagne-50 to-champagne-100 text-maroon-800/40 p-4 text-center">
            <Gem className="w-8 h-8 mb-2" />
            <span className="font-serif text-xs">{product.name}</span>
          </div>
        )}

        {outOfStock && (
          <div className="absolute inset-0 bg-maroon-900/55 flex items-center justify-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-champagne-50 bg-maroon-900/90 px-3 py-1.5 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="text-xs text-ink/60 flex items-center gap-1.5 truncate">
            <span className="font-mono">{product.productCode}</span>
            <span aria-hidden="true">·</span>
            <span>{product.material}</span>
            <span aria-hidden="true">·</span>
            <span>{product.purity}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{Number(product.weightGrams)}g</span>
          </div>

          <h3 className="font-serif text-base sm:text-lg font-semibold text-maroon-900 mt-1 line-clamp-1">
            {product.name}
          </h3>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-base font-bold text-maroon-900 tabular-nums">
              {formatINR(pricing.finalPrice)}
            </span>
            {Number(product.offerPercent) > 0 && (
              <span className="text-xs font-medium text-gold-600 tabular-nums">
                {Number(product.offerPercent)}% Off
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-champagne-100">
          <button
            type="button"
            disabled={outOfStock || adding}
            onClick={handleAdd}
            className="flex-1 bg-maroon-800 hover:bg-maroon-900 text-champagne-50 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{adding ? 'Adding...' : outOfStock ? 'Unavailable' : 'Add to Cart'}</span>
          </button>

          <button
            type="button"
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`p-2 border rounded-lg transition-colors cursor-pointer ${
              isWishlisted
                ? 'border-maroon-800 bg-champagne-100 text-maroon-800'
                : 'border-champagne-200 text-ink/60 hover:text-maroon-800'
            }`}
          >
            <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCompare(product);
            }}
            aria-label="Compare piece"
            className={`p-2 border rounded-lg transition-colors cursor-pointer ${
              isCompared
                ? 'border-gold-500 bg-champagne-100 text-maroon-900'
                : 'border-champagne-200 text-ink/60 hover:text-maroon-800'
            }`}
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
};

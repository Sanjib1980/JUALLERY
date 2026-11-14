import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { calculateJewelleryPrice, formatINR, type ProductItem } from '../lib/pricing';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

interface ShopPageProps {
  queryString?: string;
  offersOnly?: boolean;
  wishlistOnly?: boolean;
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({
  queryString = '',
  offersOnly = false,
  wishlistOnly = false,
  onNavigate,
  onFeedback,
}) => {
  const { categories, metalRates, wishlistIds } = useStore();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);

  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState(params.get('material') || 'All');
  const [purity, setPurity] = useState('All');
  const [categorySlug, setCategorySlug] = useState(params.get('category') || 'All');
  const [bridalOnly, setBridalOnly] = useState(params.get('bridal') === 'true');
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [sortBy, setSortBy] = useState<'latest' | 'price_asc' | 'price_desc'>('latest');

  useEffect(() => {
    setMaterial(params.get('material') || 'All');
    setCategorySlug(params.get('category') || 'All');
    setBridalOnly(params.get('bridal') === 'true');
  }, [params]);

  useEffect(() => {
    setLoading(true);
    apiFetch<ProductItem[]>('/api/products')
      .then((rows) => setProducts(rows))
      .catch((err) => onFeedback(err.message))
      .finally(() => setLoading(false));
  }, [onFeedback]);

  const filtered = useMemo(() => {
    return products
      .map((p) => ({ ...p, computedPrice: calculateJewelleryPrice(p, metalRates).finalPrice }))
      .filter((p) => {
        if (wishlistOnly && !wishlistIds.includes(p.id)) return false;
        if (offersOnly && Number(p.offerPercent) <= 0) return false;
        if (bridalOnly && !p.isBridal) return false;
        if (material !== 'All' && p.material !== material) return false;
        if (purity !== 'All' && p.purity !== purity) return false;
        if (categorySlug !== 'All' && p.categorySlug !== categorySlug) return false;
        if (p.computedPrice > maxPrice) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.productCode.toLowerCase().includes(q) ||
            p.material.toLowerCase().includes(q) ||
            p.purity.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.computedPrice - b.computedPrice;
        if (sortBy === 'price_desc') return b.computedPrice - a.computedPrice;
        return 0;
      });
  }, [
    products,
    metalRates,
    wishlistOnly,
    wishlistIds,
    offersOnly,
    bridalOnly,
    material,
    purity,
    categorySlug,
    maxPrice,
    search,
    sortBy,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-maroon-900">
            {wishlistOnly
              ? 'My Saved Wishlist'
              : offersOnly
              ? 'Exclusive Showroom Offers'
              : bridalOnly
              ? 'Bridal Trousseau Collection'
              : 'Fine Jewellery Catalog'}
          </h1>
          <p className="text-sm text-ink/65 mt-1">
            Dynamic pricing computed from live showroom metal rates, weight, making charges, and GST.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or Product ID..."
              className="w-full pl-9 pr-3 py-2 border border-champagne-200 bg-white rounded-lg text-sm focus:outline-none focus:border-maroon-800"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'price_asc' | 'price_desc')}
            className="border border-champagne-200 bg-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="latest">Sort: Latest Arrivals</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 bg-champagne-50 p-4 rounded-xl border border-champagne-200 mb-8 text-sm">
        <select
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
          className="border border-champagne-200 bg-white rounded-lg px-3 py-2"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="border border-champagne-200 bg-white rounded-lg px-3 py-2"
        >
          <option value="All">All Materials</option>
          {['Gold', 'Silver', 'Diamond', 'Artificial'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={purity}
          onChange={(e) => setPurity(e.target.value)}
          className="border border-champagne-200 bg-white rounded-lg px-3 py-2"
        >
          <option value="All">All Purities</option>
          {['24K', '22K', '18K', '925 Silver', 'VVS-EF', 'Artificial'].map((pu) => (
            <option key={pu} value={pu}>
              {pu}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setBridalOnly(!bridalOnly)}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            bridalOnly
              ? 'bg-maroon-800 text-champagne-50 border-maroon-800'
              : 'bg-white text-maroon-900 border-champagne-200'
          }`}
        >
          {bridalOnly ? 'Bridal Only: On' : 'Bridal Collection'}
        </button>

        <div className="col-span-2 flex items-center gap-3 px-2">
          <span className="text-xs text-ink/70 whitespace-nowrap tabular-nums">
            Max: {formatINR(maxPrice)}
          </span>
          <input
            type="range"
            min={1000}
            max={1000000}
            step={5000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-maroon-800"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 bg-champagne-50 border border-champagne-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-champagne-200 rounded-2xl p-12 text-center space-y-3">
          <p className="font-serif text-xl text-maroon-900">
            {wishlistOnly
              ? 'Your wishlist is currently empty'
              : 'No jewellery matched your active filters'}
          </p>
          <p className="text-sm text-ink/65">
            {products.length === 0
              ? 'No products are published in the database yet. Staff can add pieces from the Shopkeeper Dashboard.'
              : 'Try clearing filters or browsing all collections.'}
          </p>
          <button
            onClick={() => {
              setMaterial('All');
              setPurity('All');
              setCategorySlug('All');
              setBridalOnly(false);
              setSearch('');
              setMaxPrice(1000000);
              if (wishlistOnly) onNavigate('/shop');
            }}
            className="px-5 py-2.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
          >
            {wishlistOnly ? 'Explore Jewellery' : 'Reset Filters'}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onOpenDetail={(slug) => onNavigate(`/product/${slug}`)}
              onFeedback={onFeedback}
              onRequireLogin={() => onNavigate('/customer-login')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatINR, type ProductItem } from '../lib/pricing';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

interface HomePageProps {
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onFeedback }) => {
  const { user, loginWithEmail, loginWithGoogle, registerCustomer, logout } = useAuth();
  const { settings, categories, metalRates, cartItems } = useStore();
  const [featured, setFeatured] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer inline login / register state
  const [customerMode, setCustomerMode] = useState<'login' | 'register'>('login');
  const [custFullName, setCustFullName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custBusy, setCustBusy] = useState(false);
  const [custError, setCustError] = useState('');

  // Shopkeeper inline login state
  const [shopEmail, setShopEmail] = useState('');
  const [shopPassword, setShopPassword] = useState('');
  const [shopBusy, setShopBusy] = useState(false);
  const [shopError, setShopError] = useState('');

  useEffect(() => {
    apiFetch<ProductItem[]>('/api/products')
      .then((rows) => {
        const feat = rows.filter((r) => r.isFeatured);
        setFeatured((feat.length > 0 ? feat : rows).slice(0, 6));
      })
      .catch((err) => console.error('Featured products error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustBusy(true);
    setCustError('');
    try {
      const signedIn =
        customerMode === 'login'
          ? await loginWithEmail(custEmail, custPassword, 'customer')
          : await registerCustomer({
              fullName: custFullName,
              mobile: custMobile,
              email: custEmail,
              password: custPassword,
            });
      onFeedback(`Welcome, ${signedIn.fullName}! Ready to shop.`);
      onNavigate('/shop');
    } catch (err: unknown) {
      setCustError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setCustBusy(false);
    }
  };

  const handleCustomerGoogle = async () => {
    setCustBusy(true);
    setCustError('');
    try {
      const signedIn = await loginWithGoogle();
      onFeedback(`Signed in as ${signedIn.fullName}.`);
      onNavigate('/shop');
    } catch (err: unknown) {
      setCustError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setCustBusy(false);
    }
  };

  const handleShopkeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopBusy(true);
    setShopError('');
    try {
      const signedIn = await loginWithEmail(shopEmail, shopPassword, 'shopkeeper');
      onFeedback(`Signed in to Shopkeeper Portal as ${signedIn.fullName}.`);
      onNavigate('/dashboard/manage-products');
    } catch (err: unknown) {
      setShopError(err instanceof Error ? err.message : 'Shopkeeper sign in failed.');
    } finally {
      setShopBusy(false);
    }
  };

  const isStaff = user && ['shopkeeper', 'super_admin'].includes(user.activeRole);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      {/* 1. Split Editorial Hero */}
      <section className="bg-champagne-50 border-b border-champagne-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16 grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-center space-y-5">
            <p className="text-xs font-medium tracking-wider text-gold-600 uppercase">
              BIS Hallmarked Gold · Certified Diamonds · 925 Silver
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-maroon-900 leading-[1.12]">
              {settings?.heroBannerTitle || 'The Royal Bridal & Heritage Edit'}
            </h1>
            <p className="text-base text-ink/75 leading-relaxed max-w-md">
              {settings?.heroBannerSubtitle ||
                'Heirloom craftsmanship priced transparently using live daily bullion rates, certified stones, and insured doorstep delivery.'}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => onNavigate('/shop')}
                className="bg-maroon-800 hover:bg-maroon-900 text-champagne-50 px-6 py-3 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Explore Collection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('/shop?bridal=true')}
                className="border border-maroon-800 text-maroon-900 hover:bg-champagne-100 px-6 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Bridal Trousseau
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="h-full min-h-[300px] lg:min-h-[430px] rounded-2xl overflow-hidden border border-champagne-200 bg-maroon-900">
              <img
                src="/src/assets/images/hero_bridal_jewellery_1794651704752.jpg"
                alt="Handcrafted 22K Gold and Uncut Diamond Bridal Jewellery Set"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Live Metal Rates Bar */}
        <div className="border-t border-champagne-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
            <span className="font-serif font-semibold text-maroon-900">
              Live Showroom Bullion Rates
            </span>
            <div className="flex flex-wrap items-center gap-6 text-ink/80">
              {metalRates.map((r) => (
                <div key={`${r.material}-${r.purity}`} className="flex items-center gap-1.5">
                  <span>
                    {r.material} {r.purity}
                  </span>
                  <span aria-hidden="true">·</span>
                  <strong className="font-mono tabular-nums text-maroon-900">
                    {formatINR(r.ratePerGram)}/g
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Separate Customer Login & Shopkeeper Login Portals */}
      <section
        id="account-portals"
        className="bg-ivory border-b border-champagne-200 py-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {!user ? (
            <div className="space-y-8">
              <div className="max-w-2xl">
                <p className="text-xs font-medium tracking-wider text-gold-600 uppercase">
                  Direct Access Portals
                </p>
                <h2 className="font-serif text-3xl text-maroon-900 mt-1">
                  Customer &amp; Shopkeeper Login
                </h2>
                <p className="text-sm text-ink/70 mt-1">
                  Customers can sign in to shop and place orders immediately. Shopkeepers can sign in
                  to review jewellery products, customer ratings, stock, and orders.
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                {/* Customer Login Card */}
                <div className="bg-white border border-champagne-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-champagne-100">
                      <div>
                        <div className="flex items-center gap-2 text-maroon-900">
                          <ShoppingBag className="w-5 h-5 text-gold-600 shrink-0" />
                          <h3 className="font-serif text-2xl font-semibold">Customer Login</h3>
                        </div>
                        <p className="text-xs text-ink/65 mt-1">
                          Sign in or register to add jewellery to your bag and buy seamlessly.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-champagne-50 border border-champagne-200 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerMode('login');
                            setCustError('');
                          }}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            customerMode === 'login'
                              ? 'bg-white text-maroon-900 shadow-sm'
                              : 'text-ink/70 hover:text-maroon-900'
                          }`}
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerMode('register');
                            setCustError('');
                          }}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            customerMode === 'register'
                              ? 'bg-white text-maroon-900 shadow-sm'
                              : 'text-ink/70 hover:text-maroon-900'
                          }`}
                        >
                          New Customer
                        </button>
                      </div>
                    </div>

                    {custError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 rounded-lg text-xs">
                        {custError}
                      </div>
                    )}

                    <form onSubmit={handleCustomerSubmit} className="space-y-3.5 text-sm">
                      {customerMode === 'register' && (
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-ink/70 mb-1">
                              Full Name
                            </label>
                            <input
                              required
                              value={custFullName}
                              onChange={(e) => setCustFullName(e.target.value)}
                              placeholder="Ananya Sharma"
                              className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-ink/70 mb-1">
                              Mobile Number
                            </label>
                            <input
                              required
                              value={custMobile}
                              onChange={(e) => setCustMobile(e.target.value)}
                              placeholder="+91 98765 43210"
                              className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Customer Email
                        </label>
                        <input
                          required
                          type="email"
                          value={custEmail}
                          onChange={(e) => setCustEmail(e.target.value)}
                          placeholder="customer@example.com"
                          className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Password
                        </label>
                        <input
                          required
                          type="password"
                          minLength={6}
                          value={custPassword}
                          onChange={(e) => setCustPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={custBusy}
                        className="w-full bg-maroon-800 hover:bg-maroon-900 text-champagne-50 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {custBusy
                          ? 'Signing in...'
                          : customerMode === 'login'
                          ? 'Customer Login & Buy Products'
                          : 'Create Account & Start Shopping'}
                      </button>
                    </form>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3 text-xs text-ink/45">
                      <div className="flex-1 h-px bg-champagne-200" />
                      <span>or</span>
                      <div className="flex-1 h-px bg-champagne-200" />
                    </div>

                    <button
                      type="button"
                      disabled={custBusy}
                      onClick={handleCustomerGoogle}
                      className="w-full border border-champagne-200 bg-champagne-50 hover:bg-champagne-100 text-maroon-900 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Continue with Google (Customer)
                    </button>

                    <div className="flex items-center justify-between text-xs text-maroon-800 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('/customer-login?mode=forgot')}
                        className="underline cursor-pointer"
                      >
                        Forgot customer password?
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('/customer-login')}
                        className="underline cursor-pointer"
                      >
                        Open full Customer Portal
                      </button>
                    </div>
                  </div>
                </div>

                {/* Shopkeeper Login Card */}
                <div className="bg-white border border-champagne-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-champagne-100">
                      <div className="flex items-center gap-2 text-maroon-900">
                        <Store className="w-5 h-5 text-gold-600 shrink-0" />
                        <h3 className="font-serif text-2xl font-semibold">Shopkeeper Login</h3>
                      </div>
                      <p className="text-xs text-ink/65 mt-1">
                        Showroom staff access to review jewellery products, customer ratings, stock
                        levels, live bullion pricing, and incoming orders.
                      </p>
                    </div>

                    {shopError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 rounded-lg text-xs">
                        {shopError}
                      </div>
                    )}

                    <form onSubmit={handleShopkeeperSubmit} className="space-y-3.5 text-sm">
                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Shopkeeper Email
                        </label>
                        <input
                          required
                          type="email"
                          value={shopEmail}
                          onChange={(e) => setShopEmail(e.target.value)}
                          placeholder="shopkeeper@aureliajewels.com"
                          className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Password
                        </label>
                        <input
                          required
                          type="password"
                          minLength={6}
                          value={shopPassword}
                          onChange={(e) => setShopPassword(e.target.value)}
                          placeholder="Enter shopkeeper password"
                          className="w-full border border-champagne-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-800"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={shopBusy}
                        className="w-full bg-maroon-900 hover:bg-maroon-800 text-gold-400 border border-gold-500/40 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {shopBusy
                          ? 'Verifying Shopkeeper Access...'
                          : 'Shopkeeper Login & Review Products'}
                      </button>
                    </form>

                    <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-4 text-xs text-ink/75 space-y-1.5">
                      <div className="font-semibold text-maroon-900">
                        Shopkeeper Product Review Capabilities
                      </div>
                      <p className="leading-relaxed">
                        Inspect every piece&apos;s live bullion calculation, stock thresholds, active
                        visibility, and verified customer reviews from one central catalog workspace.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-maroon-800 pt-2 border-t border-champagne-100">
                    <button
                      type="button"
                      onClick={() => onNavigate('/shopkeeper-login?mode=forgot')}
                      className="underline cursor-pointer"
                    >
                      Forgot shopkeeper password?
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/shopkeeper-login')}
                      className="underline cursor-pointer"
                    >
                      Open full Shopkeeper Portal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-champagne-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-ink/60">
                  <UserCheck className="w-4 h-4 text-gold-600" />
                  <span className="capitalize font-medium text-maroon-900">
                    {user.activeRole.replace('_', ' ')} Session Active
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{user.email}</span>
                </div>
                <h2 className="font-serif text-2xl text-maroon-900">
                  Welcome back, {user.fullName}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isStaff ? (
                  <>
                    <button
                      onClick={() => onNavigate('/dashboard/manage-products')}
                      className="bg-maroon-900 hover:bg-maroon-800 text-gold-400 px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Review Products &amp; Ratings
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/manage-orders')}
                      className="border border-champagne-200 hover:bg-champagne-50 text-maroon-900 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Manage Orders
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/overview')}
                      className="border border-champagne-200 hover:bg-champagne-50 text-maroon-900 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Analytics &amp; Rates
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onNavigate('/shop')}
                      className="bg-maroon-800 hover:bg-maroon-900 text-champagne-50 px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Browse &amp; Buy Jewellery
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/cart')}
                      className="border border-champagne-200 hover:bg-champagne-50 text-maroon-900 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums"
                    >
                      Shopping Bag ({cartCount})
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/orders')}
                      className="border border-champagne-200 hover:bg-champagne-50 text-maroon-900 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      My Orders
                    </button>
                  </>
                )}

                <button
                  onClick={async () => {
                    await logout();
                    onFeedback('Signed out. You can now switch between Customer or Shopkeeper login.');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-ink/70 hover:text-maroon-900 px-3 py-2 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Curated Categories & Featured Database Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-14">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-serif text-3xl text-maroon-900">Shop by Category</h2>
              <p className="text-sm text-ink/65 mt-1">
                Explore gold, silver, diamond, and bridal craftsmanship across signature forms.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/shop')}
              className="text-sm font-semibold text-maroon-800 hover:text-gold-600 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  onNavigate(
                    cat.slug === 'bridal-collection'
                      ? '/shop?bridal=true'
                      : `/shop?category=${cat.slug}`
                  )
                }
                className="group text-left bg-white border border-champagne-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer"
              >
                <div className="aspect-[4/3] bg-champagne-50 overflow-hidden">
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="font-serif text-base font-semibold text-maroon-900">{cat.name}</h3>
                  <p className="text-xs text-ink/60 line-clamp-1 mt-0.5">{cat.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-serif text-3xl text-maroon-900">Signature Showcase</h2>
              <p className="text-sm text-ink/65 mt-1">
                Fetched directly from our central showroom inventory with real-time pricing.
              </p>
            </div>
            <div className="flex gap-2">
              {['Gold', 'Silver', 'Diamond'].map((mat) => (
                <button
                  key={mat}
                  onClick={() => onNavigate(`/shop?material=${mat}`)}
                  className="px-3 py-1.5 text-xs font-medium border border-champagne-200 bg-white hover:bg-champagne-50 rounded-lg text-maroon-900 cursor-pointer whitespace-nowrap"
                >
                  {mat} Jewellery
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((k) => (
                <div key={k} className="h-80 bg-champagne-50 border border-champagne-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="bg-white border border-champagne-200 rounded-2xl p-10 text-center space-y-3">
              <h3 className="font-serif text-xl text-maroon-900">
                Showroom Inventory Ready for Curation
              </h3>
              <p className="text-sm text-ink/65 max-w-lg mx-auto">
                No jewellery pieces have been published to the live catalog yet. Sign in via
                Shopkeeper Login to publish authenticated jewellery pieces with live metal pricing.
              </p>
              <button
                onClick={() => onNavigate('/shopkeeper-login')}
                className="mt-2 px-5 py-2.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Shopkeeper Login
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onOpenDetail={(slug) => onNavigate(`/product/${slug}`)}
                  onFeedback={onFeedback}
                  onRequireLogin={() => onNavigate('/customer-login')}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Craftsmanship & Assurance Pillars */}
      <section className="bg-champagne-50 border-y border-champagne-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <ShieldCheck className="w-6 h-6 text-gold-600" />
            <h3 className="font-serif text-lg font-semibold text-maroon-900">
              100% BIS Hallmarked Purity
            </h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              Every 22K and 18K gold ornament carries laser-etched HUID hallmarking and transparent
              weight certification.
            </p>
          </div>
          <div className="space-y-2">
            <Sparkles className="w-6 h-6 text-gold-600" />
            <h3 className="font-serif text-lg font-semibold text-maroon-900">
              Transparent Rate Breakdown
            </h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              Inspect exact metal rate per gram, gross weight, making charges, stone charges, and
              3% GST before placing your order.
            </p>
          </div>
          <div className="space-y-2">
            <Truck className="w-6 h-6 text-gold-600" />
            <h3 className="font-serif text-lg font-semibold text-maroon-900">
              Insured Vault Delivery
            </h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              Tamper-evident sealed parcels dispatched via insured logistics with live tracking and
              verified GST tax invoices.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

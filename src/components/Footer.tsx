import React from 'react';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { settings } = useStore();

  return (
    <footer className="bg-maroon-900 text-champagne-100 border-t border-gold-500/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-3">
          <div className="font-serif text-xl text-gold-400">
            {settings?.brandName || 'Aurelia Heritage Jewels'}
          </div>
          <p className="text-xs text-champagne-200/80 leading-relaxed">
            {settings?.tagline || 'Timeless Craftsmanship in Gold, Diamond & Silver'}
          </p>
          <p className="text-xs text-champagne-200/70 font-mono tabular-nums">
            GSTIN: {settings?.gstin || '27AABCA9603R1ZM'}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-400 mb-3">
            Collections
          </h3>
          <ul className="space-y-2 text-sm text-champagne-100/85">
            {[
              { label: 'All Products', route: '/shop' },
              { label: 'Gold Jewellery', route: '/shop?material=Gold' },
              { label: 'Silver Jewellery', route: '/shop?material=Silver' },
              { label: 'Diamond Jewellery', route: '/shop?material=Diamond' },
              { label: 'Bridal Collection', route: '/shop?bridal=true' },
              { label: 'Exclusive Offers', route: '/offers' },
            ].map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => onNavigate(item.route)}
                  className="hover:text-gold-400 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-400 mb-3">
            Categories
          </h3>
          <ul className="space-y-2 text-sm text-champagne-100/85">
            {[
              { label: 'Necklaces', route: '/shop?category=necklace' },
              { label: 'Earrings', route: '/shop?category=earrings' },
              { label: 'Rings', route: '/shop?category=rings' },
              { label: 'Bangles', route: '/shop?category=bangles' },
              { label: 'About Us', route: '/about' },
              { label: 'Contact Us', route: '/contact' },
            ].map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => onNavigate(item.route)}
                  className="hover:text-gold-400 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 text-sm text-champagne-100/85">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-400 mb-3">
            Concierge & Showroom
          </h3>
          <p className="text-xs leading-relaxed text-champagne-200/80">
            {settings?.headquartersAddress || 'Zaveri Bazaar Heritage Arcade, Mumbai 400002'}
          </p>
          <p className="text-xs font-mono tabular-nums">
            {settings?.supportPhone || '+91 98765 43210'}
          </p>
          <p className="text-xs">{settings?.supportEmail || 'concierge@aureliajewels.com'}</p>
          <div className="pt-1 flex flex-col items-start gap-1.5">
            <button
              onClick={() => onNavigate('/customer-login')}
              className="text-xs text-gold-400 underline cursor-pointer"
            >
              Customer Login
            </button>
            <button
              onClick={() => onNavigate('/shopkeeper-login')}
              className="text-xs text-gold-400 underline cursor-pointer"
            >
              Shopkeeper Login (Product Review)
            </button>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="text-xs text-champagne-200/90 underline cursor-pointer"
            >
              My Account &amp; Order Tracking
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gold-500/20 py-4 px-4 text-center text-xs text-champagne-200/60">
        © {new Date().getFullYear()} {settings?.brandName || 'Aurelia Heritage Jewels'}. BIS
        Hallmarked Gold & Certified Solitaires.
      </div>
    </footer>
  );
};

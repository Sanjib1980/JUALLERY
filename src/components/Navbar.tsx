import React, { useState } from 'react';
import { Bell, Heart, Menu, Scale, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const { user } = useAuth();
  const { settings, cartItems, compareList, notifications, markNotificationRead, markAllNotificationsRead } =
    useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const primaryLinks = [
    { label: 'Home', route: '/' },
    { label: 'Shop', route: '/shop' },
    { label: 'Bridal', route: '/shop?bridal=true' },
    { label: 'Offers', route: '/offers' },
    { label: 'About', route: '/about' },
  ];

  const handleNav = (route: string) => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-champagne-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleNav('/')}
          className="font-serif text-lg sm:text-xl font-semibold tracking-tight text-maroon-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {settings?.brandName || 'Aurelia Heritage Jewels'}
        </button>

        {/* Zone 2: 5 Concise Primary Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-ink/80">
          {primaryLinks.map((link) => {
            const active = currentRoute === link.route;
            return (
              <button
                key={link.label}
                onClick={() => handleNav(link.route)}
                className={`whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-gold-500 text-maroon-900 font-semibold'
                    : 'border-transparent hover:border-champagne-200 hover:text-maroon-800'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Functional Utilities & Account CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {compareList.length > 0 && (
            <button
              onClick={() => handleNav('/compare')}
              aria-label="Compare products"
              className="relative p-2 text-maroon-800 hover:bg-champagne-50 rounded-lg transition-colors cursor-pointer"
            >
              <Scale className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 bg-maroon-800 text-white text-[10px] font-mono tabular-nums px-1.5 rounded-full">
                {compareList.length}
              </span>
            </button>
          )}

          {user && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                className="relative p-2 text-maroon-800 hover:bg-champagne-50 rounded-lg transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gold-500 text-white text-[10px] font-mono tabular-nums px-1.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-champagne-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-champagne-200 flex items-center justify-between bg-champagne-50">
                    <span className="font-serif text-sm font-semibold text-maroon-900">
                      Notifications ({unreadCount})
                    </span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-xs text-maroon-800 underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        aria-label="Close notifications"
                        className="text-ink/60 hover:text-maroon-900 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-champagne-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-ink/60">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            markNotificationRead(n.id);
                            if (n.link) handleNav(n.link);
                          }}
                          className={`w-full text-left p-3.5 hover:bg-champagne-50 transition-colors cursor-pointer ${
                            !n.isRead ? 'bg-champagne-50/70' : ''
                          }`}
                        >
                          <div className="text-xs font-semibold text-maroon-900">{n.title}</div>
                          <div className="text-xs text-ink/70 mt-0.5">{n.message}</div>
                          <div className="text-[11px] text-ink/50 mt-1 tabular-nums">
                            {new Date(n.createdAt).toLocaleString('en-IN')}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => handleNav('/dashboard/wishlist')}
            aria-label="Wishlist"
            className="hidden sm:inline-flex p-2 text-maroon-800 hover:bg-champagne-50 rounded-lg transition-colors cursor-pointer"
          >
            <Heart className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleNav('/dashboard/cart')}
            aria-label="Shopping Bag"
            className="relative p-2 text-maroon-800 hover:bg-champagne-50 rounded-lg transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-maroon-800 text-white text-[10px] font-mono tabular-nums px-1.5 rounded-full">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNav(user ? '/dashboard' : '/login')}
            className="px-4 py-2 bg-maroon-800 hover:bg-maroon-900 text-champagne-50 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user ? 'My Account' : 'Sign In'}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="lg:hidden p-2 text-maroon-900 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-champagne-200 bg-white px-4 py-4 space-y-2">
          {[
            ...primaryLinks,
            { label: 'Gold Jewellery', route: '/shop?material=Gold' },
            { label: 'Silver Jewellery', route: '/shop?material=Silver' },
            { label: 'Diamond Jewellery', route: '/shop?material=Diamond' },
            { label: 'Contact Us', route: '/contact' },
            { label: 'My Account', route: user ? '/dashboard' : '/login' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item.route)}
              className="block w-full text-left px-3 py-2 text-sm font-medium text-maroon-900 hover:bg-champagne-50 rounded-lg cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

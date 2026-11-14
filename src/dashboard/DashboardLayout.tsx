import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CustomerAddressesView,
  CustomerCartView,
  CustomerOrdersView,
  CustomerPaymentsAndInvoicesView,
  CustomerProfileView,
  CustomerSupportView,
} from './CustomerViews';
import {
  ShopkeeperCustomersAndSupport,
  ShopkeeperOrdersManager,
  ShopkeeperOverviewAndRates,
} from './ShopkeeperViews';
import { ShopkeeperProductManager } from './ShopkeeperProductManager';
import { SuperAdminPanel } from './SuperAdminViews';
import { ShopPage } from '../pages/ShopPage';

interface DashboardLayoutProps {
  subRoute: string;
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  subRoute,
  onNavigate,
  onFeedback,
}) => {
  const { user, shopkeeper, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-ink/60">
        Verifying your account session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-serif text-3xl text-maroon-900">Account Sign-In Required</h1>
        <p className="text-sm text-ink/65">
          Sign in to access your centralized customer, shopkeeper, or administrator dashboard.
        </p>
        <button
          onClick={() => onNavigate('/login')}
          className="px-6 py-3 bg-maroon-800 text-champagne-50 rounded-lg text-sm font-semibold cursor-pointer"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const isSuperAdmin = user.activeRole === 'super_admin';
  const isStaff = user.activeRole === 'shopkeeper' || isSuperAdmin;

  const defaultTab = isSuperAdmin
    ? '/dashboard/overview'
    : isStaff
    ? '/dashboard/overview'
    : '/dashboard/orders';

  const activePath = subRoute === '/dashboard' ? defaultTab : subRoute;

  const customerLinks = [
    { label: 'My Profile', path: '/dashboard/profile' },
    { label: 'My Orders & Tracking', path: '/dashboard/orders' },
    { label: 'My Wishlist', path: '/dashboard/wishlist' },
    { label: 'Shopping Cart', path: '/dashboard/cart' },
    { label: 'My Addresses', path: '/dashboard/addresses' },
    { label: 'Payment History', path: '/dashboard/payments' },
    { label: 'Download Invoices', path: '/dashboard/invoices' },
    { label: 'Support / Complaints', path: '/dashboard/support' },
  ];

  const staffLinks = [
    { label: 'Analytics & Live Rates', path: '/dashboard/overview' },
    { label: 'Orders, Payments & Delivery', path: '/dashboard/manage-orders' },
    { label: 'Products & Categories', path: '/dashboard/manage-products' },
    { label: 'Customers & Support', path: '/dashboard/manage-customers' },
  ];

  const adminLinks = [{ label: 'Staff, Roles & Site Settings', path: '/dashboard/admin' }];

  const renderContent = () => {
    switch (activePath) {
      case '/dashboard/profile':
        return <CustomerProfileView onFeedback={onFeedback} />;
      case '/dashboard/orders':
        return <CustomerOrdersView onFeedback={onFeedback} />;
      case '/dashboard/wishlist':
        return <ShopPage wishlistOnly onNavigate={onNavigate} onFeedback={onFeedback} />;
      case '/dashboard/cart':
        return <CustomerCartView onNavigate={onNavigate} onFeedback={onFeedback} />;
      case '/dashboard/addresses':
        return <CustomerAddressesView onFeedback={onFeedback} />;
      case '/dashboard/payments':
        return <CustomerPaymentsAndInvoicesView mode="payments" />;
      case '/dashboard/invoices':
        return <CustomerPaymentsAndInvoicesView mode="invoices" />;
      case '/dashboard/support':
        return <CustomerSupportView onFeedback={onFeedback} />;
      case '/dashboard/overview':
        return isStaff ? (
          <ShopkeeperOverviewAndRates onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
      case '/dashboard/manage-orders':
        return isStaff ? (
          <ShopkeeperOrdersManager onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
      case '/dashboard/manage-products':
        return isStaff ? (
          <ShopkeeperProductManager onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
      case '/dashboard/manage-customers':
        return isStaff ? (
          <ShopkeeperCustomersAndSupport onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
      case '/dashboard/admin':
        return isSuperAdmin ? (
          <SuperAdminPanel onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
      default:
        return isStaff ? (
          <ShopkeeperOverviewAndRates onFeedback={onFeedback} />
        ) : (
          <CustomerOrdersView onFeedback={onFeedback} />
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 bg-maroon-900 text-champagne-100 rounded-2xl p-5 h-fit space-y-5">
        <div className="border-b border-gold-500/25 pb-4">
          <div className="font-serif text-lg text-gold-400">{user.fullName}</div>
          <div className="text-xs text-champagne-200/80 mt-0.5 capitalize">
            {user.activeRole.replace('_', ' ')}
            {shopkeeper ? ` · ${shopkeeper.shopName}` : ''}
          </div>
        </div>

        {isSuperAdmin && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-gold-400/80 px-2 pb-1">
              Super Admin
            </div>
            {adminLinks.map((l) => (
              <button
                key={l.path}
                onClick={() => onNavigate(l.path)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  activePath === l.path
                    ? 'bg-maroon-800 text-gold-400 font-semibold'
                    : 'hover:bg-maroon-800/70'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        {isStaff && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-gold-400/80 px-2 pb-1">
              Showroom Operations
            </div>
            {staffLinks.map((l) => (
              <button
                key={l.path}
                onClick={() => onNavigate(l.path)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  activePath === l.path
                    ? 'bg-maroon-800 text-gold-400 font-semibold'
                    : 'hover:bg-maroon-800/70'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-gold-400/80 px-2 pb-1">
            Personal Account
          </div>
          {customerLinks.map((l) => (
            <button
              key={l.path}
              onClick={() => onNavigate(l.path)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                activePath === l.path
                  ? 'bg-maroon-800 text-gold-400 font-semibold'
                  : 'hover:bg-maroon-800/70'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button
          onClick={async () => {
            await logout();
            onFeedback('Signed out.');
            onNavigate('/');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-champagne-200/80 hover:text-white border-t border-gold-500/20 pt-4 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </aside>

      <main className="lg:col-span-9 bg-champagne-50 border border-champagne-200 rounded-2xl min-h-[540px]">
        {renderContent()}
      </main>
    </div>
  );
};

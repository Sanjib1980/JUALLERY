import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetail } from './pages/ProductDetail';
import { ComparePage } from './pages/ComparePage';
import { CheckoutPage } from './pages/CheckoutPage';
import { AuthPages } from './pages/AuthPages';
import { AboutPage, ContactPage } from './pages/StaticPages';
import { DashboardLayout } from './dashboard/DashboardLayout';

function AppShell() {
  const [route, setRoute] = useState(() => window.location.pathname + window.location.search);
  const [toast, setToast] = useState('');

  const showFeedback = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? '' : curr)), 3500);
  }, []);

  const navigate = useCallback((nextRoute: string) => {
    window.history.pushState({}, '', nextRoute);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [pathname, search = ''] = route.split('?');

  const renderPage = () => {
    if (pathname === '/' || pathname === '') {
      return <HomePage onNavigate={navigate} onFeedback={showFeedback} />;
    }
    if (pathname === '/shop') {
      return <ShopPage queryString={search} onNavigate={navigate} onFeedback={showFeedback} />;
    }
    if (pathname === '/offers') {
      return (
        <ShopPage
          queryString={search}
          offersOnly
          onNavigate={navigate}
          onFeedback={showFeedback}
        />
      );
    }
    if (pathname.startsWith('/product/')) {
      const slug = pathname.replace('/product/', '');
      return <ProductDetail slug={slug} onNavigate={navigate} onFeedback={showFeedback} />;
    }
    if (pathname === '/compare') {
      return <ComparePage onNavigate={navigate} />;
    }
    if (pathname === '/checkout') {
      return <CheckoutPage onNavigate={navigate} onFeedback={showFeedback} />;
    }
    if (pathname === '/login') {
      return (
        <AuthPages
          queryString={search}
          onNavigate={navigate}
          onFeedback={showFeedback}
        />
      );
    }
    if (pathname === '/customer-login') {
      return (
        <AuthPages
          defaultPortal="customer"
          queryString={search}
          onNavigate={navigate}
          onFeedback={showFeedback}
        />
      );
    }
    if (pathname === '/shopkeeper-login') {
      return (
        <AuthPages
          defaultPortal="shopkeeper"
          queryString={search}
          onNavigate={navigate}
          onFeedback={showFeedback}
        />
      );
    }
    if (pathname === '/about') {
      return <AboutPage onNavigate={navigate} />;
    }
    if (pathname === '/contact') {
      return <ContactPage onNavigate={navigate} onFeedback={showFeedback} />;
    }
    if (pathname.startsWith('/dashboard')) {
      return (
        <DashboardLayout
          subRoute={pathname}
          onNavigate={navigate}
          onFeedback={showFeedback}
        />
      );
    }
    return <HomePage onNavigate={navigate} onFeedback={showFeedback} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-ink">
      <Navbar currentRoute={route} onNavigate={navigate} />

      <main className="flex-1">{renderPage()}</main>

      <Footer onNavigate={navigate} />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-maroon-900 text-champagne-50 border border-gold-500/40 px-4 py-3 rounded-xl shadow-xl text-xs font-medium max-w-sm"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </AuthProvider>
  );
}

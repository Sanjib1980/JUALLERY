import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { type MetalRateItem, type ProductItem } from '../lib/pricing';
import { useAuth } from './AuthContext';

export interface SiteSettingsData {
  brandName: string;
  tagline: string;
  gstin: string;
  supportEmail: string;
  supportPhone: string;
  headquartersAddress: string;
  upiId: string;
  bankDetails: string;
  defaultDeliveryCharge: string;
  freeDeliveryThreshold: string;
  heroBannerTitle: string;
  heroBannerSubtitle: string;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface CartLineItem {
  id: string;
  quantity: number;
  productId: string;
  product: ProductItem;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface StoreContextValue {
  settings: SiteSettingsData | null;
  categories: CategoryData[];
  metalRates: MetalRateItem[];
  cartItems: CartLineItem[];
  wishlistIds: string[];
  compareList: ProductItem[];
  notifications: NotificationItem[];
  refreshCatalogConfig: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateCartQty: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  toggleCompare: (product: ProductItem) => void;
  clearCompare: () => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue>({} as StoreContextValue);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettingsData | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [metalRates, setMetalRates] = useState<MetalRateItem[]>([]);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<ProductItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refreshCatalogConfig = useCallback(async () => {
    try {
      const [s, c, r] = await Promise.all([
        apiFetch<SiteSettingsData>('/api/settings'),
        apiFetch<CategoryData[]>('/api/categories'),
        apiFetch<MetalRateItem[]>('/api/metal-rates'),
      ]);
      setSettings(s);
      setCategories(c);
      setMetalRates(r);
    } catch (err) {
      console.error('Failed loading store configuration:', err);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setWishlistIds([]);
      setNotifications([]);
      return;
    }
    try {
      const [cartRes, wishRes, notifRes] = await Promise.all([
        apiFetch<{ items: CartLineItem[] }>('/api/cart'),
        apiFetch<string[]>('/api/wishlist'),
        apiFetch<NotificationItem[]>('/api/notifications'),
      ]);
      setCartItems(cartRes.items || []);
      setWishlistIds(wishRes || []);
      setNotifications(notifRes || []);
    } catch (err) {
      console.error('Failed loading user store data:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshCatalogConfig();
  }, [refreshCatalogConfig]);

  useEffect(() => {
    refreshUserData();
    if (!user) return;
    const timer = setInterval(refreshUserData, 20000);
    return () => clearInterval(timer);
  }, [user, refreshUserData]);

  const addToCart = async (productId: string, quantity = 1) => {
    if (!user) throw new Error('Please sign in to add jewellery to your shopping bag.');
    await apiFetch('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    await refreshUserData();
  };

  const updateCartQty = async (itemId: string, quantity: number) => {
    await apiFetch(`/api/cart/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    await refreshUserData();
  };

  const removeFromCart = async (itemId: string) => {
    await apiFetch(`/api/cart/${itemId}`, { method: 'DELETE' });
    await refreshUserData();
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) throw new Error('Please sign in to save pieces to your wishlist.');
    await apiFetch('/api/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    await refreshUserData();
  };

  const toggleCompare = (product: ProductItem) => {
    setCompareList((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 4) return [...prev.slice(1), product];
      return [...prev, product];
    });
  };

  const markNotificationRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <StoreContext.Provider
      value={{
        settings,
        categories,
        metalRates,
        cartItems,
        wishlistIds,
        compareList,
        notifications,
        refreshCatalogConfig,
        refreshUserData,
        addToCart,
        updateCartQty,
        removeFromCart,
        toggleWishlist,
        toggleCompare,
        clearCompare: () => setCompareList([]),
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);

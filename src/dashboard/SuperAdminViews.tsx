import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useStore } from '../context/StoreContext';

interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  isActive: boolean;
  roles: string[];
  shopkeeper?: { shopName: string; gstin?: string | null } | null;
}

export const SuperAdminPanel: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const { settings, refreshCatalogConfig } = useStore();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    shopName: '',
    gstin: '',
    shopAddress: '',
  });
  const [siteForm, setSiteForm] = useState({
    brandName: '',
    tagline: '',
    gstin: '',
    supportEmail: '',
    supportPhone: '',
    headquartersAddress: '',
    upiId: '',
    bankDetails: '',
    defaultDeliveryCharge: '250',
    freeDeliveryThreshold: '25000',
    heroBannerTitle: '',
    heroBannerSubtitle: '',
  });

  const loadUsers = async () => {
    try {
      const data = await apiFetch<UserListItem[]>('/api/admin/users');
      setUsers(data);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to load users.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (settings) {
      setSiteForm({
        brandName: settings.brandName || '',
        tagline: settings.tagline || '',
        gstin: settings.gstin || '',
        supportEmail: settings.supportEmail || '',
        supportPhone: settings.supportPhone || '',
        headquartersAddress: settings.headquartersAddress || '',
        upiId: settings.upiId || '',
        bankDetails: settings.bankDetails || '',
        defaultDeliveryCharge: String(settings.defaultDeliveryCharge || '250'),
        freeDeliveryThreshold: String(settings.freeDeliveryThreshold || '25000'),
        heroBannerTitle: settings.heroBannerTitle || '',
        heroBannerSubtitle: settings.heroBannerSubtitle || '',
      });
    }
  }, [settings]);

  const handleCreateShopkeeper = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/shopkeepers', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      setStaffForm({
        fullName: '',
        email: '',
        mobile: '',
        password: '',
        shopName: '',
        gstin: '',
        shopAddress: '',
      });
      onFeedback('Shopkeeper account created successfully.');
      loadUsers();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to create shopkeeper.');
    }
  };

  const handleRoleChange = async (userId: string, role: string, isActive: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role, isActive }),
      });
      onFeedback('User permissions updated.');
      loadUsers();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to update user permissions.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(siteForm),
      });
      await refreshCatalogConfig();
      onFeedback('Website configuration saved.');
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to save website settings.');
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h2 className="font-serif text-2xl text-maroon-900">
        Super Admin — Staff, Permissions & Website Configuration
      </h2>

      {/* Create Shopkeeper Account */}
      <form
        onSubmit={handleCreateShopkeeper}
        className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4 text-sm"
      >
        <h3 className="font-serif text-lg text-maroon-900">Create Shopkeeper / Staff Account</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <input required placeholder="Full Name" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
          <input required type="email" placeholder="Login Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
          <input required type="password" minLength={6} placeholder="Initial Password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
          <input required placeholder="Mobile Number" value={staffForm.mobile} onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
          <input required placeholder="Showroom / Shop Name" value={staffForm.shopName} onChange={(e) => setStaffForm({ ...staffForm, shopName: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
          <input placeholder="Showroom GSTIN" value={staffForm.gstin} onChange={(e) => setStaffForm({ ...staffForm, gstin: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        </div>
        <button type="submit" className="bg-maroon-800 text-champagne-50 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">
          Create Shopkeeper Account
        </button>
      </form>

      {/* User Permissions Table */}
      <section className="bg-white border border-champagne-200 rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-champagne-200">
          <h3 className="font-serif text-lg text-maroon-900">User Accounts & Role Permissions</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-maroon-800 text-champagne-50 text-xs">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Email & Mobile</th>
              <th className="p-3">Showroom</th>
              <th className="p-3">Assigned Role</th>
              <th className="p-3">Account Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-100">
            {users.map((u) => {
              const primaryRole = u.roles.includes('super_admin')
                ? 'super_admin'
                : u.roles.includes('shopkeeper')
                ? 'shopkeeper'
                : 'customer';
              return (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.fullName}</td>
                  <td className="p-3 text-xs">
                    <div>{u.email}</div>
                    <div className="font-mono text-ink/60">{u.mobile}</div>
                  </td>
                  <td className="p-3 text-xs">{u.shopkeeper?.shopName || '—'}</td>
                  <td className="p-3">
                    <select
                      value={primaryRole}
                      onChange={(e) => handleRoleChange(u.id, e.target.value, u.isActive)}
                      className="border border-champagne-200 rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="customer">Customer</option>
                      <option value="shopkeeper">Shopkeeper</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleRoleChange(u.id, primaryRole, !u.isActive)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                        u.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Website Settings */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4 text-sm"
      >
        <h3 className="font-serif text-lg text-maroon-900">Website & Checkout Configuration</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Brand Name</label>
            <input value={siteForm.brandName} onChange={(e) => setSiteForm({ ...siteForm, brandName: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Showroom GSTIN</label>
            <input value={siteForm.gstin} onChange={(e) => setSiteForm({ ...siteForm, gstin: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Store UPI ID</label>
            <input value={siteForm.upiId} onChange={(e) => setSiteForm({ ...siteForm, upiId: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Support Phone</label>
            <input value={siteForm.supportPhone} onChange={(e) => setSiteForm({ ...siteForm, supportPhone: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Default Delivery Charge (INR)</label>
            <input type="number" value={siteForm.defaultDeliveryCharge} onChange={(e) => setSiteForm({ ...siteForm, defaultDeliveryCharge: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Free Delivery Threshold (INR)</label>
            <input type="number" value={siteForm.freeDeliveryThreshold} onChange={(e) => setSiteForm({ ...siteForm, freeDeliveryThreshold: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-ink/60 mb-1">Bank Transfer Details</label>
            <input value={siteForm.bankDetails} onChange={(e) => setSiteForm({ ...siteForm, bankDetails: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-ink/60 mb-1">Hero Banner Headline</label>
            <input value={siteForm.heroBannerTitle} onChange={(e) => setSiteForm({ ...siteForm, heroBannerTitle: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-ink/60 mb-1">Hero Banner Subtitle</label>
            <input value={siteForm.heroBannerSubtitle} onChange={(e) => setSiteForm({ ...siteForm, heroBannerSubtitle: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
          </div>
        </div>
        <button type="submit" className="bg-gold-500 hover:bg-gold-600 text-white px-6 py-2.5 rounded-lg text-xs font-semibold cursor-pointer">
          Save Website Configuration
        </button>
      </form>
    </div>
  );
};

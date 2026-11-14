import React, { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../lib/api';
import { formatINR } from '../lib/pricing';
import { generateInvoicePDF } from '../lib/invoicePdf';
import { useStore } from '../context/StoreContext';
import type { OrderRecord } from './CustomerViews';

const ORDER_STATUSES = [
  'New Order',
  'Pending Confirmation',
  'Confirmed',
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
];

interface OverviewResponse {
  kpis: {
    totalProducts: number;
    totalCustomers: number;
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    totalSales: number;
    pendingPayments: number;
    lowStockCount: number;
  };
  lowStockProducts: Array<{ id: string; productCode: string; name: string; stockQty: number; lowStockThreshold: number }>;
  salesReports: {
    daily: Array<{ label: string; sales: number }>;
    weekly: Array<{ label: string; sales: number }>;
    monthly: Array<{ label: string; sales: number }>;
  };
}

export const ShopkeeperOverviewAndRates: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const { metalRates, refreshCatalogConfig } = useStore();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [ov, ords] = await Promise.all([
        apiFetch<OverviewResponse>('/api/staff/overview'),
        apiFetch<OrderRecord[]>('/api/staff/orders'),
      ]);
      setOverview(ov);
      setRecentOrders(ords.slice(0, 6));
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to load showroom overview.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRateSave = async (material: string, purity: string, fallback: string | number) => {
    const key = `${material}-${purity}`;
    const val = Number(rateDrafts[key] ?? fallback);
    try {
      await apiFetch('/api/staff/metal-rates', {
        method: 'PUT',
        body: JSON.stringify({ material, purity, ratePerGram: val }),
      });
      await refreshCatalogConfig();
      onFeedback(`Updated ${material} ${purity} live rate to ${formatINR(val)}/g.`);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to update metal rate.');
    }
  };

  if (!overview) return <div className="p-6 text-sm text-ink/60">Loading showroom metrics...</div>;

  const kpiCards = [
    { label: 'Total Sales', value: formatINR(overview.kpis.totalSales) },
    { label: 'Total Orders', value: overview.kpis.totalOrders },
    { label: 'Pending Orders', value: overview.kpis.pendingOrders },
    { label: 'Confirmed / Active', value: overview.kpis.confirmedOrders },
    { label: 'Delivered Orders', value: overview.kpis.deliveredOrders },
    { label: 'Pending Payments', value: overview.kpis.pendingPayments },
    { label: 'Total Products', value: overview.kpis.totalProducts },
    { label: 'Total Customers', value: overview.kpis.totalCustomers },
    { label: 'Low Stock Items', value: overview.kpis.lowStockCount },
  ];

  const chartSeries = overview.salesReports[reportPeriod] || [];

  return (
    <div className="p-6 space-y-8">
      <h2 className="font-serif text-2xl text-maroon-900">Showroom Performance & Live Rates</h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white border border-champagne-200 rounded-xl p-4">
            <div className="text-xs text-ink/60">{k.label}</div>
            <div className="font-serif text-xl sm:text-2xl font-bold text-maroon-900 mt-1 tabular-nums">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sales Report Chart */}
      <section className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-serif text-lg text-maroon-900">Sales Analytics</h3>
          <div className="flex bg-champagne-50 p-1 rounded-lg border border-champagne-200 text-xs">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setReportPeriod(p)}
                className={`px-3 py-1.5 rounded-md capitalize font-medium cursor-pointer ${
                  reportPeriod === p ? 'bg-maroon-800 text-white' : 'text-ink/70'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          {chartSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-ink/55">
              Sales chart will populate automatically as customer orders are placed.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries}>
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="sales" fill="#4A0E1E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Live Metal Rates Editor */}
      <section className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
        <h3 className="font-serif text-lg text-maroon-900">
          Configurable Live Metal Rates (₹ / gram)
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metalRates.map((r) => {
            const key = `${r.material}-${r.purity}`;
            return (
              <div key={key} className="bg-champagne-50 border border-champagne-200 rounded-xl p-3.5 space-y-2">
                <div className="text-xs font-semibold text-maroon-900">
                  {r.material} · {r.purity}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={rateDrafts[key] ?? String(r.ratePerGram)}
                    onChange={(e) => setRateDrafts({ ...rateDrafts, [key]: e.target.value })}
                    className="w-full border border-champagne-200 bg-white rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => handleRateSave(r.material, r.purity, r.ratePerGram)}
                    className="px-3 py-1.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Low Stock & Recent Orders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-champagne-200 rounded-xl p-5 space-y-3">
          <h3 className="font-serif text-lg text-maroon-900">Low Stock Alerts</h3>
          {overview.lowStockProducts.length === 0 ? (
            <p className="text-sm text-ink/60">All published jewellery items have healthy stock.</p>
          ) : (
            <div className="divide-y divide-champagne-100 text-sm">
              {overview.lowStockProducts.map((p) => (
                <div key={p.id} className="py-2 flex justify-between">
                  <span>
                    <span className="font-mono text-xs text-ink/60 mr-2">{p.productCode}</span>
                    {p.name}
                  </span>
                  <span className="font-mono font-bold text-red-700 tabular-nums">
                    {p.stockQty} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-champagne-200 rounded-xl p-5 space-y-3">
          <h3 className="font-serif text-lg text-maroon-900">Recent Orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-ink/60">No orders received yet.</p>
          ) : (
            <div className="divide-y divide-champagne-100 text-sm">
              {recentOrders.map((o) => (
                <div key={o.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-mono font-semibold text-maroon-900 text-xs">
                      {o.orderNumber}
                    </div>
                    <div className="text-xs text-ink/60">
                      {o.customer?.fullName} · {o.status}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums">
                    {formatINR(o.grandTotal)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export const ShopkeeperOrdersManager: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDelivery, setEditingDelivery] = useState<OrderRecord | null>(null);
  const [delForm, setDelForm] = useState({
    partnerName: '',
    partnerMobile: '',
    trackingNumber: '',
    dispatchDate: '',
    expectedDeliveryDate: '',
    deliveryStatus: 'Dispatched',
  });
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrderRecord[]>('/api/staff/orders');
      setOrders(data);
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await apiFetch(`/api/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onFeedback(`Order status updated to "${status}". Customer notified.`);
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleVerifyPayment = async (orderId: string, status: 'Paid' | 'Failed' | 'Refunded') => {
    try {
      await apiFetch(`/api/staff/payments/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onFeedback(`Payment marked as ${status}. Customer notified.`);
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to update payment.');
    }
  };

  const openDeliveryModal = (o: OrderRecord) => {
    setEditingDelivery(o);
    setDelForm({
      partnerName: o.delivery?.partnerName || 'BlueDart Insured Vault',
      partnerMobile: o.delivery?.partnerMobile || '',
      trackingNumber: o.delivery?.trackingNumber || '',
      dispatchDate: o.delivery?.dispatchDate || new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: o.delivery?.expectedDeliveryDate || '',
      deliveryStatus: o.delivery?.deliveryStatus || 'Dispatched',
    });
  };

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;
    try {
      await apiFetch(`/api/staff/deliveries/${editingDelivery.id}`, {
        method: 'PATCH',
        body: JSON.stringify(delForm),
      });
      setEditingDelivery(null);
      onFeedback('Delivery tracking updated & customer notified.');
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Failed to update delivery.');
    }
  };

  if (loading) return <div className="p-6 text-sm text-ink/60">Loading orders ledger...</div>;

  return (
    <div className="p-6 space-y-5">
      <h2 className="font-serif text-2xl text-maroon-900">
        Order, Payment Verification & Delivery Management
      </h2>

      {previewProof && (
        <div
          onClick={() => setPreviewProof(null)}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <span className="font-serif text-base text-maroon-900">Customer Payment Proof</span>
              <button onClick={() => setPreviewProof(null)} className="text-xs underline cursor-pointer">
                Close
              </button>
            </div>
            <img src={previewProof} alt="Payment proof" className="w-full rounded-lg max-h-[70vh] object-contain" />
          </div>
        </div>
      )}

      {editingDelivery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={saveDelivery}
            className="bg-white border border-champagne-200 rounded-2xl p-6 max-w-md w-full space-y-3 text-sm"
          >
            <h3 className="font-serif text-xl text-maroon-900">
              Dispatch & Delivery — {editingDelivery.orderNumber}
            </h3>
            <input required placeholder="Delivery Partner Name" value={delForm.partnerName} onChange={(e) => setDelForm({ ...delForm, partnerName: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
            <input required placeholder="Partner Contact Mobile" value={delForm.partnerMobile} onChange={(e) => setDelForm({ ...delForm, partnerMobile: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
            <input required placeholder="Tracking / AWB Number" value={delForm.trackingNumber} onChange={(e) => setDelForm({ ...delForm, trackingNumber: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Dispatch Date</label>
                <input type="date" value={delForm.dispatchDate} onChange={(e) => setDelForm({ ...delForm, dispatchDate: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Expected Delivery</label>
                <input type="date" value={delForm.expectedDeliveryDate} onChange={(e) => setDelForm({ ...delForm, expectedDeliveryDate: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
              </div>
            </div>
            <select value={delForm.deliveryStatus} onChange={(e) => setDelForm({ ...delForm, deliveryStatus: e.target.value })} className="w-full border border-champagne-200 rounded-lg px-3 py-2">
              {['Pending Dispatch', 'Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingDelivery(null)} className="px-4 py-2 border rounded-lg text-xs cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer">
                Save & Notify Customer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-champagne-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-maroon-800 text-champagne-50 text-xs">
            <tr>
              <th className="p-3">Order & Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Total</th>
              <th className="p-3">Order Status</th>
              <th className="p-3">Payment Verification</th>
              <th className="p-3">Delivery & Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink/60">
                  No customer orders placed yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-champagne-50/50 align-top">
                  <td className="p-3">
                    <div className="font-mono font-bold text-maroon-900">{o.orderNumber}</div>
                    <div className="text-xs text-ink/55 tabular-nums">
                      {new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.customer?.fullName}</div>
                    <div className="text-xs text-ink/60 font-mono">{o.customer?.mobile}</div>
                  </td>
                  <td className="p-3 font-mono font-bold tabular-nums">
                    {formatINR(o.grandTotal)}
                  </td>
                  <td className="p-3">
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      className="border border-champagne-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 space-y-1.5">
                    <div className="text-xs">
                      {o.payment?.method} · <strong>{o.payment?.status}</strong>
                    </div>
                    {o.payment?.transactionReference && (
                      <div className="text-xs font-mono text-ink/65">
                        Ref: {o.payment.transactionReference}
                      </div>
                    )}
                    {o.payment?.proofImageUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewProof(o.payment!.proofImageUrl!)}
                        className="text-xs text-maroon-800 underline block cursor-pointer"
                      >
                        View Screenshot Proof
                      </button>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => handleVerifyPayment(o.id, 'Paid')}
                        className="px-2 py-1 bg-emerald-700 text-white rounded text-[11px] cursor-pointer"
                      >
                        Verify Paid
                      </button>
                      <button
                        onClick={() => handleVerifyPayment(o.id, 'Failed')}
                        className="px-2 py-1 bg-red-700 text-white rounded text-[11px] cursor-pointer"
                      >
                        Failed
                      </button>
                      <button
                        onClick={() => handleVerifyPayment(o.id, 'Refunded')}
                        className="px-2 py-1 border border-champagne-200 rounded text-[11px] cursor-pointer"
                      >
                        Refund
                      </button>
                    </div>
                  </td>
                  <td className="p-3 space-y-1.5">
                    <button
                      onClick={() => openDeliveryModal(o)}
                      className="px-3 py-1.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs block w-full cursor-pointer"
                    >
                      {o.delivery?.trackingNumber
                        ? `AWB: ${o.delivery.trackingNumber}`
                        : 'Assign Delivery'}
                    </button>
                    {o.invoice && (
                      <button
                        onClick={() =>
                          generateInvoicePDF(o.invoice!, o.items, o.payment?.status || 'Pending')
                        }
                        className="px-3 py-1 border border-champagne-200 rounded-lg text-xs block w-full hover:bg-champagne-50 cursor-pointer"
                      >
                        Invoice PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ShopkeeperCustomersAndSupport: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const [customers, setCustomers] = useState<
    Array<{ userId: string; fullName: string; email: string; mobile: string; orderCount: number; totalSpend: number }>
  >([]);
  const [tickets, setTickets] = useState<
    Array<{ id: string; customerName: string; subject: string; message: string; status: string; adminReply: string | null }>
  >([]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = async () => {
    const [c, t] = await Promise.all([
      apiFetch<typeof customers>('/api/staff/customers'),
      apiFetch<typeof tickets>('/api/staff/support'),
    ]);
    setCustomers(c);
    setTickets(t);
  };

  useEffect(() => {
    load();
  }, []);

  const replyTicket = async (id: string) => {
    await apiFetch(`/api/staff/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Resolved', adminReply: replies[id] || 'Resolved by showroom concierge.' }),
    });
    onFeedback('Ticket updated.');
    load();
  };

  return (
    <div className="p-6 space-y-8">
      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-maroon-900">Customer Directory</h2>
        <div className="bg-white border border-champagne-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-maroon-800 text-champagne-50 text-xs">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Mobile</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Total Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-champagne-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink/60">
                    No registered customers yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.userId}>
                    <td className="p-3 font-medium">{c.fullName}</td>
                    <td className="p-3">{c.email}</td>
                    <td className="p-3 font-mono">{c.mobile || '—'}</td>
                    <td className="p-3 text-right font-mono tabular-nums">{c.orderCount}</td>
                    <td className="p-3 text-right font-mono tabular-nums font-semibold">
                      {formatINR(c.totalSpend)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-serif text-xl text-maroon-900">Customer Support Inquiries</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-ink/60">No open support tickets.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white border border-champagne-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between font-semibold text-maroon-900">
                  <span>{t.subject} — {t.customerName}</span>
                  <span className="text-xs">{t.status}</span>
                </div>
                <p className="text-ink/75">{t.message}</p>
                <div className="flex gap-2 pt-1">
                  <input
                    placeholder="Write official concierge reply..."
                    value={replies[t.id] ?? (t.adminReply || '')}
                    onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                    className="flex-1 border border-champagne-200 rounded-lg px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => replyTicket(t.id)}
                    className="px-4 py-1.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs cursor-pointer"
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

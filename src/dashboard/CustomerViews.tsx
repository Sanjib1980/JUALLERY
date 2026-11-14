import React, { useEffect, useState } from 'react';
import { apiFetch, uploadImageFile } from '../lib/api';
import { calculateJewelleryPrice, formatINR } from '../lib/pricing';
import { generateInvoicePDF, type InvoiceData, type InvoiceOrderItem } from '../lib/invoicePdf';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export interface OrderRecord {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  gstTotal: string;
  deliveryCharge: string;
  discountTotal: string;
  grandTotal: string;
  createdAt: string;
  rejectionReason: string | null;
  customer?: { fullName: string; email: string; mobile: string } | null;
  items: InvoiceOrderItem[];
  payment: {
    method: string;
    status: string;
    amount: string;
    transactionReference: string | null;
    proofImageUrl: string | null;
    receiptNumber: string | null;
    createdAt: string;
  } | null;
  delivery: {
    partnerName: string | null;
    partnerMobile: string | null;
    trackingNumber: string | null;
    dispatchDate: string | null;
    expectedDeliveryDate: string | null;
    deliveryStatus: string;
    customerMobile: string;
    deliveryAddress: { line1?: string; city?: string; state?: string; pincode?: string };
  } | null;
  invoice: InvoiceData | null;
}

const TRACK_STEPS = [
  'New Order',
  'Confirmed',
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export const CustomerProfileView: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ fullName, mobile }),
      });
      await refreshUser();
      onFeedback('Profile updated successfully.');
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-xl">
      <h2 className="font-serif text-2xl text-maroon-900">My Profile</h2>
      <form onSubmit={handleSave} className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4 text-sm">
        <div>
          <label className="block text-xs text-ink/60 mb-1">Email Address</label>
          <input
            disabled
            value={user?.email || ''}
            className="w-full border border-champagne-200 bg-champagne-50 rounded-lg px-3 py-2 text-ink/70"
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Full Name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-champagne-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Mobile Number</label>
          <input
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full border border-champagne-200 rounded-lg px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-maroon-800 text-champagne-50 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export const CustomerOrdersView: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofRef, setProofRef] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrderRecord[]>('/api/orders');
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

  const handleCancel = async (orderId: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      onFeedback('Order cancelled and inventory restored.');
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Cannot cancel order.');
    }
  };

  const handleUploadLateProof = async (orderId: string, file?: File) => {
    try {
      let proofImageUrl: string | undefined;
      if (file) proofImageUrl = await uploadImageFile(file);
      await apiFetch(`/api/orders/${orderId}/payment-proof`, {
        method: 'POST',
        body: JSON.stringify({
          transactionReference: proofRef[orderId] || undefined,
          proofImageUrl,
        }),
      });
      onFeedback('Payment verification details submitted for showroom review.');
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to submit proof.');
    }
  };

  if (loading) return <div className="p-6 text-sm text-ink/60">Loading your orders...</div>;

  return (
    <div className="p-6 space-y-5">
      <h2 className="font-serif text-2xl text-maroon-900">My Orders & Live Tracking</h2>
      {orders.length === 0 ? (
        <div className="bg-white border border-champagne-200 rounded-xl p-8 text-sm text-ink/65">
          You have not placed any jewellery orders yet.
        </div>
      ) : (
        orders.map((o) => {
          const canCancel = ['New Order', 'Pending Confirmation', 'Confirmed'].includes(o.status);
          const stepIndex = TRACK_STEPS.indexOf(o.status);

          return (
            <div key={o.id} className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-champagne-100 pb-3">
                <div>
                  <span className="font-mono font-bold text-maroon-900">{o.orderNumber}</span>
                  <span className="text-xs text-ink/55 ml-3 tabular-nums">
                    {new Date(o.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-xs font-semibold text-maroon-900">
                  Status: {o.status} · Payment: {o.payment?.status || 'Pending'} ({o.payment?.method})
                </div>
              </div>

              {/* Order Progress Bar */}
              {o.status !== 'Cancelled' && o.status !== 'Returned' && (
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {TRACK_STEPS.map((st, idx) => {
                    const reached = stepIndex >= idx || (o.status === 'Pending Confirmation' && idx === 0);
                    return (
                      <div key={st} className="text-center">
                        <div
                          className={`h-1.5 rounded-full ${
                            reached ? 'bg-maroon-800' : 'bg-champagne-200'
                          }`}
                        />
                        <span className="block text-[10px] text-ink/60 mt-1 truncate">{st}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="text-sm space-y-1.5">
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {it.productName} ({it.material} {it.purity}, {it.weightGrams}g) × {it.quantity}
                    </span>
                    <span className="font-mono tabular-nums">{formatINR(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              {o.delivery?.trackingNumber && (
                <div className="bg-champagne-50 border border-champagne-200 rounded-lg p-3 text-xs space-y-1">
                  <div>
                    <strong>Courier Partner:</strong> {o.delivery.partnerName} (
                    {o.delivery.partnerMobile}) · <strong>Tracking #:</strong>{' '}
                    <span className="font-mono">{o.delivery.trackingNumber}</span>
                  </div>
                  <div>
                    <strong>Delivery Status:</strong> {o.delivery.deliveryStatus}
                    {o.delivery.expectedDeliveryDate
                      ? ` · Expected: ${o.delivery.expectedDeliveryDate}`
                      : ''}
                  </div>
                </div>
              )}

              {o.payment?.status === 'Pending' && o.payment.method !== 'COD' && (
                <div className="bg-champagne-50 border border-champagne-200 rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs">
                  <input
                    placeholder="Update UTR / Ref #"
                    value={proofRef[o.id] || ''}
                    onChange={(e) => setProofRef({ ...proofRef, [o.id]: e.target.value })}
                    className="border border-champagne-200 bg-white rounded px-2.5 py-1.5"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadLateProof(o.id, e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => handleUploadLateProof(o.id)}
                    className="px-3 py-1.5 bg-maroon-800 text-white rounded cursor-pointer"
                  >
                    Submit Ref
                  </button>
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center pt-3 border-t border-champagne-100 gap-3">
                <div className="font-bold text-maroon-900 font-mono tabular-nums">
                  Grand Total: {formatINR(o.grandTotal)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.invoice && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          generateInvoicePDF(
                            o.invoice!,
                            o.items,
                            o.payment?.status || 'Pending',
                            'download'
                          )
                        }
                        className="px-3 py-1.5 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Download Invoice PDF
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          generateInvoicePDF(
                            o.invoice!,
                            o.items,
                            o.payment?.status || 'Pending',
                            'print'
                          )
                        }
                        className="px-3 py-1.5 border border-maroon-800 text-maroon-900 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Print Invoice
                      </button>
                    </>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(o.id)}
                      className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export const CustomerCartView: React.FC<{
  onNavigate: (r: string) => void;
  onFeedback: (m: string) => void;
}> = ({ onNavigate, onFeedback }) => {
  const { cartItems, metalRates, updateCartQty, removeFromCart } = useStore();
  const total = cartItems.reduce(
    (s, i) => s + calculateJewelleryPrice(i.product, metalRates).finalPrice * i.quantity,
    0
  );

  return (
    <div className="p-6 space-y-5">
      <h2 className="font-serif text-2xl text-maroon-900">Shopping Cart</h2>
      {cartItems.length === 0 ? (
        <div className="bg-white border border-champagne-200 rounded-xl p-8 text-sm space-y-3">
          <p className="text-ink/65">Your shopping bag is currently empty.</p>
          <button
            onClick={() => onNavigate('/shop')}
            className="px-5 py-2 bg-maroon-800 text-champagne-50 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Browse Jewellery
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cartItems.map((i) => {
            const p = calculateJewelleryPrice(i.product, metalRates);
            return (
              <div
                key={i.id}
                className="bg-white border border-champagne-200 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 text-sm"
              >
                <div>
                  <div className="font-serif text-base font-semibold text-maroon-900">
                    {i.product.name}
                  </div>
                  <div className="text-xs text-ink/60">
                    {i.product.material} · {i.product.purity} · {Number(i.product.weightGrams)}g ·{' '}
                    <span className="font-mono">{formatINR(p.finalPrice)}</span> each
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateCartQty(i.id, i.quantity - 1).catch((e) => onFeedback(e.message))}
                    className="w-8 h-8 border border-champagne-200 rounded-lg cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono tabular-nums w-6 text-center">{i.quantity}</span>
                  <button
                    onClick={() => updateCartQty(i.id, i.quantity + 1).catch((e) => onFeedback(e.message))}
                    className="w-8 h-8 border border-champagne-200 rounded-lg cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(i.id)}
                    className="text-xs text-red-700 underline ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          <div className="bg-champagne-100 border border-champagne-200 rounded-xl p-5 flex flex-wrap justify-between items-center gap-4">
            <div className="font-serif text-lg font-bold text-maroon-900 tabular-nums">
              Estimated Total (incl. GST): {formatINR(total)}
            </div>
            <button
              onClick={() => onNavigate('/checkout')}
              className="bg-maroon-800 hover:bg-maroon-900 text-champagne-50 px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerAddressesView: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const [addresses, setAddresses] = useState<
    Array<{
      id: string;
      label: string;
      recipientName: string;
      mobile: string;
      line1: string;
      city: string;
      state: string;
      pincode: string;
      isDefault: boolean;
    }>
  >([]);
  const [form, setForm] = useState({
    label: 'Home',
    recipientName: '',
    mobile: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const load = async () => {
    const data = await apiFetch<typeof addresses>('/api/addresses');
    setAddresses(data);
  };
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/addresses', { method: 'POST', body: JSON.stringify(form) });
      setForm({ label: 'Home', recipientName: '', mobile: '', line1: '', city: '', state: '', pincode: '' });
      onFeedback('Address added.');
      load();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to save address.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="font-serif text-2xl text-maroon-900">My Delivery Addresses</h2>
      <form
        onSubmit={handleCreate}
        className="bg-white border border-champagne-200 rounded-xl p-5 grid sm:grid-cols-2 gap-3 text-sm max-w-2xl"
      >
        <input required placeholder="Label (Home / Office)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="Recipient Name" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="Street / Flat" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <input required placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="border border-champagne-200 rounded-lg px-3 py-2" />
        <button type="submit" className="bg-maroon-800 text-champagne-50 rounded-lg py-2 font-semibold cursor-pointer">
          Save Address
        </button>
      </form>

      <div className="grid sm:grid-cols-2 gap-4">
        {addresses.map((a) => (
          <div key={a.id} className="bg-white border border-champagne-200 rounded-xl p-4 text-sm flex justify-between gap-3">
            <div>
              <div className="font-semibold text-maroon-900">
                {a.label} · {a.recipientName}
              </div>
              <div className="text-xs text-ink/70 mt-1">
                {a.line1}, {a.city}, {a.state} - {a.pincode}
              </div>
              <div className="text-xs font-mono text-ink/60 mt-0.5">{a.mobile}</div>
            </div>
            <button
              onClick={async () => {
                await apiFetch(`/api/addresses/${a.id}`, { method: 'DELETE' });
                load();
              }}
              className="text-xs text-red-700 underline h-fit cursor-pointer"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CustomerPaymentsAndInvoicesView: React.FC<{ mode: 'payments' | 'invoices' }> = ({
  mode,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  useEffect(() => {
    apiFetch<OrderRecord[]>('/api/orders').then(setOrders).catch(() => undefined);
  }, []);

  return (
    <div className="p-6 space-y-5">
      <h2 className="font-serif text-2xl text-maroon-900">
        {mode === 'payments' ? 'Payment History & Receipts' : 'Download GST Tax Invoices'}
      </h2>
      <div className="bg-white border border-champagne-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-maroon-800 text-champagne-50 text-xs">
            <tr>
              <th className="p-3">{mode === 'payments' ? 'Receipt #' : 'Invoice #'}</th>
              <th className="p-3">Order #</th>
              <th className="p-3">Method</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Amount</th>
              {mode === 'invoices' && <th className="p-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink/60">
                  No records available yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-champagne-50/60">
                  <td className="p-3 font-mono text-xs">
                    {mode === 'payments' ? o.payment?.receiptNumber : o.invoice?.invoiceNumber}
                  </td>
                  <td className="p-3 font-mono text-xs">{o.orderNumber}</td>
                  <td className="p-3">{o.payment?.method}</td>
                  <td className="p-3 font-semibold">{o.payment?.status}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{formatINR(o.grandTotal)}</td>
                  {mode === 'invoices' && (
                    <td className="p-3 text-right">
                      {o.invoice && (
                        <button
                          onClick={() =>
                            generateInvoicePDF(o.invoice!, o.items, o.payment?.status || 'Pending')
                          }
                          className="px-3 py-1 bg-maroon-800 text-champagne-50 rounded text-xs cursor-pointer"
                        >
                          Download PDF
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const CustomerSupportView: React.FC<{ onFeedback: (m: string) => void }> = ({
  onFeedback,
}) => {
  const [tickets, setTickets] = useState<
    Array<{ id: string; subject: string; message: string; status: string; adminReply: string | null; createdAt: string }>
  >([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const data = await apiFetch<typeof tickets>('/api/support');
    setTickets(data);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/support', { method: 'POST', body: JSON.stringify({ subject, message }) });
    setSubject('');
    setMessage('');
    onFeedback('Support request submitted.');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="font-serif text-2xl text-maroon-900">Support & Complaints</h2>
      <form onSubmit={submit} className="bg-white border border-champagne-200 rounded-xl p-5 space-y-3 max-w-xl text-sm">
        <input required placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
        <textarea required rows={3} placeholder="Describe your inquiry or issue..." value={message} onChange={(e) => setMessage(e.target.value)} className="w-full border border-champagne-200 rounded-lg px-3 py-2" />
        <button type="submit" className="bg-maroon-800 text-champagne-50 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer">
          Submit Ticket
        </button>
      </form>
      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="bg-white border border-champagne-200 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between font-semibold text-maroon-900">
              <span>{t.subject}</span>
              <span className="text-xs">{t.status}</span>
            </div>
            <p className="text-ink/75">{t.message}</p>
            {t.adminReply && (
              <div className="bg-champagne-50 p-2.5 rounded-lg text-xs text-maroon-900 mt-2">
                <strong>Showroom Reply:</strong> {t.adminReply}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

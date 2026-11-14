import React, { useEffect, useState } from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';
import { apiFetch, uploadImageFile } from '../lib/api';
import { calculateJewelleryPrice, formatINR } from '../lib/pricing';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

interface AddressRecord {
  id: string;
  label: string;
  recipientName: string;
  mobile: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface CheckoutPageProps {
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate, onFeedback }) => {
  const { user } = useAuth();
  const { cartItems, metalRates, settings, refreshUserData } = useStore();

  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    recipientName: '',
    mobile: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<
    'COD' | 'UPI' | 'QR Code' | 'Online Gateway' | 'Bank Transfer'
  >('UPI');
  const [txRef, setTxRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const loadAddresses = async () => {
    if (!user) return;
    try {
      const list = await apiFetch<AddressRecord[]>('/api/addresses');
      setAddresses(list);
      const def = list.find((a) => a.isDefault) || list[0];
      if (def) setSelectedAddressId(def.id);
      else setShowNewAddress(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load addresses.');
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-serif text-3xl text-maroon-900">Sign In to Complete Checkout</h1>
        <p className="text-sm text-ink/65">
          Your shopping bag and delivery addresses are secured in your personal account.
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

  const summary = cartItems.reduce(
    (acc, item) => {
      const p = calculateJewelleryPrice(item.product, metalRates);
      acc.subtotal += p.taxableValue * item.quantity;
      acc.gst += p.gstAmount * item.quantity;
      return acc;
    },
    { subtotal: 0, gst: 0 }
  );

  const threshold = Number(settings?.freeDeliveryThreshold ?? 25000);
  const baseDelivery = Number(settings?.defaultDeliveryCharge ?? 250);
  const deliveryFee = summary.subtotal + summary.gst < threshold ? baseDelivery : 0;
  const grandTotal = summary.subtotal + summary.gst + deliveryFee;

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiFetch<AddressRecord>('/api/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...addrForm, isDefault: addresses.length === 0 }),
      });
      await loadAddresses();
      setSelectedAddressId(created.id);
      setShowNewAddress(false);
      setAddrForm({
        label: 'Home',
        recipientName: '',
        mobile: '',
        line1: '',
        city: '',
        state: '',
        pincode: '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save address.');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddressId) return setError('Please select or save a delivery address.');
    if (cartItems.length === 0) return setError('Your shopping bag is empty.');

    setSubmitting(true);
    setError('');

    try {
      let proofImageUrl: string | undefined;
      if (proofFile) {
        proofImageUrl = await uploadImageFile(proofFile);
      }

      const res = await apiFetch<{ orderNumber: string }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod,
          idempotencyKey,
          customerNotes: notes || undefined,
          transactionReference: txRef || undefined,
          proofImageUrl,
        }),
      });

      await refreshUserData();
      onFeedback(`Order ${res.orderNumber} placed successfully!`);
      onNavigate('/dashboard/orders');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-serif text-3xl text-maroon-900 mb-6">Insured Jewellery Checkout</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Delivery Address */}
          <section className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-xl text-maroon-900">1. Delivery Address</h2>
              <button
                type="button"
                onClick={() => setShowNewAddress(!showNewAddress)}
                className="text-xs font-semibold text-maroon-800 underline cursor-pointer"
              >
                {showNewAddress ? 'Cancel New Address' : '+ Add New Address'}
              </button>
            </div>

            {addresses.length > 0 && (
              <div className="space-y-2.5">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      selectedAddressId === a.id
                        ? 'border-maroon-800 bg-champagne-50'
                        : 'border-champagne-200 hover:bg-champagne-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="checkout-address"
                      checked={selectedAddressId === a.id}
                      onChange={() => setSelectedAddressId(a.id)}
                      className="mt-1 accent-maroon-800"
                    />
                    <div className="text-sm">
                      <div className="font-semibold text-maroon-900">
                        {a.recipientName} · {a.label} ·{' '}
                        <span className="font-mono">{a.mobile}</span>
                      </div>
                      <div className="text-ink/70 text-xs mt-0.5">
                        {a.line1}, {a.city}, {a.state} - {a.pincode}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {showNewAddress && (
              <form
                onSubmit={handleSaveNewAddress}
                className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-champagne-100 text-sm"
              >
                <input
                  required
                  placeholder="Label (Home / Office)"
                  value={addrForm.label}
                  onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="Recipient Full Name"
                  value={addrForm.recipientName}
                  onChange={(e) => setAddrForm({ ...addrForm, recipientName: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="Mobile Number"
                  value={addrForm.mobile}
                  onChange={(e) => setAddrForm({ ...addrForm, mobile: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="Street Address / Flat No."
                  value={addrForm.line1}
                  onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="City"
                  value={addrForm.city}
                  onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="State"
                  value={addrForm.state}
                  onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <input
                  required
                  placeholder="Pincode"
                  value={addrForm.pincode}
                  onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })}
                  className="border border-champagne-200 rounded-lg px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-maroon-800 text-champagne-50 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Save & Select Address
                </button>
              </form>
            )}
          </section>

          {/* Step 2: Payment Method */}
          <form onSubmit={handlePlaceOrder} id="place-order-form" className="bg-white border border-champagne-200 rounded-xl p-5 space-y-4">
            <h2 className="font-serif text-xl text-maroon-900">2. Payment Method</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(['COD', 'UPI', 'QR Code', 'Online Gateway', 'Bank Transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    paymentMethod === m
                      ? 'bg-maroon-800 text-champagne-50 border-maroon-800'
                      : 'bg-champagne-50 text-maroon-900 border-champagne-200 hover:bg-champagne-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {paymentMethod !== 'COD' && (
              <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div>
                      <strong className="text-maroon-900">UPI ID:</strong>{' '}
                      <span className="font-mono">{settings?.upiId || 'aureliajewels@icici'}</span>
                    </div>
                    <div className="text-xs text-ink/75">
                      <strong>Bank Account:</strong>{' '}
                      {settings?.bankDetails ||
                        'Aurelia Jewels Pvt Ltd | A/C: 001122334455 | IFSC: ICIC0000011'}
                    </div>
                  </div>
                  {paymentMethod === 'QR Code' && (
                    <div className="p-2.5 bg-white border border-champagne-200 rounded-lg shrink-0 text-center">
                      <QrCode className="w-12 h-12 text-maroon-900 mx-auto" />
                      <span className="text-[10px] font-mono text-ink/60 block mt-1">
                        Scan UPI QR
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-maroon-800 bg-white border border-champagne-200 rounded-lg p-2.5">
                  Security Notice: Uploading a payment screenshot or reference logs your claim, but
                  payment status remains <strong>Pending</strong> until verified by our showroom
                  finance team or payment gateway.
                </p>

                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="UTR / Transaction Reference Number (optional for gateway)"
                  className="w-full border border-champagne-200 bg-white rounded-lg px-3 py-2 text-sm"
                />

                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Upload Payment Screenshot (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional order notes (ring size, engraving, preferred delivery window)..."
              className="w-full border border-champagne-200 rounded-lg p-3 text-sm"
            />
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-champagne-50 border border-champagne-200 rounded-2xl p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl text-maroon-900 border-b border-champagne-200 pb-3">
              Order Summary ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
            </h2>

            <div className="space-y-2.5 max-h-60 overflow-y-auto text-sm">
              {cartItems.map((item) => {
                const p = calculateJewelleryPrice(item.product, metalRates);
                return (
                  <div key={item.id} className="flex justify-between gap-2">
                    <div>
                      <div className="font-medium text-maroon-900">{item.product.name}</div>
                      <div className="text-xs text-ink/60">
                        {item.product.purity} · {Number(item.product.weightGrams)}g × {item.quantity}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-medium">
                      {formatINR(p.finalPrice * item.quantity)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-champagne-200 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink/70">Taxable Subtotal</span>
                <span className="font-mono tabular-nums">{formatINR(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/70">Total GST</span>
                <span className="font-mono tabular-nums">{formatINR(summary.gst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/70">Insured Delivery</span>
                <span className="font-mono tabular-nums">
                  {deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-maroon-900 pt-3 border-t border-champagne-200">
                <span>Payable Total</span>
                <span className="font-mono tabular-nums">{formatINR(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="place-order-form"
              disabled={submitting || cartItems.length === 0 || !selectedAddressId}
              className="w-full bg-maroon-800 hover:bg-maroon-900 text-champagne-50 py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-45 cursor-pointer"
            >
              {submitting ? 'Confirming Order...' : 'Place Insured Order'}
            </button>

            <div className="flex items-center gap-2 text-xs text-ink/60 justify-center">
              <ShieldCheck className="w-4 h-4 text-gold-600" />
              <span>Atomic stock lock & verified GST invoice included</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

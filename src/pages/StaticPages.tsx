import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export const AboutPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { settings } = useStore();
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            Our Heritage
          </p>
          <h1 className="font-serif text-4xl text-maroon-900">
            {settings?.brandName || 'Aurelia Heritage Jewels'}
          </h1>
          <p className="text-sm text-ink/75 leading-relaxed">
            Founded on transparent bullion valuation and master karigar artistry, every piece in
            our showroom pairs traditional Indian heritage motifs with certified contemporary
            precision.
          </p>
          <p className="text-sm text-ink/75 leading-relaxed">
            We publish live daily gold and silver rates directly from our showroom ledger,
            itemizing weight, making charges, stone value, and GST so clients shop with complete
            clarity.
          </p>
          <button
            onClick={() => onNavigate('/shop')}
            className="px-6 py-3 bg-maroon-800 text-champagne-50 rounded-lg text-sm font-semibold cursor-pointer"
          >
            Browse Curated Pieces
          </button>
        </div>

        <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-champagne-200">
          <img
            src="/src/assets/images/necklace_royal_gold_1794651704151.jpg"
            alt="Master Gold Craftsmanship"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC<{
  onNavigate: (route: string) => void;
  onFeedback: (msg: string) => void;
}> = ({ onNavigate, onFeedback }) => {
  const { user } = useAuth();
  const { settings } = useStore();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onFeedback('Please sign in so our concierge can link your inquiry to your account.');
      return onNavigate('/login');
    }
    setSending(true);
    try {
      await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({ subject, message }),
      });
      setSubject('');
      setMessage('');
      onFeedback('Concierge ticket logged! Track replies inside My Account → Support.');
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Unable to send inquiry.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-2 gap-10">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
          Showroom Concierge
        </p>
        <h1 className="font-serif text-4xl text-maroon-900">Contact Us</h1>
        <p className="text-sm text-ink/75 leading-relaxed">
          Reach our gemologists and client concierge for custom bridal trousseaus, hallmarking
          verification, or order assistance.
        </p>
        <div className="bg-champagne-50 border border-champagne-200 rounded-xl p-5 space-y-2 text-sm">
          <div>
            <strong className="text-maroon-900">Address:</strong>{' '}
            {settings?.headquartersAddress || 'Zaveri Bazaar Heritage Arcade, Mumbai 400002'}
          </div>
          <div>
            <strong className="text-maroon-900">Phone:</strong>{' '}
            <span className="font-mono">{settings?.supportPhone || '+91 98765 43210'}</span>
          </div>
          <div>
            <strong className="text-maroon-900">Email:</strong>{' '}
            {settings?.supportEmail || 'concierge@aureliajewels.com'}
          </div>
          <div>
            <strong className="text-maroon-900">GSTIN:</strong>{' '}
            <span className="font-mono">{settings?.gstin || '27AABCA9603R1ZM'}</span>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-champagne-200 rounded-2xl p-6 space-y-4 text-sm"
      >
        <h2 className="font-serif text-xl text-maroon-900">Send Concierge Inquiry</h2>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (e.g., Bridal Consultation or Custom Sizing)"
          className="w-full border border-champagne-200 rounded-lg p-2.5"
        />
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
          className="w-full border border-champagne-200 rounded-lg p-2.5"
        />
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-maroon-800 hover:bg-maroon-900 text-champagne-50 py-2.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Submit Inquiry'}
        </button>
      </form>
    </div>
  );
};

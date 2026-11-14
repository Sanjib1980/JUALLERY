import React from 'react';
import { calculateJewelleryPrice, formatINR } from '../lib/pricing';
import { useStore } from '../context/StoreContext';

export const ComparePage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { compareList, metalRates, toggleCompare, clearCompare } = useStore();

  if (compareList.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-serif text-3xl text-maroon-900">Compare Jewellery</h1>
        <p className="text-sm text-ink/65">
          Select up to 4 jewellery pieces from the catalog to compare purity, weight, making
          charges, and final pricing side by side.
        </p>
        <button
          onClick={() => onNavigate('/shop')}
          className="px-6 py-2.5 bg-maroon-800 text-champagne-50 rounded-lg text-sm font-semibold cursor-pointer"
        >
          Browse Collection
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-serif text-3xl text-maroon-900">Side-by-Side Comparison</h1>
        <button
          onClick={clearCompare}
          className="text-xs font-semibold text-red-700 underline cursor-pointer"
        >
          Clear Comparison
        </button>
      </div>

      <div className="overflow-x-auto bg-white border border-champagne-200 rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-maroon-800 text-champagne-50">
            <tr>
              <th className="p-4 font-semibold">Specification</th>
              {compareList.map((p) => (
                <th key={p.id} className="p-4 font-serif text-base">
                  <div>{p.name}</div>
                  <button
                    onClick={() => toggleCompare(p)}
                    className="text-[11px] font-sans text-gold-400 underline mt-1 cursor-pointer"
                  >
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-champagne-100">
            <tr>
              <td className="p-4 font-medium text-ink/70">Product ID</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4 font-mono">
                  {p.productCode}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-ink/70">Category</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4">
                  {p.categoryName}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-ink/70">Material & Purity</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4">
                  {p.material} ({p.purity})
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-ink/70">Gross Weight</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4 tabular-nums">
                  {Number(p.weightGrams)} g
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-ink/70">Making Charges</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4 font-mono tabular-nums">
                  {formatINR(p.makingCharges)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-ink/70">Stone Charges</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4 font-mono tabular-nums">
                  {formatINR(p.stoneCharges)}
                </td>
              ))}
            </tr>
            <tr className="bg-champagne-50 font-bold text-maroon-900">
              <td className="p-4">Final Selling Price (incl. GST)</td>
              {compareList.map((p) => (
                <td key={p.id} className="p-4 font-mono tabular-nums text-base">
                  {formatINR(calculateJewelleryPrice(p, metalRates).finalPrice)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

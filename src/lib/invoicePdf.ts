import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string;
  totalAmount: string | number;
  shopSnapshot: {
    brandName?: string;
    gstin?: string;
    address?: string;
    phone?: string;
  };
  customerSnapshot: {
    name?: string;
    email?: string;
    mobile?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
  taxSummary: {
    subtotal?: number;
    gstTotal?: number;
    deliveryCharge?: number;
    discountTotal?: number;
  };
}

export interface InvoiceOrderItem {
  productCode: string;
  productName: string;
  material: string;
  purity: string;
  weightGrams: string | number;
  makingCharges: string | number;
  gstAmount: string | number;
  quantity: number;
  lineTotal: string | number;
}

export function generateInvoicePDF(
  invoice: InvoiceData,
  orderItems: InvoiceOrderItem[],
  paymentStatus: string,
  mode: 'download' | 'print' = 'download'
) {
  const doc = new jsPDF();
  const shop = invoice.shopSnapshot || {};
  const cust = invoice.customerSnapshot || {};
  const tax = invoice.taxSummary || {};

  // Luxury Maroon & Gold Header
  doc.setFillColor(74, 14, 30);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(20);
  doc.text(shop.brandName || 'Aurelia Heritage Jewels', 14, 16);

  doc.setTextColor(247, 239, 226);
  doc.setFontSize(9);
  doc.text(`GSTIN: ${shop.gstin || 'N/A'}  |  Helpline: ${shop.phone || ''}`, 14, 23);
  doc.text(`${shop.address || ''}`, 14, 29);

  // Invoice & Customer Info
  doc.setTextColor(36, 21, 25);
  doc.setFontSize(12);
  doc.text(`TAX INVOICE: ${invoice.invoiceNumber}`, 14, 48);
  doc.setFontSize(9);
  doc.text(`Issued Date: ${new Date(invoice.issuedAt).toLocaleDateString('en-IN')}`, 14, 54);
  doc.text(`Payment Status: ${paymentStatus}`, 14, 60);

  doc.setFontSize(10);
  doc.text('Billed & Shipped To:', 122, 48);
  doc.setFontSize(9);
  doc.text(`${cust.name || ''}`, 122, 54);
  doc.text(`Mobile: ${cust.mobile || ''}  |  ${cust.email || ''}`, 122, 59);
  const addrLine = [
    cust.address?.line1,
    cust.address?.city,
    cust.address?.state,
    cust.address?.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  doc.text(addrLine, 122, 64, { maxWidth: 74 });

  autoTable(doc, {
    startY: 76,
    headStyles: { fillColor: [74, 14, 30], textColor: [247, 239, 226] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    head: [['Code', 'Jewellery Item', 'Spec & Wt', 'Making', 'GST', 'Qty', 'Total (INR)']],
    body: orderItems.map((it) => [
      it.productCode,
      it.productName,
      `${it.material} ${it.purity} (${it.weightGrams}g)`,
      `Rs.${Number(it.makingCharges).toFixed(0)}`,
      `Rs.${Number(it.gstAmount).toFixed(0)}`,
      String(it.quantity),
      `Rs.${Number(it.lineTotal).toFixed(2)}`,
    ]),
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110) + 10;
  doc.setFontSize(9.5);
  doc.text(`Taxable Subtotal: Rs.${Number(tax.subtotal || 0).toFixed(2)}`, 132, finalY);
  doc.text(`Total GST: Rs.${Number(tax.gstTotal || 0).toFixed(2)}`, 132, finalY + 6);
  doc.text(`Insured Delivery: Rs.${Number(tax.deliveryCharge || 0).toFixed(2)}`, 132, finalY + 12);
  if (Number(tax.discountTotal || 0) > 0) {
    doc.text(`Offer Discount: -Rs.${Number(tax.discountTotal || 0).toFixed(2)}`, 132, finalY + 18);
  }
  doc.setFontSize(12);
  doc.setTextColor(74, 14, 30);
  doc.text(`Grand Total: Rs.${Number(invoice.totalAmount).toFixed(2)}`, 132, finalY + 26);

  doc.setFontSize(8);
  doc.setTextColor(110, 100, 100);
  doc.text('Certified BIS Hallmarked Jewellery. Computer-generated tax invoice.', 14, 282);

  if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(`${invoice.invoiceNumber}.pdf`);
  }
}

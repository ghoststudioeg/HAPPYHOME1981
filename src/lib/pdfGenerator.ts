import { toCanvas, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Order, StoreSettings } from '../types';

export interface PdfGenerationResult {
  blob: Blob;
  file: File;
  filename: string;
  download: () => void;
}

/**
 * Generates a clean A4 PDF file from an HTML element (e.g. invoice DOM element)
 * Uses html-to-image which natively supports modern CSS color functions (oklch, lab, color-mix)
 */
export async function generateInvoicePdfFromElement(
  element: HTMLElement,
  invoiceNumber: string
): Promise<PdfGenerationResult> {
  const safeInvNum = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `فاتورة-${safeInvNum}.pdf`;

  let imgData: string;
  let canvasWidth: number;
  let canvasHeight: number;

  try {
    const canvas = await toCanvas(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
      fontEmbedCSS: ''
    });
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    imgData = canvas.toDataURL('image/jpeg', 0.98);
  } catch (canvasErr) {
    console.warn('toCanvas failed, falling back to toPng:', canvasErr);
    imgData = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
      fontEmbedCSS: ''
    });

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = imgData;
    });
    canvasWidth = img.naturalWidth || element.offsetWidth * 2 || 800;
    canvasHeight = img.naturalHeight || element.offsetHeight * 2 || 1100;
  }

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  const margin = 10; // 10mm margin
  const imgWidth = pdfWidth - margin * 2; // 190mm
  const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pdfHeight - margin * 2);

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - margin * 2);
  }

  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  const download = () => {
    // Standard client download
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  return {
    blob: pdfBlob,
    file: pdfFile,
    filename,
    download
  };
}

/**
 * Generates formatted Arabic text summary of an order for WhatsApp
 */
export function buildOrderTextForWhatsApp(order: Order, storeSettings?: StoreSettings | null): string {
  const storeName = storeSettings?.storeName || 'متجر البيت السعيد';
  const invoiceNum = order.invoiceNumber || (order.invoiceId ? `INV-${order.invoiceId.slice(-6).toUpperCase()}` : `INV-${order.id.slice(-6).toUpperCase()}`);
  const orderNum = `#${order.id.slice(-8).toUpperCase()}`;

  const dateObj = new Date(order.createdAt || Date.now());
  const dateStr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

  const paymentMethodStr = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod'
    ? 'الدفع عند الاستلام'
    : order.paymentMethod;

  const statusStr = order.orderStatus === 'confirmed' ? 'مؤكد' :
    order.orderStatus === 'preparing' ? 'جاري التحضير' :
    order.orderStatus === 'ready_to_ship' ? 'جاهز للشحن' :
    order.orderStatus === 'shipped' ? 'تم الشحن' :
    order.orderStatus === 'delivered' ? 'تم التسليم' :
    order.orderStatus === 'cancelled' ? 'ملغي' : order.orderStatus;

  let itemsList = '';
  if (order.items && order.items.length > 0) {
    itemsList = order.items.map((item, idx) => {
      const pPrice = item.priceAtPurchase || 0;
      const lineTot = item.lineTotal || (pPrice * item.quantity);
      return `${idx + 1}. ${item.productName}\n   الكمية: ${item.quantity.toLocaleString('ar-EG')} × ${pPrice.toLocaleString('ar-EG')} ج.م = ${lineTot.toLocaleString('ar-EG')} ج.م`;
    }).join('\n');
  }

  const lines = [
    `*${storeName}*`,
    `📋 *تفاصيل الطلب والفاتورة*`,
    ``,
    `🔖 *رقم الفاتورة:* ${invoiceNum}`,
    `📦 *رقم الطلب:* ${orderNum}`,
    `📅 *التاريخ:* ${dateStr}`,
    ``,
    `👤 *العميل:* ${order.customerName || 'عميل'}`,
    `📱 *الهاتف:* ${order.customerPhone || ''}`,
    `📍 *العنوان:* ${order.shippingAddress || 'غير محدد'}`,
    ``,
    `🛒 *المنتجات والمشتريات:*`,
    itemsList,
    ``,
    `💵 *الإجمالي الفرعي:* ${order.subtotal.toLocaleString('ar-EG')} ج.م`,
    order.discount > 0 ? `🎟️ *الخصم:* -${order.discount.toLocaleString('ar-EG')} ج.م` : null,
    order.selectedInsurance ? `🛡️ *تأمين فوري (${order.selectedInsurance.name}):* ${order.selectedInsurance.isFree ? 'مشمول مجانًا' : `${order.selectedInsurance.insurancePrice.toLocaleString('ar-EG')} ج.م`}` : null,
    `🚚 *مصاريف الشحن:* ${order.shippingCost > 0 ? `${order.shippingCost.toLocaleString('ar-EG')} ج.م` : 'مجاني'}`,
    `💰 *الإجمالي النهائي:* *${order.total.toLocaleString('ar-EG')} ج.م*`,
    ``,
    `💳 *طريقة الدفع:* ${paymentMethodStr}`,
    `📌 *حالة الطلب:* ${statusStr}`,
    ``,
    `شكرًا لاختياركم ${storeName} ❤️`
  ].filter(line => line !== null);

  return lines.join('\n');
}

/**
 * Format recipient phone number safely for WhatsApp wa.me link
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces, plus, dashes, brackets
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    // Egyptian number without country code
    cleaned = '2' + cleaned;
  }
  return cleaned;
}

/**
 * Open WhatsApp Click-to-Chat with pre-filled message
 */
export function openWhatsAppClickToChat(phone: string, message: string): void {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedMsg = encodeURIComponent(message);
  let url = `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
  if (!formattedPhone) {
    url = `https://wa.me/?text=${encodedMsg}`;
  }
  window.open(url, '_blank');
}

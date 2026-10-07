import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { StoreSettings, OrderItem, Order, Address, Coupon, Promotion, HeroBanner, Product } from '../types';
import { orderService } from '../lib/data/orderService';
import { userService } from '../lib/data/userService';
import { couponService } from '../lib/data/couponService';
import { promotionService } from '../lib/data/promotionService';
import { homepageService } from '../lib/data/homepageService';
import { getEffectiveProductPrice } from '../lib/campaignPricing';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ClipboardList,
  User as UserIcon,
  Phone,
  MapPin,
  FileText,
  CheckCircle,
  ShoppingBag,
  MessageCircle,
  LogIn,
  Ticket,
  Loader2,
  X
} from 'lucide-react';

import { analyticsService } from '../lib/data/analyticsService';


interface CartPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function CartPage({ navigate, settings }: CartPageProps) {
  const {
    user,
    profile,
    resolvedCartItems,
    cartCount,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    triggerToast
  } = useAuth();

  // Checkout states
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Saved addresses states
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // New address inline form state during checkout
  const [newAddrLabel, setNewAddrLabel] = useState('المنزل');
  const [newAddrRecipientName, setNewAddrRecipientName] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('');
  const [newAddrGovernorate, setNewAddrGovernorate] = useState('القاهرة');
  const [newAddrArea, setNewAddrArea] = useState('');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrBuilding, setNewAddrBuilding] = useState('');
  const [newAddrApartment, setNewAddrApartment] = useState('');
  const [newAddrFloor, setNewAddrFloor] = useState('');
  const [newAddrNotes, setNewAddrNotes] = useState('');
  const [newAddrIsDefault, setNewAddrIsDefault] = useState(false);

  // Coupon states
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Promotions and campaigns for accurate item pricing
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [activeBanners, setActiveBanners] = useState<HeroBanner[]>([]);

  React.useEffect(() => {
    Promise.all([
      promotionService.getActivePromotions().catch(() => []),
      homepageService.getActiveBanners().catch(() => [])
    ]).then(([promos, banners]) => {
      setActivePromotions(promos || []);
      setActiveBanners(banners || []);
    });
  }, []);

  const getItemPricing = React.useCallback((product: Product) => {
    if (product.id.startsWith('bundle_') || product.categoryId === 'bundle') {
      return {
        effectivePrice: product.price,
        originalBasePrice: product.oldPrice || product.price,
        isCampaignActive: false,
        discountAmount: 0,
        badgeText: '',
        isFlashSale: false
      };
    }
    return getEffectiveProductPrice(product, activeBanners, activePromotions);
  }, [activeBanners, activePromotions]);

  // Load addresses for logged in users (one-time fetch)
  React.useEffect(() => {
    let isMounted = true;
    if (user?.uid) {
      setLoadingAddresses(true);
      userService.getAddresses(user.uid).then((fetchedAddresses) => {
        if (!isMounted) return;
        setAddresses(fetchedAddresses);
        setLoadingAddresses(false);

        // Find default address to select automatically
        const defaultAddr = fetchedAddresses.find(a => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.addressId);
          setIsAddingNewAddress(false);
          setCustomerName(defaultAddr.recipientName);
          setCustomerPhone(defaultAddr.phone);
          setCustomerAddress(`${defaultAddr.governorate}، ${defaultAddr.area}، ${defaultAddr.street}، عمارة ${defaultAddr.building}${defaultAddr.floor ? `، ${defaultAddr.floor}` : ''}${defaultAddr.apartment ? `، شقة ${defaultAddr.apartment}` : ''}`);
        } else if (fetchedAddresses.length > 0) {
          // Select first one if no default
          setSelectedAddressId(fetchedAddresses[0].addressId);
          setIsAddingNewAddress(false);
          const firstAddr = fetchedAddresses[0];
          setCustomerName(firstAddr.recipientName);
          setCustomerPhone(firstAddr.phone);
          setCustomerAddress(`${firstAddr.governorate}، ${firstAddr.area}، ${firstAddr.street}، عمارة ${firstAddr.building}${firstAddr.floor ? `، ${firstAddr.floor}` : ''}${firstAddr.apartment ? `، شقة ${firstAddr.apartment}` : ''}`);
        } else {
          // No saved addresses, force adding new address
          setIsAddingNewAddress(true);
          setSelectedAddressId('new');
          setNewAddrRecipientName(profile?.displayName || user?.displayName || '');
          setNewAddrPhone(profile?.phone || '');
        }
      }).catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load addresses:', err);
        setLoadingAddresses(false);
      });
    } else {
      // Guest user
      setIsAddingNewAddress(true);
      setSelectedAddressId('new');
    }

    return () => {
      isMounted = false;
    };
  }, [user?.uid, profile?.displayName, profile?.phone]);

  const handleAddressSelectChange = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === 'new') {
      setIsAddingNewAddress(true);
      setNewAddrRecipientName(profile?.displayName || user?.displayName || '');
      setNewAddrPhone(profile?.phone || '');
      setNewAddrArea('');
      setNewAddrStreet('');
      setNewAddrBuilding('');
      setNewAddrApartment('');
      setNewAddrFloor('');
      setNewAddrNotes('');
    } else {
      setIsAddingNewAddress(false);
      const selected = addresses.find(a => a.addressId === addressId);
      if (selected) {
        setCustomerName(selected.recipientName);
        setCustomerPhone(selected.phone);
        setCustomerAddress(`${selected.governorate}، ${selected.area}، ${selected.street}، عمارة ${selected.building}${selected.floor ? `، ${selected.floor}` : ''}${selected.apartment ? `، شقة ${selected.apartment}` : ''}`);
        if (selected.notes) {
          setCustomerNotes(selected.notes);
        }
      }
    }
  };

  // Calculate prices using effective promotional pricing
  const itemsSubtotal = resolvedCartItems.reduce((acc, item) => {
    const pricing = getItemPricing(item.product);
    return acc + (pricing.effectivePrice * item.quantity);
  }, 0);
  
  // Update discount if items change and coupon is applied
  React.useEffect(() => {
    if (appliedCoupon) {
      handleApplyCoupon(appliedCoupon.code, true);
    }
  }, [itemsSubtotal]);

  const handleApplyCoupon = async (code: string, silent = false) => {
    if (!code.trim()) return;
    if (!silent) {
      setIsValidatingCoupon(true);
      setCouponError(null);
    }

    try {
      const orderItems: OrderItem[] = resolvedCartItems.map((item) => {
        const pricing = getItemPricing(item.product);
        return {
          productId: item.productId,
          productName: item.product.name,
          priceAtPurchase: pricing.effectivePrice,
          quantity: item.quantity,
          lineTotal: pricing.effectivePrice * item.quantity
        };
      });

      const result = await couponService.validateCoupon(
        code, 
        user?.uid || 'guest', 
        itemsSubtotal, 
        orderItems
      );

      if (result.valid) {
        setAppliedCoupon(result.coupon || null);
        setDiscountAmount(result.discountAmount);
        if (!silent) triggerToast('تم تطبيق كود الخصم بنجاح! 🎉');
      } else {
        if (!silent) {
          setCouponError(result.error || 'كود غير صالح');
        }
        setAppliedCoupon(null);
        setDiscountAmount(0);
      }
    } catch (err) {
      console.error('Coupon validation error:', err);
      if (!silent) setCouponError('حدث خطأ أثناء التحقق من الكود');
    } finally {
      if (!silent) setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCodeInput('');
    setCouponError(null);
  };

  const shippingCost = itemsSubtotal > 3000 ? 0 : 50; // Free shipping for orders above 3000 EGP
  const orderTotal = Math.max(0, itemsSubtotal - discountAmount + shippingCost);

  // Stock issue checking for all cart items
  const stockProblemItems = resolvedCartItems.filter(item =>
    item.product.isAvailable === false ||
    item.product.stockStatus === 'out_of_stock' ||
    item.product.stockStatus === 'coming_soon' ||
    (typeof item.product.stockQuantity === 'number' && item.product.stockQuantity < item.quantity)
  );
  const hasStockIssues = stockProblemItems.length > 0;

  const handleQuantityChange = (productId: string, currentQty: number, change: number) => {
    const nextQty = currentQty + change;
    if (nextQty <= 0) {
      if (confirm('هل ترغب في إزالة هذا المنتج من السلة؟')) {
        removeFromCart(productId);
      }
    } else {
      updateCartItemQuantity(productId, nextQty);
    }
  };

  const handleClearCart = () => {
    if (confirm('هل أنت متأكد من رغبتك في تفريغ السلة بالكامل؟')) {
      clearCart();
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalName = customerName.trim();
    let finalPhone = customerPhone.trim();
    let finalAddressString = customerAddress.trim();
    let finalNotes = customerNotes.trim();

    if (isAddingNewAddress) {
      // Validate the inline structured address fields
      if (!newAddrRecipientName.trim()) {
        triggerToast('يرجى إدخال اسم المستلم للعنوان الجديد.');
        return;
      }
      const egyptianPhoneRegex = /^(01[0125]\d{8}|(?:\+20|0020)?1[0125]\d{8})$/;
      if (!egyptianPhoneRegex.test(newAddrPhone.trim())) {
        triggerToast('يرجى إدخال رقم هاتف مصري صحيح للعنوان الجديد (مثال: 01012345678).');
        return;
      }
      if (!newAddrGovernorate) {
        triggerToast('يرجى اختيار المحافظة للعنوان الجديد.');
        return;
      }
      if (!newAddrArea.trim()) {
        triggerToast('يرجى إدخال المنطقة/المدينة للعنوان الجديد.');
        return;
      }
      if (!newAddrStreet.trim() || !newAddrBuilding.trim()) {
        triggerToast('يرجى إدخال اسم الشارع ورقم المبنى للعنوان الجديد.');
        return;
      }

      finalName = newAddrRecipientName.trim();
      finalPhone = newAddrPhone.trim();
      finalAddressString = `${newAddrGovernorate}، ${newAddrArea.trim()}، ${newAddrStreet.trim()}، عمارة ${newAddrBuilding.trim()}${newAddrFloor.trim() ? `، ${newAddrFloor.trim()}` : ''}${newAddrApartment.trim() ? `، شقة ${newAddrApartment.trim()}` : ''}`;
      
      if (newAddrNotes.trim()) {
        finalNotes = newAddrNotes.trim();
      }

      // If user is logged in, persist this address in their address book in the background
      if (user?.uid) {
        try {
          await userService.addAddress(user.uid, {
            label: newAddrLabel,
            recipientName: newAddrRecipientName.trim(),
            phone: newAddrPhone.trim(),
            governorate: newAddrGovernorate,
            area: newAddrArea.trim(),
            street: newAddrStreet.trim(),
            building: newAddrBuilding.trim(),
            apartment: newAddrApartment.trim() || undefined,
            floor: newAddrFloor.trim() || undefined,
            notes: newAddrNotes.trim() || undefined,
            isDefault: newAddrIsDefault
          });
        } catch (err) {
          console.error('Failed to save checkout address to address book:', err);
        }
      }
    }

    if (!finalName || !finalPhone || !finalAddressString) {
      triggerToast('يرجى ملء جميع الحقول الإلزامية الاسم، الهاتف، والعنوان.');
      return;
    }

    setIsSubmitting(true);

    try {
      // SECURE VALIDATION: Re-validate coupon just before submission
      let finalDiscount = 0;
      let finalCouponCode = '';
      
      if (appliedCoupon) {
        const orderItemsForValidation: OrderItem[] = resolvedCartItems.map((item) => {
          const pricing = getItemPricing(item.product);
          return {
            productId: item.productId,
            productName: item.product.name,
            priceAtPurchase: pricing.effectivePrice,
            quantity: item.quantity,
            lineTotal: pricing.effectivePrice * item.quantity
          };
        });

        const validation = await couponService.validateCoupon(
          appliedCoupon.code,
          user?.uid || 'guest',
          itemsSubtotal,
          orderItemsForValidation
        );

        if (!validation.valid) {
          triggerToast(`عذراً، لم يعد كود الخصم صالحاً: ${validation.error}`);
          setAppliedCoupon(null);
          setDiscountAmount(0);
          setIsSubmitting(false);
          return;
        }
        finalDiscount = validation.discountAmount;
        finalCouponCode = appliedCoupon.code;
      }

      const orderItems: OrderItem[] = resolvedCartItems.map((item) => {
        const pricing = getItemPricing(item.product);
        const isBundle = Boolean(item.isBundle || item.bundleId || item.productId.startsWith('bundle_'));
        return {
          productId: item.productId,
          productName: item.product.name,
          productImage: item.product.mainImageUrl || '',
          priceAtPurchase: pricing.effectivePrice,
          quantity: item.quantity,
          lineTotal: pricing.effectivePrice * item.quantity,
          isBundle,
          bundleId: item.bundleId || (isBundle ? item.productId.replace(/^bundle_/, '') : undefined),
          bundleName: isBundle ? item.product.name : undefined,
          bundleItems: isBundle && item.bundleProducts ? item.bundleProducts.map(bp => ({
            productId: bp.id,
            productName: bp.name,
            productImage: bp.mainImageUrl || '',
            originalPrice: bp.price || 0,
            sku: bp.sku || ''
          })) : undefined,
          installmentPlan: item.selectedInstallmentPlan
        };
      });

      const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        customerUid: user ? user.uid : 'guest',
        customerName: finalName,
        customerEmail: user && user.email ? user.email : 'guest@example.com',
        customerPhone: finalPhone,
        shippingAddress: finalAddressString,
        customerNotes: finalNotes || undefined,
        items: orderItems,
        subtotal: itemsSubtotal,
        discount: finalDiscount,
        shippingCost: shippingCost,
        total: Math.max(0, itemsSubtotal - finalDiscount + shippingCost),
        couponCode: finalCouponCode,
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'pending',
        orderStatus: 'new'
      };

      const orderId = await orderService.createOrder(orderData);
      
      analyticsService.trackEvent('order_created', { 
        userUid: user?.uid,
        metadata: { 
          orderId, 
          total: orderData.total,
          itemCount: orderData.items.length
        }
      });
      
      // Increment coupon usage if applied
      if (appliedCoupon) {
        await couponService.incrementUsage(appliedCoupon.id);
        analyticsService.trackEvent('coupon_used', {
          userUid: user?.uid,
          metadata: { couponCode: appliedCoupon.code, discountAmount: finalDiscount, orderId }
        });
      }
      
      const completePlacedOrder: Order = {
        ...orderData,
        id: orderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setPlacedOrderId(orderId);
      setPlacedOrder(completePlacedOrder);
      
      // Clear Firestore/Guest Cart state
      await clearCart();
      
      setCheckoutStep('success');
    } catch (err: any) {
      console.error('Checkout failed:', err);
      const msg = err?.message || 'حصل خطأ ما أثناء إرسال طلبك. حاول مجدداً.';
      triggerToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate WhatsApp Order forwarding message link
  const getWhatsAppOrderLink = () => {
    if (!placedOrder) return '';
    
    const storeWhatsApp = settings.whatsappNumber || '201000000000';
    
    let msg = `*طلب جديد من المتجر: ${settings.storeName}*\n`;
    msg += `---------------------------\n`;
    msg += `*رقم الطلب:* ${placedOrderId.slice(-6).toUpperCase()}\n`;
    msg += `*الاسم:* ${placedOrder.customerName}\n`;
    msg += `*الهاتف:* ${placedOrder.customerPhone}\n`;
    msg += `*العنوان:* ${placedOrder.shippingAddress}\n`;
    if (placedOrder.customerNotes) {
      msg += `*ملاحظات:* ${placedOrder.customerNotes}\n`;
    }
    msg += `---------------------------\n`;
    msg += `*المنتجات المطلوبة:*\n`;
    
    placedOrder.items.forEach((item, index) => {
      msg += `${index + 1}. ${item.productName} (الكمية: ${item.quantity}) - ${item.priceAtPurchase.toLocaleString('ar-EG')} ج.م\n`;
    });
    
    msg += `---------------------------\n`;
    msg += `*قيمة المشتريات:* ${placedOrder.subtotal.toLocaleString('ar-EG')} ج.م\n`;
    msg += `*الشحن:* ${placedOrder.shippingCost === 0 ? 'مجاني' : `${placedOrder.shippingCost.toLocaleString('ar-EG')} ج.م`}\n`;
    msg += `*إجمالي الطلب:* ${placedOrder.total.toLocaleString('ar-EG')} ج.م\n`;
    msg += `---------------------------\n`;
    msg += `شكراً لتسوقكم معنا 🌸`;

    return `https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(msg)}`;
  };

  // 1. Success Screen
  if (checkoutStep === 'success') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-8" dir="rtl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.15)] animate-bounce-subtle">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-black text-[var(--text-primary)]">تم استلام طلبك بنجاح!</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
            شكراً لتسوقك معنا في <span className="text-[#E0B84A] font-bold">{settings.storeName}</span>. 
            تم تسجيل طلبك بنجاح وسيتواصل معك فريق الشحن لتأكيد ميعاد التوصيل قريباً جداً.
          </p>
        </div>

        {placedOrder && (
          <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-right space-y-3.5 max-w-sm mx-auto">
            <div className="flex justify-between border-b border-[var(--border)] pb-2 text-xs text-[var(--text-muted)]">
              <span>رقم مرجع الطلب:</span>
              <span className="font-mono text-[var(--text-primary)] font-bold">{placedOrderId.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>الاسم المستلم:</span>
              <span className="text-[var(--text-primary)] font-bold">{placedOrder.customerName}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>إجمالي الحساب:</span>
              <span className="text-[#E0B84A] font-black">{placedOrder.total.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-3 max-w-sm mx-auto">
          <a
            href={getWhatsAppOrderLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <MessageCircle className="w-4 h-4 fill-white text-emerald-500" />
            <span>إرسال الطلب للمتجر عبر واتساب</span>
          </a>
          
          <button
            onClick={() => navigate('/products')}
            className="w-full py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            الرجوع ومتابعة التسوق
          </button>
        </div>
      </div>
    );
  }

  // 2. Empty State Screen
  if (resolvedCartItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6" dir="rtl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          <ShoppingCart className="w-10 h-10 text-[#E0B84A]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[var(--text-primary)]">سلة المشتريات فارغة</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
            لم تقم بإضافة أي منتجات إلى سلة مشترياتك بعد. تصفح أحدث عروضنا ومنتجاتنا الآن واملأ سلتك بأفضل الخصومات!
          </p>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 cursor-pointer transition-transform active:scale-98"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>ابدأ التسوق الآن</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Normal Cart and Checkout State
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-6 lg:pb-10" dir="rtl">
      {/* Breadcrumbs */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <button onClick={() => navigate('/')} className="hover:text-[var(--text-primary)] cursor-pointer">الرئيسية</button>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">سلة المشتريات</span>
      </nav>

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">سلة المشتريات 🛍️</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">لديك {cartCount} منتجات في السلة حالياً</p>
        </div>
        
        {checkoutStep === 'cart' && (
          <button
            onClick={handleClearCart}
            className="self-start sm:self-auto text-xs font-semibold text-rose-500 hover:text-rose-400 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>تفريغ السلة بالكامل</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart items list on Left */}
        <div className="lg:col-span-7 space-y-4">
          {checkoutStep === 'cart' ? (
            <div className="space-y-3.5">
              {resolvedCartItems.map((item) => {
                const isOutOfStock = !item.product.isAvailable || item.product.stockStatus === 'out_of_stock' || item.product.stockStatus === 'coming_soon';
                const hasExceededQty = typeof item.product.stockQuantity === 'number' && item.product.stockQuantity < item.quantity;
                const isProblematic = isOutOfStock || hasExceededQty;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden group ${
                      isProblematic
                        ? 'bg-rose-500/5 border border-rose-500/30'
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <img
                      src={getValidImageSrc(item.product.mainImageUrl || '/placeholder.png')}
                      alt={item.product.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-black/40 p-1.5 shrink-0 border border-[var(--border)]"
                    />

                    {/* Info */}
                    <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.isBundle || item.productId.startsWith('bundle_') ? (
                          <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                            عرض مركب (باقة توفير)
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/20">
                            {item.product.categoryName || 'قسم آخر'}
                          </span>
                        )}
                        {item.product.stockStatus === 'coming_soon' ? (
                          <span className="text-[9px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                            قريباً
                          </span>
                        ) : isOutOfStock ? (
                          <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                            نفد من المخزون
                          </span>
                        ) : hasExceededQty ? (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            المتاح {item.product.stockQuantity} فقط
                          </span>
                        ) : item.product.stockStatus === 'low_stock' ? (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            كمية محدودة
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                        {item.product.name}
                      </h3>

                      {/* Bundle items list if bundle */}
                      {item.bundleProducts && item.bundleProducts.length > 0 && (
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          <span className="font-bold text-[var(--text-primary)]">يشمل: </span>
                          {item.bundleProducts.map((bp) => bp.name).join(' + ')}
                        </p>
                      )}

                      {/* Installment plan pill if chosen */}
                      {item.selectedInstallmentPlan && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <span>💳 نظام التقسيط: {item.selectedInstallmentPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م شهرياً × {item.selectedInstallmentPlan.months} شهر</span>
                        </div>
                      )}
                      
                      {(() => {
                        const pricing = getItemPricing(item.product);
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-[#E0B84A]">
                              {pricing.effectivePrice.toLocaleString('ar-EG')} ج.م
                            </span>
                            {pricing.isCampaignActive ? (
                              <>
                                <span className="text-[10px] text-[var(--text-muted)] line-through">
                                  {pricing.originalBasePrice.toLocaleString('ar-EG')}
                                </span>
                                <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  {pricing.badgeText || (pricing.isFlashSale ? 'فلاش سيل' : 'عرض ترويجي')}
                                </span>
                              </>
                            ) : item.product.oldPrice && item.product.oldPrice > item.product.price ? (
                              <span className="text-[10px] text-[var(--text-muted)] line-through">
                                {item.product.oldPrice.toLocaleString('ar-EG')}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Quantity and Actions on Right */}
                    <div className="flex flex-col items-end justify-between gap-3 shrink-0">
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-[var(--text-muted)] hover:text-rose-500 p-1.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="إزالة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-1 shrink-0">
                        <button
                          onClick={() => handleQuantityChange(item.productId, item.quantity, 1)}
                          disabled={typeof item.product.stockQuantity === 'number' && item.quantity >= item.product.stockQuantity}
                          className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[#E0B84A] hover:bg-white/[0.05] disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        
                        <span className={`w-8 text-center text-xs font-bold font-mono select-none ${isProblematic ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                          {item.quantity.toLocaleString('ar-EG')}
                        </span>

                        <button
                          onClick={() => handleQuantityChange(item.productId, item.quantity, -1)}
                          className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[#E0B84A] hover:bg-white/[0.05] transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Checkout Step Checkout Details */
            <form onSubmit={handleCheckoutSubmit} className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-5">
              <h2 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <ClipboardList className="w-5 h-5 text-[#E0B84A]" />
                <span>بيانات شحن وتوصيل الطلب</span>
              </h2>

              {!user && (
                <div className="p-3.5 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[11px] text-[var(--text-secondary)] flex items-center justify-between gap-3">
                  <span>طلب كزائر. يمكنك ربط طلبك بحساب دائم لتتبعه وتجميع النقاط!</span>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-xs font-bold text-[#E0B84A] hover:underline cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </div>
              )}

              {/* Address Book Selector (For Logged in Users) */}
              {user && (
                <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-elevated)] border border-[#D4AF37]/20 relative overflow-hidden">
                  <label className="text-xs font-black text-[#E0B84A] block flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>العنوان المفضل للشحن والتوصيل</span>
                  </label>
                  
                  {loadingAddresses ? (
                    <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                      <span>جاري تحميل عناوينك المسجلة...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={selectedAddressId}
                        onChange={(e) => handleAddressSelectChange(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[#D4AF37]/50 focus:outline-none transition-all cursor-pointer appearance-none"
                      >
                        {addresses.map((addr) => (
                          <option key={addr.addressId} value={addr.addressId} className="bg-[var(--surface-elevated)] text-[var(--text-primary)]">
                            📍 {addr.label} - {addr.recipientName} ({addr.governorate}، {addr.area}) {addr.isDefault ? '⭐ [الافتراضي]' : ''}
                          </option>
                        ))}
                        <option value="new" className="bg-[var(--surface-elevated)] text-[var(--text-primary)]">➕ إضافة عنوان جديد ومختلف لهذا الطلب...</option>
                      </select>

                      {!isAddingNewAddress && addresses.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-[var(--text-primary)] text-sm">{customerName}</p>
                            <span className="text-[10px] bg-[#D4AF37]/15 text-[#E0B84A] px-2 py-0.5 rounded-full border border-[#D4AF37]/25">
                              العنوان المحدد للتوصيل
                            </span>
                          </div>
                          <p className="font-mono text-[var(--text-muted)] text-xs">{customerPhone}</p>
                          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{customerAddress}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add New Address Form Fields */}
              {isAddingNewAddress ? (
                <div className="space-y-4 pt-3 border-t border-[var(--border)]">
                  <div className="border-r-2 border-[#D4AF37] pr-2.5">
                    <h3 className="text-xs font-black text-[#E0B84A] flex items-center gap-1.5">
                      <span>تفاصيل عنوان الشحن الجديد</span>
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">يرجى تعبئة الحقول بدقة لضمان سرعة التوصيل دون تأخير.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Label */}
                    {user && (
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">حفظ التسمية كـ</label>
                        <select
                          value={newAddrLabel}
                          onChange={(e) => setNewAddrLabel(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all appearance-none"
                        >
                          <option value="المنزل" className="bg-[var(--surface-elevated)]">المنزل 🏠</option>
                          <option value="العمل" className="bg-[var(--surface-elevated)]">العمل 💼</option>
                          <option value="بيت العائلة" className="bg-[var(--surface-elevated)]">بيت العائلة 🏢</option>
                          <option value="أخرى" className="bg-[var(--surface-elevated)]">أخرى 📍</option>
                        </select>
                      </div>
                    )}

                    {/* Recipient Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">اسم المستلم بالكامل <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={newAddrRecipientName}
                        onChange={(e) => setNewAddrRecipientName(e.target.value)}
                        placeholder="مثال: أحمد محمد علي"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">رقم الموبايل للتواصل <span className="text-rose-500">*</span></label>
                      <input
                        type="tel"
                        required
                        value={newAddrPhone}
                        onChange={(e) => setNewAddrPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none font-mono focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Governorate */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">المحافظة <span className="text-rose-500">*</span></label>
                      <select
                        value={newAddrGovernorate}
                        onChange={(e) => setNewAddrGovernorate(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all appearance-none"
                      >
                        <option value="" className="bg-[var(--surface-elevated)]">اختر المحافظة...</option>
                        {['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الغربية', 'الشرقية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'].map((gov) => (
                          <option key={gov} value={gov} className="bg-[var(--surface-elevated)]">{gov}</option>
                        ))}
                      </select>
                    </div>

                    {/* Area */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">المنطقة / الحي / المدينة <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={newAddrArea}
                        onChange={(e) => setNewAddrArea(e.target.value)}
                        placeholder="مثال: مدينة نصر / الدقي"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Street */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">اسم الشارع بالكامل <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={newAddrStreet}
                        onChange={(e) => setNewAddrStreet(e.target.value)}
                        placeholder="مثال: شارع عباس العقاد الرئيسي"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Building */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">رقم المبنى / العمارة <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={newAddrBuilding}
                        onChange={(e) => setNewAddrBuilding(e.target.value)}
                        placeholder="مثال: عمارة رقم 15 أ"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Floor */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">الطابق (اختياري)</label>
                      <input
                        type="text"
                        value={newAddrFloor}
                        onChange={(e) => setNewAddrFloor(e.target.value)}
                        placeholder="مثال: الدور الخامس"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Apartment */}
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">رقم الشقة (اختياري)</label>
                      <input
                        type="text"
                        value={newAddrApartment}
                        onChange={(e) => setNewAddrApartment(e.target.value)}
                        placeholder="مثال: شقة رقم 4"
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Default checkbox */}
                    {user && (
                      <div className="flex items-center gap-2 h-11 sm:mt-6">
                        <input
                          type="checkbox"
                          id="saveNewAddrAsDefault"
                          checked={newAddrIsDefault}
                          onChange={(e) => setNewAddrIsDefault(e.target.checked)}
                          className="w-4 h-4 rounded-sm accent-[#D4AF37] cursor-pointer"
                        />
                        <label htmlFor="saveNewAddrAsDefault" className="text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                          حفظ كعنوان افتراضي في دفتر عناويني
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#94A3B8] mb-1.5">ملاحظات إضافية للتوصيل وموعد التسليم (اختياري)</label>
                    <textarea
                      rows={2}
                      value={newAddrNotes}
                      onChange={(e) => setNewAddrNotes(e.target.value)}
                      placeholder="علامة مميزة بجوار سوبرماركت... أو يرجى الاتصال قبل الوصول"
                      className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] outline-none resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* Notes Field if using Saved Address */
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] block">ملاحظات إضافية للطلب أو موعد التسليم (اختياري)</label>
                  <div className="relative">
                    <FileText className="absolute right-3.5 top-4.5 w-4 h-4 text-[var(--text-muted)]" />
                    <textarea
                      rows={2}
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="مثال: يرجى التوصيل بعد الساعة ٤ عصراً أو الاتصال قبل الوصول..."
                      className="w-full pr-11 pl-4 py-3 rounded-xl bg-[var(--surface)] focus:bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37]/50 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Checkout Form Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>تأكيد وتسجيل الطلب الآن</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  العودة لتعديل السلة
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pricing Summary on Right */}
        <div className="lg:col-span-5">
          <div className="bg-[var(--surface-elevated)] p-6 rounded-2xl border border-[var(--border)] space-y-6 sticky top-24">
            <h2 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3">ملخص الحساب</h2>

            {/* Coupon Section */}
            <div className="space-y-3 pb-2 border-b border-[var(--border)]">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">هل لديك كود خصم؟</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Ticket className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="أدخل الكود هنا"
                    disabled={!!appliedCoupon || isValidatingCoupon}
                    className={`w-full h-10 pr-9 pl-4 text-xs font-black tracking-widest bg-[var(--surface)] border border-[var(--border)] rounded-xl uppercase transition-all ${
                      appliedCoupon ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'text-[var(--text-primary)]'
                    }`}
                  />
                  {appliedCoupon && (
                    <button 
                      onClick={handleRemoveCoupon}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!appliedCoupon && (
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon(couponCodeInput)}
                    disabled={!couponCodeInput || isValidatingCoupon}
                    className="px-4 h-10 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/20 text-[#E0B84A] text-xs font-black transition-all disabled:opacity-50"
                  >
                    {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'تطبيق'}
                  </button>
                )}
              </div>
              {couponError && <p className="text-[10px] text-rose-500 font-bold mr-1">{couponError}</p>}
              {appliedCoupon && (
                <div className="flex items-center gap-2 px-2 text-[10px] text-emerald-500 font-bold">
                  <CheckCircle className="w-3 h-3" />
                  <span>تم تطبيق الخصم: {appliedCoupon.code}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>قيمة المشتريات:</span>
                <span className="font-mono text-[var(--text-primary)] font-semibold">{itemsSubtotal.toLocaleString('ar-EG')} ج.م</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-500 font-bold">
                  <span>خصم الكوبون:</span>
                  <span className="font-mono">-{discountAmount.toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>مصاريف الشحن والتوصيل:</span>
                {shippingCost === 0 ? (
                  <span className="text-emerald-500 font-bold">شحن مجاني ✨</span>
                ) : (
                  <span className="font-mono text-[var(--text-primary)] font-semibold">{shippingCost.toLocaleString('ar-EG')} ج.م</span>
                )}
              </div>
              
              {itemsSubtotal < 3000 && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                  أضف بمبلغ <span className="text-[#E0B84A] font-bold">{(3000 - itemsSubtotal).toLocaleString('ar-EG')} ج.م</span> إضافي للحصول على شحن <span className="text-emerald-500 font-bold">مجاني بالكامل!</span>
                </div>
              )}

              <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between text-sm">
                <span className="font-black text-[var(--text-primary)]">الإجمالي النهائي:</span>
                <span className="text-lg font-black text-[#E0B84A] font-mono">{orderTotal.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            {/* Step triggers */}
            {checkoutStep === 'cart' && (
              <div className="space-y-3">
                {hasStockIssues && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                    <span>يوجد منتجات غير متوفرة أو تتجاوز الكمية المتاحة في المخزون. يرجى تعديل السلة للمتابعة.</span>
                  </div>
                )}

                <button
                  disabled={hasStockIssues}
                  onClick={() => {
                    analyticsService.trackEvent('checkout_started', {
                      userUid: user?.uid,
                      metadata: { itemCount: cartCount, total: itemsSubtotal }
                    });
                    navigate('/checkout');
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:hover:brightness-100 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <span>المتابعة لإتمام الطلب (Checkout)</span>
                  <ArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="w-full py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>متابعة التسوق وإضافة منتجات</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Checkout Action bar - stacked beautifully on top of Mobile Bottom Nav */}
      {checkoutStep === 'cart' && resolvedCartItems.length > 0 && (
        <div 
          className="fixed lg:hidden left-0 right-0 z-40 px-4 bg-[var(--surface-elevated)] backdrop-blur-xl border-t border-[var(--border)] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center"
          style={{ bottom: 'var(--mobile-bottom-nav-height, 0px)', height: 'var(--mobile-action-bar-height)' }}
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-4 w-full">
            <div className="text-right shrink-0">
              <span className="text-[10px] font-black text-[var(--text-muted)] block">الإجمالي النهائي:</span>
              <span className="text-sm font-black text-[#E0B84A] font-mono">{orderTotal.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <button
              disabled={hasStockIssues}
              onClick={() => {
                analyticsService.trackEvent('checkout_started', {
                  userUid: user?.uid,
                  metadata: { itemCount: cartCount, total: itemsSubtotal }
                });
                navigate('/checkout');
              }}
              className="flex-1 h-12 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>إتمام الطلب</span>
              <ArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

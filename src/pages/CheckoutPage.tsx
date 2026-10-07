import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { StoreSettings, Address, OrderItem } from '../types';
import { orderService, ValidatedOrderCalculation } from '../lib/data/orderService';
import { userService } from '../lib/data/userService';
import { analyticsService } from '../lib/data/analyticsService';
import {

  ShieldCheck,
  Truck,
  CreditCard,
  MapPin,
  User as UserIcon,
  Phone,
  Mail,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Plus,
  ShoppingBag,
  Clock,
  Sparkles,
  X,
  FileText,
  Lock,
  ChevronDown
} from 'lucide-react';

interface CheckoutPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

const EGYPT_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'الشرقية',
  'الدقهلية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'الوادي الجديد',
  'مطروح',
  'شمال سيناء',
  'جنوب سيناء'
];

export function CheckoutPage({ navigate, settings }: CheckoutPageProps) {
  const { user, profile, cartList, resolvedCartItems, clearPurchasedCart, triggerToast } = useAuth();

  // Customer Information
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'pay_now'>('cash_on_delivery');

  // Shipping Address
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('custom');

  // Manual / New Address Form
  const [governorate, setGovernorate] = useState('القاهرة');
  const [area, setArea] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [apartment, setApartment] = useState('');
  const [floor, setFloor] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  const [saveToAddressBook, setSaveToAddressBook] = useState(true);
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('المنزل');

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Authoritative Calculation State
  const [orderCalculation, setOrderCalculation] = useState<ValidatedOrderCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Order Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLockRef = useRef<boolean>(false);

  // Auto-fill customer profile data
  useEffect(() => {
    if (user) {
      if (profile?.displayName || user.displayName) {
        setCustomerName(profile?.displayName || user.displayName || '');
      }
      if (profile?.phone) {
        setCustomerPhone(profile.phone);
      }
      if (user.email) {
        setCustomerEmail(user.email);
      }
    }
  }, [user, profile]);

  // Load saved addresses for authenticated users (one-time fetch)
  useEffect(() => {
    let isMounted = true;
    if (user?.uid) {
      setLoadingAddresses(true);
      userService.getAddresses(user.uid).then((fetched) => {
        if (!isMounted) return;
        setAddresses(fetched);
        setLoadingAddresses(false);
        if (fetched.length > 0 && selectedAddressId === 'custom') {
          const defaultAddr = fetched.find(a => a.isDefault) || fetched[0];
          setSelectedAddressId(defaultAddr.addressId);
        }
      }).catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to fetch addresses:', err);
        setLoadingAddresses(false);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Sync selected address fields
  useEffect(() => {
    if (selectedAddressId !== 'custom' && addresses.length > 0) {
      const selected = addresses.find(a => a.addressId === selectedAddressId);
      if (selected) {
        if (selected.recipientName && !customerName) setCustomerName(selected.recipientName);
        if (selected.phone && !customerPhone) setCustomerPhone(selected.phone);
      }
    }
  }, [selectedAddressId, addresses]);

  // Live Recalculation using Authoritative Firestore Logic
  useEffect(() => {
    if (resolvedCartItems.length === 0) {
      setOrderCalculation(null);
      return;
    }

    let isCancelled = false;
    async function recalculate() {
      setIsCalculating(true);
      setCalculationError(null);
      try {
        const rawItems = resolvedCartItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity
        }));

        const calc = await orderService.validateOrderTotals(
          rawItems,
          appliedCouponCode || undefined,
          user?.uid
        );

        if (!isCancelled) {
          setOrderCalculation(calc);
          if (calc.couponError) {
            setCouponError(calc.couponError);
            setAppliedCouponCode(null);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Calculation error:', err);
          setCalculationError(err.message || 'تعذر حساب الإجمالي، يرجى التحقق من السلة.');
        }
      } finally {
        if (!isCancelled) {
          setIsCalculating(false);
        }
      }
    }

    recalculate();
    return () => {
      isCancelled = true;
    };
  }, [resolvedCartItems, appliedCouponCode, user?.uid]);

  // Handle Coupon Apply
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const rawItems = resolvedCartItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity
      }));

      const calc = await orderService.validateOrderTotals(rawItems, code, user?.uid);
      if (calc.couponCode && calc.discount > 0) {
        setAppliedCouponCode(calc.couponCode);
        setOrderCalculation(calc);
        setCouponError(null);
        triggerToast(`تم تطبيق كود الخصم بنجاح: ${calc.couponCode}`);
      } else {
        setCouponError(calc.couponError || 'كود الخصم غير صالح أو غير منطبق على هذه السلة');
        setAppliedCouponCode(null);
      }
    } catch (err: any) {
      setCouponError(err.message || 'تعذر التحقق من كود الخصم');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Construct Formatted Shipping Address
  const getFormattedShippingAddress = (): string => {
    if (selectedAddressId !== 'custom') {
      const selected = addresses.find(a => a.addressId === selectedAddressId);
      if (selected) {
        return [
          selected.label ? `[${selected.label}]` : '',
          selected.governorate,
          selected.area,
          selected.street,
          selected.building ? `مبنى ${selected.building}` : '',
          selected.floor ? `دور ${selected.floor}` : '',
          selected.apartment ? `شقة ${selected.apartment}` : '',
          selected.notes ? `(ملاحظات: ${selected.notes})` : ''
        ].filter(Boolean).join(' - ');
      }
    }

    return [
      governorate,
      area,
      street,
      building ? `مبنى ${building}` : '',
      floor ? `دور ${floor}` : '',
      apartment ? `شقة ${apartment}` : '',
      addressNotes ? `(ملاحظات: ${addressNotes})` : ''
    ].filter(Boolean).join(' - ');
  };

  // Handle Save New Address in Modal / Form
  const handleSaveNewAddressModal = async () => {
    if (!governorate || !area || !street) {
      triggerToast('يرجى ملء المحافظة والمنطقة والشارع.');
      return;
    }

    if (user?.uid) {
      try {
        const newId = await userService.addAddress(user.uid, {
          label: newAddressLabel || 'عنوان جديد',
          recipientName: customerName || user.displayName || 'العميل',
          phone: customerPhone || '',
          governorate,
          area,
          street,
          building,
          apartment,
          floor,
          notes: addressNotes,
          isDefault: addresses.length === 0
        });
        setSelectedAddressId(newId);
        setShowNewAddressModal(false);
        triggerToast('تم حفظ العنوان الجديد بنجاح.');
      } catch (err) {
        console.error('Failed to save address:', err);
        triggerToast('تعذر حفظ العنوان الجديد.');
      }
    } else {
      setShowNewAddressModal(false);
    }
  };

  // Confirm Order Submission with Strict Anti-Duplicate Protection
  const handleConfirmOrder = async () => {
    // Prevent double submissions immediately
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    setSubmitError(null);

    // Validation
    if (!customerName.trim()) {
      setSubmitError('يرجى إدخال اسم العميل بالكامل.');
      return;
    }

    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setSubmitError('يرجى إدخال رقم هاتف صحيح للتواصل والتوصيل.');
      return;
    }

    const shippingAddress = getFormattedShippingAddress();
    if (!shippingAddress.trim() || (selectedAddressId === 'custom' && (!area.trim() || !street.trim()))) {
      setSubmitError('يرجى استكمال بيانات عنوان التوصيل (المنطقة والشارع).');
      return;
    }

    if (!resolvedCartItems || resolvedCartItems.length === 0) {
      setSubmitError('السلة فارغة، يرجى إضافة منتجات قبل إتمام الطلب.');
      return;
    }

    // Stock Validation
    const outOfStockItem = resolvedCartItems.find(i =>
      i.product.isAvailable === false ||
      i.product.stockStatus === 'out_of_stock' ||
      (typeof i.product.stockQuantity === 'number' && i.product.stockQuantity < i.quantity)
    );

    if (outOfStockItem) {
      const availStock = typeof outOfStockItem.product.stockQuantity === 'number' ? outOfStockItem.product.stockQuantity : 0;
      const msg = `المنتج "${outOfStockItem.product.name}" غير متوفر بالكمية المطلوبة (المتبقي: ${availStock} قطع). يرجى تعديل السلة.`;
      setSubmitError(msg);
      triggerToast(msg);
      return;
    }

    // Set submit lock
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const idempotencyKey = `checkout_${user?.uid || 'guest'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const rawItems = resolvedCartItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        isBundle: Boolean(i.isBundle || i.bundleId || i.productId.startsWith('bundle_')),
        bundleId: i.bundleId || (i.productId.startsWith('bundle_') ? i.productId.replace(/^bundle_/, '') : undefined),
        selectedInstallmentPlan: i.selectedInstallmentPlan
      }));

      // 1. Authoritative Order Placement via Firestore Transaction
      const result = await orderService.placeCheckoutOrder({
        customerUid: user?.uid || 'guest',
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim(),
        shippingAddress,
        customerNotes: customerNotes.trim() || undefined,
        items: rawItems,
        couponCode: appliedCouponCode || undefined,
        paymentMethod: paymentMethod,
        idempotencyKey
      });

      // 2. If logged in and user asked to save this new address, save it to addresses collection
      if (user?.uid && selectedAddressId === 'custom' && saveToAddressBook && area.trim() && street.trim()) {
        userService.addAddress(user.uid, {
          label: 'عنوان التوصيل',
          recipientName: customerName.trim(),
          phone: customerPhone.trim(),
          governorate,
          area: area.trim(),
          street: street.trim(),
          building: building.trim(),
          apartment: apartment.trim(),
          floor: floor.trim(),
          notes: addressNotes.trim(),
          isDefault: addresses.length === 0
        }).catch(err => console.warn('Could not auto-save address:', err));
      }

      // 3. Clear ONLY purchased items from cart
      const purchasedProductIds = rawItems.map(i => i.productId);
      await clearPurchasedCart(purchasedProductIds);

      // 4. Redirect to Order Confirmation
      navigate(`/order-confirmation?orderId=${result.orderId}`);
    } catch (err: any) {
      console.error('Checkout error:', err);
      const message = err?.message || 'تعذر إنشاء الطلب، حاول مرة أخرى.';
      setSubmitError(message);
      triggerToast(message);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  if (resolvedCartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <div className="w-20 h-20 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto mb-6 text-[var(--text-secondary)]">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">سلة المشتريات فارغة</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
          لم تقم بإضافة أي منتجات للسلة بعد. استكشف تشكيلتنا المميزة وأضف منتجاتك المفضلة!
        </p>
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-sm shadow-lg hover:brightness-110 active:scale-98 transition-all cursor-pointer"
        >
          <span>تصفح المنتجات الآن</span>
          <ArrowRight className="w-4 h-4 ltr:rotate-180" />
        </button>
      </div>
    );
  }

  const itemsSubtotal = orderCalculation?.subtotal ?? resolvedCartItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
  const discountAmount = orderCalculation?.discount ?? 0;
  const shippingCost = orderCalculation?.shippingCost ?? (itemsSubtotal >= 3000 ? 0 : 50);
  const finalTotal = orderCalculation?.total ?? (itemsSubtotal - discountAmount + shippingCost);

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12 max-w-7xl animate-in fade-in duration-300">
      {/* Header & Flow Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-3">
          <button onClick={() => navigate('/cart')} className="hover:text-[#E0B84A] transition-colors flex items-center gap-1 cursor-pointer">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>السلة</span>
          </button>
          <span>/</span>
          <span className="text-[#E0B84A] font-bold">إتمام الشراء والدفع</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              إتمام الطلب
            </h1>
            <p className="text-xs lg:text-sm text-[var(--text-secondary)] mt-1">
              أدخل بيانات التوصيل وأكد طلبك لتجهيزه وشحنه إلى باب منزلك بأمان.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto px-3.5 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-primary)]">
            <Lock className="w-3.5 h-3.5 text-[#E0B84A]" />
            <span>دفع آمن 100% عند الاستلام</span>
          </div>
        </div>
      </div>

      {/* Guest Login Suggestion Banner if not logged in */}
      {!user && (
        <div className="mb-8 p-4 rounded-2xl bg-[#D4AF37]/[0.06] border border-[#D4AF37]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#E0B84A] shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">هل لديك حساب في المتجر؟</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                سجّل دخولك الآن لحفظ هذا الطلب في حسابك واستخدام عناوينك المسجلة بسهولة.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[#E0B84A] transition-all cursor-pointer shrink-0 text-center"
          >
            تسجيل الدخول
          </button>
        </div>
      )}

      {/* Main Grid: Left side Form (2 cols) & Right side Order Summary (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Customer Information Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border)] shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--text-primary)] font-black text-sm border-b border-[var(--border)] pb-3">
              <UserIcon className="w-4 h-4 text-[#E0B84A]" />
              <span>1. بيانات العميل والمستلم</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  الاسم بالكامل <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full h-11 px-3.5 pr-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                  <UserIcon className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                  رقم الهاتف (للتواصل والشحن) <span className="text-rose-400">*</span>
                </label>
                <div className="relative" dir="ltr">
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full h-11 px-3.5 pl-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all text-left font-mono"
                  />
                  <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                البريد الإلكتروني <span className="text-[var(--text-muted)] text-[10px] font-normal">(اختياري لإرسال نسخة من الفاتورة)</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all"
                />
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* 2. Shipping Address Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border)] shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5 text-[var(--text-primary)] font-black text-sm">
                <MapPin className="w-4 h-4 text-[#E0B84A]" />
                <span>2. عنوان التوصيل والشحن</span>
              </div>

              {user && addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewAddressModal(true)}
                  className="text-xs font-bold text-[#E0B84A] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عنوان جديد</span>
                </button>
              )}
            </div>

            {/* Saved Addresses List (if logged in and has addresses) */}
            {user && addresses.length > 0 && (
              <div className="space-y-3 mb-4">
                <label className="block text-xs font-bold text-[var(--text-secondary)]">
                  اختر من عناوينك المحفوظة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.addressId;
                    return (
                      <div
                        key={addr.addressId}
                        onClick={() => setSelectedAddressId(addr.addressId)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#D4AF37]/10 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                            : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-[#E0B84A]" />
                            {addr.label || 'العنوان'}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                              الافتراضي
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {addr.governorate} - {addr.area} - {addr.street}
                          {addr.building ? ` - مبنى ${addr.building}` : ''}
                        </p>
                      </div>
                    );
                  })}

                  <div
                    onClick={() => setSelectedAddressId('custom')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center text-xs font-bold ${
                      selectedAddressId === 'custom'
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#E0B84A]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>+ إدخال عنوان يدوي مخصص لهذا الطلب</span>
                  </div>
                </div>
              </div>
            )}

            {/* Address Input Form (Shown when custom selected or user has no saved addresses) */}
            {(selectedAddressId === 'custom' || !user || addresses.length === 0) && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                      المحافظة <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={governorate}
                        onChange={(e) => setGovernorate(e.target.value)}
                        className="w-full h-11 px-3.5 pr-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none appearance-none transition-all cursor-pointer"
                      >
                        {EGYPT_GOVERNORATES.map((gov) => (
                          <option key={gov} value={gov} className="bg-[var(--surface-elevated)] text-[var(--text-primary)]">
                            {gov}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                      المدينة / الحي / المنطقة <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="مثال: المعادي / التجمع الخامس / شبرا"
                      className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    اسم الشارع / تفاصيل العنوان <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="مثال: شارع النصر، متفرع من اللاسلكي"
                    className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      رقم المبنى
                    </label>
                    <input
                      type="text"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder="14"
                      className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      الدور
                    </label>
                    <input
                      type="text"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="3"
                      className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      رقم الشقة
                    </label>
                    <input
                      type="text"
                      value={apartment}
                      onChange={(e) => setApartment(e.target.value)}
                      placeholder="6"
                      className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                    علامة مميزة / ملاحظات للمندوب <span className="text-[var(--text-muted)] text-[10px] font-normal">(اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={addressNotes}
                    onChange={(e) => setAddressNotes(e.target.value)}
                    placeholder="مثال: بجوار صيدلية العزبي، الدور الأخير"
                    className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>

                {user && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToAddressBook}
                      onChange={(e) => setSaveToAddressBook(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface)] text-[#D4AF37] focus:ring-0 focus:outline-none cursor-pointer"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">حفظ هذا العنوان في حسابي للاستخدام مستقبلاً</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* 3. Payment Method Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border)] shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-[var(--text-primary)] font-black text-sm border-b border-[var(--border)] pb-3">
              <CreditCard className="w-4 h-4 text-[#E0B84A]" />
              <span>3. طريقة الدفع</span>
            </div>

            <div className="space-y-3">
              {/* COD Option */}
              <div
                onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'border-[#D4AF37] bg-[#D4AF37]/[0.08]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center p-0.5 ${
                    paymentMethod === 'cash_on_delivery' ? 'border-[#E0B84A]' : 'border-[var(--text-muted)]'
                  }`}>
                    {paymentMethod === 'cash_on_delivery' && <div className="w-full h-full rounded-full bg-[#E0B84A]" />}
                  </div>
                  <div className="mr-2">
                    <p className="text-xs font-black text-[var(--text-primary)]">الدفع عند الاستلام</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">ادفع عند استلام الطلب</p>
                  </div>
                </div>
              </div>

              {/* Pay Now Option */}
              <div
                onClick={() => setPaymentMethod('pay_now')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'pay_now'
                    ? 'border-[#D4AF37] bg-[#D4AF37]/[0.08]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center p-0.5 ${
                    paymentMethod === 'pay_now' ? 'border-[#E0B84A]' : 'border-[var(--text-muted)]'
                  }`}>
                    {paymentMethod === 'pay_now' && <div className="w-full h-full rounded-full bg-[#E0B84A]" />}
                  </div>
                  <div className="mr-2">
                    <p className="text-xs font-black text-[var(--text-primary)]">الدفع الآن (تحويل أو وسيلة أخرى)</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">بعد إنشاء الطلب سيتم فتح WhatsApp لإكمال خطوات الدفع وإرسال إثبات التحويل</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Customer Notes Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border)] shadow-lg space-y-3">
            <div className="flex items-center gap-2.5 text-[var(--text-primary)] font-black text-sm border-b border-[var(--border)] pb-3">
              <FileText className="w-4 h-4 text-[#E0B84A]" />
              <span>ملاحظات إضافية على الطلب</span>
            </div>
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="هل لديك أي تعليمات خاصة بالتسليم أو مواعيد التوصيل المفضلة؟"
              className="w-full p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all resize-none"
            />
          </div>

        </div>

        {/* Right Sidebar Column: Order Summary & Review */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          
          <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
              <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#E0B84A]" />
                <span>ملخص الطلب ({resolvedCartItems.length} منتجات)</span>
              </h2>
              <button
                onClick={() => navigate('/cart')}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[#E0B84A] transition-colors"
              >
                تعديل السلة
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {resolvedCartItems.map((item) => {
                const isBundle = Boolean(item.isBundle || item.bundleId || item.productId.startsWith('bundle_'));
                return (
                  <div key={item.productId} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <img
                      src={getValidImageSrc(item.product.mainImageUrl || item.product.additionalImages?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=120')}
                      alt={item.product.name}
                      className="w-12 h-12 object-cover rounded-lg bg-black/40 border border-[var(--border)] shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isBundle && (
                          <span className="text-[8px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                            عرض مركب
                          </span>
                        )}
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.product.name}</p>
                      </div>
                      {isBundle && item.bundleProducts && item.bundleProducts.length > 0 && (
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                          يشمل: {item.bundleProducts.map((bp) => bp.name).join(' + ')}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {item.quantity} × <span className="font-mono text-[var(--text-primary)]">{item.product.price.toLocaleString('ar-EG')} ج.م</span>
                      </p>
                    </div>
                    <div className="text-left font-mono font-bold text-xs text-[#E0B84A] shrink-0">
                      {(item.product.price * item.quantity).toLocaleString('ar-EG')} ج.م
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon Code Section */}
            <div className="border-t border-[var(--border)] pt-4 space-y-2">
              <label className="block text-xs font-bold text-[var(--text-primary)]">
                كود الخصم (Coupon)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="أدخل كود الخصم..."
                    disabled={!!appliedCouponCode || isValidatingCoupon}
                    className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D4AF37] focus:outline-none transition-all uppercase disabled:opacity-60"
                  />
                  {appliedCouponCode && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {!appliedCouponCode ? (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={!couponInput || isValidatingCoupon}
                    className="px-4 h-10 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#E0B84A] text-xs font-black transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'تطبيق'}
                  </button>
                ) : (
                  <div className="px-3 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>مطبّق</span>
                  </div>
                )}
              </div>

              {couponError && (
                <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{couponError}</span>
                </p>
              )}

              {appliedCouponCode && discountAmount > 0 && (
                <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>تم خصم {discountAmount.toLocaleString('ar-EG')} ج.م بنجاح!</span>
                </p>
              )}
            </div>

            {/* Financial Summary */}
            <div className="border-t border-[var(--border)] pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>قيمة المنتجات (Subtotal):</span>
                <span className="font-mono text-[var(--text-primary)] font-semibold">
                  {itemsSubtotal.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-500 font-bold">
                  <span>خصم الكوبون ({appliedCouponCode}):</span>
                  <span className="font-mono">-{discountAmount.toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>مصاريف الشحن والتوصيل:</span>
                {shippingCost === 0 ? (
                  <span className="text-emerald-500 font-bold">شحن مجاني ✨</span>
                ) : (
                  <span className="font-mono text-[var(--text-primary)] font-semibold">
                    {shippingCost.toLocaleString('ar-EG')} ج.م
                  </span>
                )}
              </div>

              {itemsSubtotal < 3000 && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[10.5px] text-[var(--text-secondary)] leading-relaxed">
                  أضف بمبلغ <span className="text-[#E0B84A] font-bold">{(3000 - itemsSubtotal).toLocaleString('ar-EG')} ج.م</span> إضافي للحصول على <span className="text-emerald-500 font-bold">شحن مجاني!</span>
                </div>
              )}

              <div className="border-t border-[var(--border-strong)] pt-4 flex items-center justify-between">
                <span className="text-sm font-black text-[var(--text-primary)]">الإجمالي النهائي:</span>
                <span className="text-xl font-black text-[#E0B84A] font-mono">
                  {finalTotal.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Confirm Order Button */}
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={isSubmitting || isCalculating}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء وتأكيد الطلب بأمان...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>تأكيد الطلب ({finalTotal.toLocaleString('ar-EG')} ج.م)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-[var(--text-muted)] text-center">
              بالضغط على تأكيد الطلب، فإنك توافق على شروط وسياسة الشحن والإرجاع في المتجر.
            </p>
          </div>
        </div>

      </div>

      {/* New Address Modal (For authenticated users) */}
      {showNewAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--text-primary)]">إضافة عنوان جديد إلى حسابك</h3>
              <button onClick={() => setShowNewAddressModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">اسم العنوان (مثل: المنزل، العمل)</label>
                <input
                  type="text"
                  value={newAddressLabel}
                  onChange={(e) => setNewAddressLabel(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">المحافظة</label>
                  <select
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all appearance-none"
                  >
                    {EGYPT_GOVERNORATES.map(g => (
                      <option key={g} value={g} className="bg-[var(--surface-elevated)] text-[var(--text-primary)]">{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">المنطقة / الحي</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="المعادي"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">الشارع</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="شارع 9"
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">المبنى</label>
                  <input
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className="w-full h-9 px-2 text-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">الدور</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full h-9 px-2 text-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">الشقة</label>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    className="w-full h-9 px-2 text-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[#D4AF37] focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={handleSaveNewAddressModal}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs cursor-pointer shadow-lg shadow-[#D4AF37]/20"
              >
                حفظ واختيار
              </button>
              <button
                type="button"
                onClick={() => setShowNewAddressModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

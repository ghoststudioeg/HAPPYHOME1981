import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useState, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg, Area } from '../lib/cropUtils';
import { useAuth } from '../lib/authContext';
import { StoreSettings, Order, OrderStatus, Address, Notification, Product, UserFavoriteItem } from '../types';
import { orderService } from '../lib/data/orderService';
import { userService } from '../lib/data/userService';
import { storageService } from '../lib/data/storageService';
import { notificationService } from '../lib/notificationService';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { InvoiceModal } from '../components/InvoiceModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../lib/themeContext';
import { RecentlyViewedSection } from '../components/product/RecentlyViewedSection';
import {

  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Heart,
  LogOut,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Package,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Share2,
  Truck,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Check,
  CheckCheck,
  Bell,
  BellOff,
  ShoppingBasket,
  Tag,
  Info,
  Printer,
  X,
  CreditCard,
  HeartOff,
  Camera,
  ZoomIn,
  ZoomOut,
  XCircle,
  Flame,
  TrendingDown,
  PackageCheck,
  Megaphone,
  Folder,
  FolderPlus,
  ArrowRightLeft
} from 'lucide-react';
import { MoveToGroupModal } from '../components/wishlist/WishlistModals';

interface ProfilePageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

type ProfileTab = 'profile' | 'favorites' | 'recently_viewed' | 'orders' | 'invoices' | 'notifications' | 'addresses';

const orderStatusLabels: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  preparing: 'جاري التجهيز',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

const orderStatusColors: Record<OrderStatus, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  preparing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ready_to_ship: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  shipped: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
};

// Preset premium avatars to choose from in "حسابي"
const PRESET_AVATARS = [
  { id: 'av1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', label: 'أناقة كلاسيك' },
  { id: 'av2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', label: 'رسمي وقور' },
  { id: 'av3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', label: 'طاقة إيجابية' },
  { id: 'av4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', label: 'هدوء وثقة' },
  { id: 'av5', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', label: 'تفاؤل دائم' }
];

export function ProfilePage({ navigate, settings }: ProfilePageProps) {
  const {
    user,
    profile,
    isAdmin,
    loading,
    updateProfileData,
    signOut,
    favoritesList,
    wishlistGroups,
    createWishlistGroup,
    moveFavoriteToGroup,
    toggleFavorite,
    addToCart
  } = useAuth();

  const { isDark } = useTheme();

  // Active Tab: exact My Account navigation items requested
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [profileFavGroup, setProfileFavGroup] = useState<string>('all');
  const [moveTargetProduct, setMoveTargetProduct] = useState<{
    id: string;
    name: string;
    currentGroup: string;
  } | null>(null);

  // Modal State
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Subscriptions & Data States
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Expanded details controllers
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // Personal Info Form States
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Avatar upload and delete states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Cropper states
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Prevent scrolling when crop modal is open and handle object URL cleanup
  useEffect(() => {
    if (showCropModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      // Cleanup Object URLs if we use them
      if (cropImageSrc && cropImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(cropImageSrc);
      }
    };
  }, [showCropModal, cropImageSrc]);

  // Address sub-form states
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('المنزل');
  const [addrRecipientName, setAddrRecipientName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrGovernorate, setAddrGovernorate] = useState('القاهرة');
  const [addrArea, setAddrArea] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrBuilding, setAddrBuilding] = useState('');
  const [addrApartment, setAddrApartment] = useState('');
  const [addrFloor, setAddrFloor] = useState('');
  const [addrNotes, setAddrNotes] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Notification filter state
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'orders' | 'offers'>('all');

  // Check URL params for active tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const validTabs: ProfileTab[] = ['profile', 'favorites', 'recently_viewed', 'orders', 'invoices', 'notifications', 'addresses'];
    if (tab && validTabs.includes(tab as ProfileTab)) {
      setActiveTab(tab as ProfileTab);
    }
  }, []);

  // Secure Route: redirect to login if unauthorized
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  // Synchronize local form inputs with profile/auth states
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || user?.displayName || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setPhotoURL(profile.photoURL || user?.photoURL || '');
    } else if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [profile, user]);

  // Load orders (one-time fetch)
  const loadOrders = React.useCallback(async (uid: string) => {
    setLoadingOrders(true);
    try {
      const fetchedOrders = await orderService.getUserOrders(uid);
      setOrders(fetchedOrders);
    } catch (err) {
      console.warn('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Load addresses (one-time fetch)
  const loadAddresses = React.useCallback(async (uid: string) => {
    setLoadingAddresses(true);
    try {
      const fetchedAddresses = await userService.getAddresses(uid);
      setAddresses(fetchedAddresses);
    } catch (err) {
      console.warn('Failed to load addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  // Subscribe to real-time notifications (managed singleton with debounce)
  useEffect(() => {
    if (user?.uid) {
      setLoadingNotifications(true);
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (data) => {
        setNotifications(data);
        setLoadingNotifications(false);
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Initial load for orders and addresses
  useEffect(() => {
    if (user?.uid) {
      loadOrders(user.uid);
      loadAddresses(user.uid);
    }
  }, [user?.uid, loadOrders, loadAddresses]);

  // Address handlers
  const resetAddressForm = () => {
    setAddrLabel('المنزل');
    setAddrRecipientName(profile?.displayName || user?.displayName || '');
    setAddrPhone(profile?.phone || '');
    setAddrGovernorate('القاهرة');
    setAddrArea('');
    setAddrStreet('');
    setAddrBuilding('');
    setAddrApartment('');
    setAddrFloor('');
    setAddrNotes('');
    setAddrIsDefault(false);
    setAddressError(null);
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleEditAddressClick = (addr: Address) => {
    setEditingAddress(addr);
    setAddrLabel(addr.label);
    setAddrRecipientName(addr.recipientName);
    setAddrPhone(addr.phone);
    setAddrGovernorate(addr.governorate);
    setAddrArea(addr.area);
    setAddrStreet(addr.street);
    setAddrBuilding(addr.building);
    setAddrApartment(addr.apartment);
    setAddrFloor(addr.floor);
    setAddrNotes(addr.notes || '');
    setAddrIsDefault(addr.isDefault);
    setAddressError(null);
    setShowAddressForm(true);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);

    if (!addrRecipientName.trim()) {
      setAddressError('يرجى إدخال اسم المستلم.');
      return;
    }
    const egyptianPhoneRegex = /^(01[0125]\d{8}|(?:\+20|0020)?1[0125]\d{8})$/;
    if (!egyptianPhoneRegex.test(addrPhone.trim())) {
      setAddressError('يرجى إدخال رقم موبايل مصري صحيح لتأكيد استلام الشحنة (مثال: 01012345678).');
      return;
    }
    if (!addrGovernorate) {
      setAddressError('يرجى اختيار المحافظة لتحديد تكلفة الشحن بدقة.');
      return;
    }
    if (!addrArea.trim()) {
      setAddressError('يرجى إدخال المنطقة أو المدينة.');
      return;
    }
    if (!addrStreet.trim() || !addrBuilding.trim()) {
      setAddressError('يرجى إدخال الشارع ورقم المبنى بالتفصيل لضمان سرعة الوصول.');
      return;
    }

    try {
      const addressData = {
        label: addrLabel.trim(),
        recipientName: addrRecipientName.trim(),
        phone: addrPhone.trim(),
        governorate: addrGovernorate,
        area: addrArea.trim(),
        street: addrStreet.trim(),
        building: addrBuilding.trim(),
        apartment: addrApartment.trim(),
        floor: addrFloor.trim(),
        notes: addrNotes.trim() || undefined,
        isDefault: addrIsDefault
      };

      if (!user) return;
      if (editingAddress) {
        await userService.updateAddress(user.uid, editingAddress.addressId, addressData);
      } else {
        await userService.addAddress(user.uid, addressData);
      }
      resetAddressForm();
      await loadAddresses(user.uid);
    } catch (err: any) {
      console.error('Failed to save address:', err);
      setAddressError(err?.message || 'حدث خطأ أثناء حفظ العنوان، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return;
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا العنوان؟')) {
      try {
        await userService.deleteAddress(user.uid, addressId);
        await loadAddresses(user.uid);
      } catch (err) {
        console.error('Failed to delete address:', err);
      }
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      await userService.setDefaultAddress(user.uid, addressId);
      await loadAddresses(user.uid);
    } catch (err) {
      console.error('Failed to set default address:', err);
    }
  };

  // Avatar Upload Handler
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadError(null);
    setUploadSuccess(false);

    try {
      // 1. Validation checks
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP.');
      }

      const maxSize = 8 * 1024 * 1024; // 8MB
      if (file.size > maxSize) {
        throw new Error('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 8 ميجابايت.');
      }

      // Use Object URL for better performance with large images
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setIsImageLoaded(false); // Reset loading state for new image
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setShowCropModal(true);
    } catch (err: any) {
      console.error('Avatar file selection error:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء قراءة ملف الصورة الشخصية.');
    } finally {
      // Reset file input so same file can be selected again
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  };

  // Live circular preview calculations
  const getPreviewStyle = () => {
    if (!croppedArea || !cropImageSrc) return {};
    const scaleX = 100 / croppedArea.width;
    const scaleY = 100 / croppedArea.height;
    const posX = croppedArea.width === 100 ? 0 : croppedArea.x / (100 - croppedArea.width) * 100;
    const posY = croppedArea.height === 100 ? 0 : croppedArea.y / (100 - croppedArea.height) * 100;

    return {
      width: '100%',
      height: '100%',
      backgroundImage: `url(${cropImageSrc})`,
      backgroundSize: `${scaleX * 100}% ${scaleY * 100}%`,
      backgroundPosition: `${posX}% ${posY}%`,
      backgroundRepeat: 'no-repeat',
    };
  };

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !user || !isImageLoaded || isUploading) return;

    // Final safety check: ensure the crop dimensions are valid
    if (croppedAreaPixels.width <= 0 || croppedAreaPixels.height <= 0) {
      setUploadError('إحداثيات القص غير صالحة. يرجى المحاولة مرة أخرى.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setIsUploading(true);
    
    try {
      // 1. Generate the cropped 1:1 image blob from canvas
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);

      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error('فشل توليد الصورة المقصوصة.');
      }

      // Hide modal only after successful blob generation
      setShowCropModal(false);

      // 2. Client-side image compression / optimization
      let uploadBlob: Blob = croppedBlob;
      try {
        const optimized = await storageService.optimizeImage(new File([croppedBlob], 'cropped_avatar.jpg', { type: 'image/jpeg' }));
        if (optimized) {
          uploadBlob = optimized;
        }
      } catch (optErr) {
        console.warn('Client-side image optimization failed, proceeding with original cropped blob:', optErr);
      }

      // 3. Upload only the cropped result to existing Supabase Storage
      const folderPath = `avatars/${user.uid}`;
      const cleanFileName = `profile_${Date.now()}.jpg`;

      const uploadedUrl = await storageService.uploadFile(uploadBlob, cleanFileName, folderPath);
      if (!uploadedUrl) {
        throw new Error('فشل رفع الصورة الشخصية المقصوصة إلى الخادم.');
      }

      // 4. Clear old avatar if it exists and was a Supabase file to avoid storage accumulation
      if (photoURL && photoURL.includes('/storage/v1/object/public/')) {
        try {
          await storageService.safeDeleteFile(photoURL);
        } catch (delErr) {
          console.warn('Failed to delete previous avatar from storage, skipped:', delErr);
        }
      }

      // 5. Update UI, Firestore & Firebase Auth immediately
      const photoURLWithCacheBuster = `${uploadedUrl}?t=${Date.now()}`;
      await updateProfileData({
        photoURL: photoURLWithCacheBuster
      });
      setPhotoURL(photoURLWithCacheBuster);

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      setCropImageSrc(null);
    } catch (err: any) {
      console.error('Crop confirmation or upload error:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء معالجة أو رفع الصورة الشخصية.');
    } finally {
      setIsUploading(false);
    }
  };

  // Avatar Deletion Handler
  const handleAvatarDelete = async () => {
    if (!user) return;
    if (!confirm('هل أنت متأكد من رغبتك في حذف صورتك الشخصية والعودة للصورة الافتراضية؟')) return;

    setUploadError(null);
    setUploadSuccess(false);
    setIsUploading(true);

    try {
      // 1. Delete current file from Supabase storage if it's stored there
      if (photoURL && photoURL.includes('/storage/v1/object/public/')) {
        try {
          await storageService.safeDeleteFile(photoURL);
        } catch (delErr) {
          console.warn('Failed to delete avatar file from storage:', delErr);
        }
      }

      // 2. Identify fallback photo if available from Google, otherwise empty
      const googlePhoto = user.providerData?.find(p => p.photoURL)?.photoURL || '';

      // 3. Update Firestore & Firebase Auth
      await updateProfileData({
        photoURL: googlePhoto
      });
      setPhotoURL(googlePhoto);

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Avatar delete error:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء حذف الصورة الشخصية.');
    } finally {
      setIsUploading(false);
    }
  };

  // Profile Edit / Update Form Submit
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const displayNameTrimmed = displayName.trim();
    const phoneTrimmed = phone.trim();
    const addressTrimmed = address.trim();
    const photoURLTrimmed = photoURL.trim();

    // 1. Validation checks
    if (!displayNameTrimmed) {
      setErrorMessage('الاسم الكامل مطلوب.');
      setIsSaving(false);
      return;
    }

    // Egyptian phone validation:
    const egyptianPhoneRegex = /^(01[0125]\d{8}|(?:\+20|0020)?1[0125]\d{8})$/;
    if (phoneTrimmed && !egyptianPhoneRegex.test(phoneTrimmed)) {
      setErrorMessage('يرجى إدخال رقم موبايل مصري صحيح (مثال: 01012345678).');
      setIsSaving(false);
      return;
    }

    // Address validation (must be realistic, at least 10 characters):
    if (addressTrimmed && addressTrimmed.length < 10) {
      setErrorMessage('يرجى إدخال عنوان مفصل وواضح لضمان دقة التوصيل الشحن (مثال: القاهرة، مدينة نصر، شارع الطيران عمارة 12 الدور الرابع شقة 8).');
      setIsSaving(false);
      return;
    }

    // Photo URL validation (starts with http or https if filled)
    if (photoURLTrimmed && !photoURLTrimmed.startsWith('http://') && !photoURLTrimmed.startsWith('https://')) {
      setErrorMessage('يرجى إدخال رابط صورة صحيح يبدأ بـ http:// أو https://');
      setIsSaving(false);
      return;
    }

    try {
      // 2. Perform authoritative updates restricted only to allowed fields (prevents admin escalation)
      await updateProfileData({
        displayName: displayNameTrimmed,
        phone: phoneTrimmed,
        address: addressTrimmed,
        photoURL: photoURLTrimmed
      });

      setSaveSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تحديث بيانات الحساب، يرجى المحاولة مجدداً.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  // Helper: map favorite list to product object for card rendering & operations
  const handleRemoveFavorite = async (fav: UserFavoriteItem) => {
    const dummyProduct: Product = {
      id: fav.productId,
      name: fav.productName,
      slug: fav.slug,
      categoryId: '',
      categoryName: fav.categoryName,
      sku: '',
      price: fav.price,
      oldPrice: fav.oldPrice,
      description: '',
      features: [],
      mainImageUrl: fav.productImage || '',
      additionalImages: [],
      isAvailable: true,
      isFeatured: false,
      isPublished: true,
      stockQuantity: 100,
      sortOrder: 0
    };
    await toggleFavorite(dummyProduct);
  };

  if (loading || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8" dir="rtl">
        <LoadingSkeleton type="profile" />
        <LoadingSkeleton type="grid" count={2} />
      </div>
    );
  }

  const initials = (displayName || user.email || 'ع')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const statusSteps: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered'];
  const getStepIndex = (status: OrderStatus) => statusSteps.indexOf(status);

  // Active address default card check for "حسابي" tab summary
  const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <button
          onClick={() => navigate('/')}
          className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          الرئيسية
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] rotate-180 shrink-0" />
        <span className="text-[#E0B84A] font-bold">حسابي الشخصي</span>
      </nav>

      {/* Modern Dashboard Header Container */}
      <section className="glass-panel-elevated rounded-3xl p-6 sm:p-8 relative overflow-hidden liquid-reflection border border-[var(--border)] shadow-[0_25px_60px_rgba(0,0,0,0.1)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-right">
          {/* Avatar Area with dynamic sync and fallbacks */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-file-input')?.click()}>
              {photoURL ? (
                <img
                  src={getValidImageSrc(photoURL)}
                  alt={displayName || 'الصورة الشخصية'}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-[#D4AF37]/40 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 group-hover:ring-[#D4AF37] group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-[var(--surface)] to-[var(--surface-elevated)] border-2 border-[#D4AF37]/40 flex items-center justify-center text-2xl font-black text-[#E0B84A] shadow-[0_10px_30px_rgba(0,0,0,0.2)] group-hover:border-[#D4AF37] transition-all">
                  {initials}
                </div>
              )}
              
              {/* Semi-transparent hover overlay with camera icon */}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Camera className="w-6 h-6 text-[#E0B84A] animate-pulse" />
              </div>

              {isAdmin && (
                <span
                  title="مشرف معتمد"
                  className="absolute -bottom-1 -left-1 bg-[#D4AF37] text-black p-1.5 rounded-full shadow-lg border-2 border-[var(--background)]"
                >
                  <Shield className="w-4 h-4" />
                </span>
              )}

              {/* Uploading loader overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center z-20">
                  <Loader2 className="w-6 h-6 text-[#E0B84A] animate-spin" />
                  <span className="text-[9px] text-white mt-1 font-bold">جاري الرفع...</span>
                </div>
              )}
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              id="avatar-file-input"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarFileChange}
              disabled={isUploading}
            />

            {/* Quick Upload / Remove Actions */}
            <div className="flex items-center gap-2 mt-1 z-10">
              <button
                type="button"
                onClick={() => document.getElementById('avatar-file-input')?.click()}
                disabled={isUploading}
                className="px-3 py-1 rounded-full text-[10.5px] font-black tracking-wide border border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#E0B84A] hover:bg-[#D4AF37]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                تغيير الصورة
              </button>
              {photoURL && (
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={isUploading}
                  className="px-3 py-1 rounded-full text-[10.5px] font-bold border border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  إزالة
                </button>
              )}
            </div>

            {/* Feedback messages */}
            {uploadSuccess && (
              <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                تم التحديث بنجاح!
              </p>
            )}
            {uploadError && (
              <p className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 max-w-[200px] text-center leading-normal">
                {uploadError}
              </p>
            )}
          </div>

          {/* User Meta Data Info overview */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                  {displayName || 'عميل البيت السعيد المتميز'}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-mono mt-0.5" dir="ltr">
                  {user.email}
                </p>
              </div>

              {/* Verified Badge Indicators */}
              <div className="flex items-center gap-2 justify-center sm:justify-end">
                <ThemeToggle showLabel className="px-3 py-1 text-xs" />
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E0B84A] text-xs font-bold shadow-xs">
                    <Shield className="w-3.5 h-3.5" />
                    <span>مشرف معتمد</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-500 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>حساب نشط ومحمي</span>
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-3xl pt-1">
              مرحباً بك في مركز التحكم وإدارة البيانات الخاص بك. يمكنك متابعة الفواتير الحالية، ومراجعة سجلات طلباتك الحقيقية والتمتع بكافة تفضيلات المنتجات المحفوظة بشكل آمن عبر مختلف الأجهزة.
            </p>
          </div>
        </div>
      </section>

      {/* Double Column Grid: Responsive navigation and panels layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
        {/* Right Sidebar: Unified My Account Menu Navigation List */}
        <aside className="lg:col-span-1 glass-panel rounded-3xl p-5 border border-[var(--border)] shadow-xl space-y-6">
          <div className="text-xs font-black text-[var(--text-secondary)] px-3 tracking-wider uppercase">قائمة خيارات الحساب</div>
          
          <nav className="space-y-1.5 flex flex-col">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <UserIcon className="w-4 h-4" />
                <span>حسابي</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 rotate-180 opacity-60" />
            </button>

            <button
              onClick={() => setActiveTab('favorites')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4" />
                <span>المفضلة</span>
              </div>
              {favoritesList.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  {favoritesList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('recently_viewed')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'recently_viewed'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" />
                <span>شوهدت مؤخرًا</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 rotate-180 opacity-60" />
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4" />
                <span>طلباتي</span>
              </div>
              {orders.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#D4AF37]/15 text-[#E0B84A] border border-[#D4AF37]/30">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4" />
                <span>الفواتير</span>
              </div>
              {orders.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4" />
                <span>الإشعارات</span>
              </div>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white border border-rose-600 animate-pulse">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-gradient-to-l from-[#D4AF37]/20 to-transparent text-[#E0B84A] border-r-3 border-[#D4AF37] pr-3'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4" />
                <span>العناوين</span>
              </div>
              {addresses.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#D4AF37]/15 text-[#E0B84A] border border-[#D4AF37]/30">
                  {addresses.length}
                </span>
              )}
            </button>

            <div className="border-t border-[var(--border)] my-2 pt-2" />

            <button
              onClick={handleLogoutClick}
              className="w-full px-4 py-3 text-xs font-bold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>تسجيل الخروج</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 rotate-180 opacity-60" />
            </button>
          </nav>

          {/* Quick Stats Summary panel widget */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
            <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">ملخص النشاط الكلي</div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-[var(--background)] border border-[var(--border)] rounded-xl">
                <span className="text-sm font-black text-[var(--text-primary)] block">{orders.length}</span>
                <span className="text-[9px] text-[var(--text-muted)]">إجمالي الطلبات</span>
              </div>
              <div className="p-2 bg-[var(--background)] border border-[var(--border)] rounded-xl">
                <span className="text-sm font-black text-[var(--text-primary)] block">{favoritesList.length}</span>
                <span className="text-[9px] text-[var(--text-muted)]">المفضلة الحالية</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Left Area: Display Pane for selected Active Tab Content */}
        <main className="lg:col-span-3 space-y-6">
          
          {/* 1. TAB: PROFILE ("حسابي") */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Edit Surface card */}
              <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 border border-[var(--border)] shadow-xl relative overflow-hidden">
                <div className="border-r-3 border-[#D4AF37] pr-3">
                  <h2 className="text-lg font-black text-[var(--text-primary)]">البيانات الشخصية</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">مراجعة وتحرير الاسم، الصورة الشخصية ورقم الموبايل المسجل لدى المتجر.</p>
                </div>

                {saveSuccess && (
                  <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="font-bold">تم حفظ تعديلات بيانات الحساب بنجاح وتأمين الحفظ!</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-xs text-rose-500">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Display Name input */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--text-primary)]">الاسم بالكامل <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="الاسم الثلاثي أو الثنائي كما هو معتمد للتوصيل"
                          className="w-full glass-input text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm rounded-xl py-3 pr-10 pl-4 outline-none"
                        />
                        <UserIcon className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Email Display (Tied and strictly readonly) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--text-primary)]">البريد الإلكتروني <span className="text-[10px] text-[var(--text-secondary)] font-normal">(معرّف الحساب غير قابل للتعديل)</span></label>
                      <div className="relative">
                        <input
                          type="email"
                          value={user.email || ''}
                          disabled
                          dir="ltr"
                          className="w-full glass-input text-[var(--text-secondary)] bg-[var(--surface)] cursor-not-allowed text-xs sm:text-sm rounded-xl py-3 pr-10 pl-4 outline-none opacity-60"
                        />
                        <Mail className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Phone Number / Whatsapp Input */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--text-primary)]">رقم الموبايل / واتساب <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="مثال: 01012345678"
                          dir="ltr"
                          className="w-full glass-input text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm rounded-xl py-3 pr-10 pl-4 outline-none font-mono"
                        />
                        <Phone className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                      <span className="text-[10.5px] text-[var(--text-muted)] block leading-relaxed">يرجى التأكد من كتابة رقم موبايل مصري صحيح مكون من 11 رقم لسهولة إرسال الشحنة.</span>
                    </div>

                    {/* Profile Photo input URL */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--text-primary)]">رابط الصورة الشخصية (اختياري)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={photoURL}
                          onChange={(e) => setPhotoURL(e.target.value)}
                          placeholder="مثال: https://example.com/myphoto.jpg"
                          dir="ltr"
                          className="w-full glass-input text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm rounded-xl py-3 pr-10 pl-4 outline-none font-mono"
                        />
                        <ExternalLink className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Smart Avatar Presets Picker */}
                  <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                    <div className="text-[11px] font-black text-[var(--text-secondary)] flex items-center gap-1.5 uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-[#E0B84A]" />
                      <span>هل ترغب باختيار صورة كرتونية مميزة بدلاً من الرابط؟</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-4">
                      {PRESET_AVATARS.map((preset) => {
                        const isSelected = photoURL === preset.url;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPhotoURL(preset.url)}
                            className={`p-1 rounded-full border-2 transition-all flex items-center gap-2 group cursor-pointer ${
                              isSelected ? 'border-[#D4AF37] bg-[#D4AF37]/10 scale-105' : 'border-transparent hover:border-[var(--border)]'
                            }`}
                          >
                            <img src={getValidImageSrc(preset.url)} alt={preset.label} className="w-10 h-10 rounded-full object-cover" />
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] pl-2 hidden sm:inline">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profile Address text field */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">العنوان الأساسي لحسابي</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="المحافظة، المدينة، اسم الشارع، رقم العقار بالتفصيل"
                        className="w-full glass-input text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm rounded-xl py-3 pr-10 pl-4 outline-none"
                      />
                      <MapPin className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                    <span className="text-[10.5px] text-[var(--text-muted)] block leading-relaxed">العنوان الافتراضي المعتمد لتسريع عملية إنهاء الدفع والشحن.</span>
                  </div>

                  {/* Actions Strip */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black font-black text-xs rounded-xl flex items-center gap-2 shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>حفظ التغييرات الشخصية</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Saved Addresses Quick Summary Panel */}
              <div className="glass-panel rounded-3xl p-6 border border-[var(--border)] shadow-xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="border-r-3 border-[#D4AF37] pr-3">
                    <h3 className="text-sm font-black text-[var(--text-primary)]">دفتر عناوين التوصيل (العناوين)</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">العناوين الإضافية والتفصيلية المسجلة للشحن السريع.</p>
                  </div>
                  <button
                    onClick={() => {
                      resetAddressForm();
                      setActiveTab('addresses');
                    }}
                    className="text-xs font-bold text-[#E0B84A] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>إدارة كافة العناوين ({addresses.length})</span>
                    <ChevronRight className="w-3 h-3 rotate-180" />
                  </button>
                </div>

                {defaultAddress ? (
                  <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-start justify-between gap-4">
                    <div className="space-y-1.5 text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border)]">
                          {defaultAddress.label}
                        </span>
                        {defaultAddress.isDefault && (
                          <span className="text-[9px] font-bold text-[#D4AF37] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20">الافتراضي</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{defaultAddress.recipientName}</p>
                      <p className="text-xs text-[var(--text-secondary)] font-mono">{defaultAddress.phone}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {defaultAddress.governorate}، {defaultAddress.area}، {defaultAddress.street}، عمارة {defaultAddress.building}
                      </p>
                    </div>
                    <MapPin className="w-5 h-5 text-[#E0B84A] shrink-0" />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border)] text-center text-[var(--text-secondary)] text-xs">
                    لا يوجد عناوين مفصلة مضافة حالياً. يمكنك تفعيل دفتر العناوين لإضافة عنوان شحن دقيق بالكامل!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. TAB: FAVORITES ("المفضلة") */}
          {activeTab === 'favorites' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-r-3 border-[#D4AF37] pr-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">قائمة المفضلة والمجموعات</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">المنتجات التي قمت بحفظها في رغباتك منظمة في مجموعات مخصصة.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/favorites')}
                  className="self-start sm:self-auto text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>إدارة المجموعات بالكامل</span>
                </button>
              </div>

              {/* Group Filter Pills */}
              {favoritesList.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setProfileFavGroup('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                      profileFavGroup === 'all'
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : 'glass-panel text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                    }`}
                  >
                    جميع الرغبات ({favoritesList.length})
                  </button>
                  {wishlistGroups.map((group) => {
                    const count = favoritesList.filter(
                      (f) => (f.groupName || 'المفضلة العامة') === group
                    ).length;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setProfileFavGroup(group)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          profileFavGroup === group
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                            : 'glass-panel text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                        }`}
                      >
                        <Folder className="w-3 h-3" />
                        <span>{group}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {favoritesList.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary)] space-y-4 glass-panel rounded-3xl border border-[var(--border)]">
                  <HeartOff className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">قائمة المفضلة فارغة</h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">لم تقم بإضافة أي منتجات إلى قائمتك الخاصة بعد.</p>
                  </div>
                  <button
                    onClick={() => navigate('/products')}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black font-black text-xs rounded-xl shadow-md transition-all hover:brightness-110 cursor-pointer"
                  >
                    استكشاف المنتجات الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {favoritesList
                    .filter((item) => profileFavGroup === 'all' || (item.groupName || 'المفضلة العامة') === profileFavGroup)
                    .map((item) => (
                    <div
                      key={item.id}
                      className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden transition-all duration-300 hover:border-[#D4AF37]/40 flex flex-col justify-between"
                    >
                      <div className="p-3 relative">
                        {/* Remove favorite button */}
                        <button
                          onClick={() => handleRemoveFavorite(item)}
                          className="absolute top-5 left-5 z-10 p-1.5 rounded-full bg-black/60 hover:bg-rose-500 hover:text-white text-[var(--text-secondary)] transition-colors cursor-pointer"
                          title="حذف من المفضلة"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="w-full h-40 flex items-center justify-center rounded-xl bg-[var(--surface)] p-2">
                          {item.productImage ? (
                            <img
                              src={getValidImageSrc(item.productImage)}
                              alt={item.productName}
                              className="max-h-full max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-[var(--text-muted)]" />
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] text-[#E0B84A] font-bold block">{item.categoryName || 'قسم متميز'}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setMoveTargetProduct({
                                  id: item.productId,
                                  name: item.productName,
                                  currentGroup: item.groupName || 'المفضلة العامة',
                                })
                              }
                              className="text-[10px] text-[var(--text-muted)] hover:text-[#D4AF37] flex items-center gap-1 bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border)] transition-colors"
                              title="نقل لمجموعة أخرى"
                            >
                              <Folder className="w-2.5 h-2.5 text-[#D4AF37]" />
                              <span className="truncate max-w-[80px]">{item.groupName || 'المفضلة العامة'}</span>
                              <ArrowRightLeft className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-1 hover:text-[#E0B84A] cursor-pointer" onClick={() => navigate(`/product/${item.slug}`)}>
                            {item.productName}
                          </h3>
                        </div>

                        <div>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-xs sm:text-sm font-black text-[#E0B84A]">{item.price.toLocaleString('ar-EG')} ج.م</span>
                            {item.oldPrice && item.oldPrice > item.price && (
                              <span className="text-[10px] text-[var(--text-muted)] line-through">
                                {item.oldPrice.toLocaleString('ar-EG')} ج.م
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
                            <button
                              onClick={() => navigate(`/product/${item.slug}`)}
                              className="px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[10px] sm:text-xs rounded-lg text-center transition-all cursor-pointer"
                            >
                              عرض المنتج
                            </button>
                            <button
                              onClick={() => addToCart(item.productId, 1)}
                              className="px-3 py-2 bg-[#D4AF37] hover:bg-[#B88A24] text-black font-black text-[10px] sm:text-xs rounded-lg text-center transition-all cursor-pointer"
                            >
                              إضافة للسلة
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Move to group modal inside ProfilePage */}
              <MoveToGroupModal
                isOpen={!!moveTargetProduct}
                onClose={() => setMoveTargetProduct(null)}
                productId={moveTargetProduct?.id || ''}
                productName={moveTargetProduct?.name || ''}
                currentGroup={moveTargetProduct?.currentGroup || 'المفضلة العامة'}
                groups={wishlistGroups}
                onMove={moveFavoriteToGroup}
                onCreateGroup={createWishlistGroup}
              />
            </div>
          )}

          {/* 3. TAB: ORDERS ("طلباتي") */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="border-r-3 border-[#D4AF37] pr-3">
                <h2 className="text-lg font-black text-[var(--text-primary)]">سجل الطلبات وتتبع الشحنات</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">متابعة فورية ومحدثة لحالة طلباتك الحقيقية وتواريخ التسليم.</p>
              </div>

              {loadingOrders ? (
                <div className="p-12 text-center text-[var(--text-secondary)] space-y-3 glass-panel rounded-3xl border border-[var(--border)]">
                  <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
                  <p className="text-xs">جاري جلب قائمة طلباتك من خوادم آمنة...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary)] space-y-4 glass-panel rounded-3xl border border-[var(--border)]">
                  <ShoppingBag className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">لا توجد طلبات مسجلة</h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">لم تقم بإجراء أي عمليات شراء أو حجز طلبات حتى الآن.</p>
                  </div>
                  <button
                    onClick={() => navigate('/products')}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black font-black text-xs rounded-xl shadow-md transition-all hover:brightness-110 cursor-pointer"
                  >
                    تصفح المتجر والطلب الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const dateObj = new Date(order.createdAt);
                    const formattedDate = dateObj.toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    const formattedTime = dateObj.toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const stepIndex = getStepIndex(order.orderStatus);

                    return (
                      <div
                        key={order.id}
                        className="glass-panel rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300"
                      >
                        <div
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-[var(--text-secondary)]" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[var(--text-primary)]">
                                  طلب رقم: #{order.id.slice(-6).toUpperCase()}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${orderStatusColors[order.orderStatus] || ''}`}>
                                  {orderStatusLabels[order.orderStatus] || order.orderStatus}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formattedDate}</span>
                                <span>•</span>
                                <Clock className="w-3.5 h-3.5" />
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <span className="text-[10px] text-[var(--text-secondary)] block">إجمالي الحساب:</span>
                              <span className="text-xs sm:text-sm font-black text-[#E0B84A]">
                                {order.total.toLocaleString('ar-EG')} ج.م
                              </span>
                            </div>
                            <div className="text-[var(--text-muted)]">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Order Expanded Details Pane */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border)] p-5 space-y-6 bg-[var(--surface)]">
                            {/* Tracking Timeline */}
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-bold text-[#94A3B8] flex items-center gap-1.5 uppercase tracking-wide">
                                <Clock className="w-3.5 h-3.5 text-[#E0B84A]" />
                                <span>حالة تتبع الشحنة الفورية</span>
                              </h4>

                              {order.orderStatus === 'cancelled' ? (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>تم إلغاء هذا الطلب وإرجاع المنتجات للمخزن.</span>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1">
                                  {statusSteps.map((step, idx) => {
                                    const isDone = stepIndex >= idx;
                                    const isCurrent = order.orderStatus === step;

                                    return (
                                      <div
                                        key={step}
                                        className={`p-2.5 rounded-xl border text-center transition-all ${
                                          isCurrent
                                            ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#E0B84A] shadow-[0_4px_12px_rgba(212,175,55,0.08)]'
                                            : isDone
                                            ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-500'
                                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                                        }`}
                                      >
                                        <div className="text-[10px] font-black">{orderStatusLabels[step]}</div>
                                        <div className="text-[8px] opacity-75 mt-0.5">
                                          {isCurrent ? 'جاري الآن' : isDone ? 'مكتمل' : 'بانتظار الإجراء'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Order Products List */}
                            <div className="space-y-3">
                              <h4 className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5 uppercase tracking-wide">
                                <ShoppingBag className="w-3.5 h-3.5 text-[#E0B84A]" />
                                <span>المنتجات المسجلة بالفاتورة</span>
                              </h4>
                              
                              <div className="space-y-2 border border-[var(--border)] rounded-xl p-3 bg-[var(--surface-elevated)]">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)] last:border-0 last:pb-0"
                                  >
                                    <div className="flex items-center gap-3">
                                      {item.productImage ? (
                                        <img
                                          src={getValidImageSrc(item.productImage)}
                                          alt={item.productName}
                                          className="w-10 h-10 rounded-lg object-contain bg-white p-0.5 border border-[var(--border)]"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg" />
                                      )}
                                      <div>
                                        <span className="text-xs font-bold text-[var(--text-primary)] block">{item.productName}</span>
                                        <span className="text-[10px] text-[var(--text-secondary)]">
                                          الكمية: {item.quantity.toLocaleString('ar-EG')} × {item.priceAtPurchase.toLocaleString('ar-EG')} ج.م
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs font-black text-[var(--text-primary)]">
                                      {(item.lineTotal || (item.priceAtPurchase * item.quantity)).toLocaleString('ar-EG')} ج.م
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Quick Address Summary & Prices Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2 text-right">
                                <h5 className="text-[10px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase">
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>عنوان التوصيل المختار</span>
                                </h5>
                                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                                  <p className="font-bold text-[var(--text-primary)]">{order.customerName}</p>
                                  <p className="font-mono text-[var(--text-muted)]">{order.customerPhone}</p>
                                  <p>{order.shippingAddress}</p>
                                </div>
                              </div>

                              <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
                                <h5 className="text-[10px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>حساب التكلفة النهائية المعتمد</span>
                                </h5>
                                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                                  <div className="flex justify-between">
                                    <span>المجموع الفرعي:</span>
                                    <span>{(order.subtotal || order.total).toLocaleString('ar-EG')} ج.م</span>
                                  </div>
                                  {order.discount > 0 && (
                                    <div className="flex justify-between text-emerald-500">
                                      <span>كوبون خصم:</span>
                                      <span>-{order.discount.toLocaleString('ar-EG')} ج.م</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span>قيمة الشحن والتوصيل:</span>
                                    <span>{order.shippingCost === 0 ? 'شحن مجاني 🎁' : `${order.shippingCost.toLocaleString('ar-EG')} ج.م`}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-sm">
                                    <span className="text-[var(--text-primary)]">الإجمالي النهائي:</span>
                                    <span className="text-[#E0B84A]">{order.total.toLocaleString('ar-EG')} ج.م</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                              <button
                                onClick={() => setSelectedInvoiceOrder(order)}
                                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/25 text-[#E0B84A] border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                                <span>معاينة وتنزيل الفاتورة</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. TAB: INVOICES ("الفواتير") */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="border-r-3 border-[#D4AF37] pr-3">
                <h2 className="text-lg font-black text-[var(--text-primary)]">سجلات الفواتير المعتمدة</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">تفاصيل السجلات المحاسبية والفواتير الصادرة المرتبطة بعمليات الشراء.</p>
              </div>

              {orders.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-secondary)] space-y-4 glass-panel rounded-3xl border border-[var(--border)]">
                  <FileText className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">لا توجد فواتير صادرة</h3>
                    <p className="text-xs text-[var(--text-muted)]">سيتم إصدار فواتيرك تلقائياً وبأرقام مرجعية بمجرد حجز طلبياتك.</p>
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[var(--surface-elevated)] border-b border-[var(--border)] text-[var(--text-secondary)] font-bold">
                          <th className="p-4">رقم الفاتورة</th>
                          <th className="p-4">تاريخ الإصدار</th>
                          <th className="p-4">طريقة الدفع</th>
                          <th className="p-4">الإجمالي النهائي</th>
                          <th className="p-4">التحكم والعمليات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                        {orders.map((order) => {
                          const year = new Date(order.createdAt).getFullYear();
                          const fallbackInvoice = `INV-${year}-${order.id.slice(-6).toUpperCase()}`;
                          const invNum = order.invoiceNumber || fallbackInvoice;
                          const dateStr = new Date(order.invoiceCreatedAt || order.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });

                          return (
                            <tr key={order.id} className="hover:bg-[var(--surface)] transition-colors">
                              <td className="p-4 font-mono font-bold text-[#E0B84A]">{invNum}</td>
                              <td className="p-4 text-[var(--text-secondary)]">{dateStr}</td>
                              <td className="p-4">
                                <span className="px-2.5 py-1 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-[10px] text-[var(--text-secondary)]">
                                  {order.paymentMethod === 'cod' ? 'نقدي عند الاستلام 💵' : 'دفع إلكتروني 💳'}
                                </span>
                              </td>
                              <td className="p-4 font-bold text-[var(--text-primary)]">{order.total.toLocaleString('ar-EG')} ج.م</td>
                              <td className="p-4 flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedInvoiceOrder(order)}
                                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#E0B84A] border border-[#D4AF37]/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  title="عرض وطباعة"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">طباعة الفاتورة</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. TAB: NOTIFICATIONS ("الإشعارات") */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-r-3 border-[#D4AF37] pr-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                    <span>مركز الإشعارات والتحديثات</span>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/30 animate-pulse">
                        {notifications.filter(n => !n.read).length} غير مقروء
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">تتبع مسار ومراحل طلباتك، فواتيرك، والعروض المخصصة لك في الوقت الفعلي.</p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {notifications.some(n => !n.read) && (
                    <button
                      onClick={() => user?.uid && notificationService.markAllAsRead(user.uid)}
                      className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#E0B84A] border border-[#D4AF37]/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>تحديد الكل كمقروء</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm('هل تريد بالتأكيد مسح جميع الإشعارات؟')) {
                          if (user?.uid) notificationService.clearAllNotifications(user.uid);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-500 border border-[var(--border)] hover:border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح الكل</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <button
                  onClick={() => setNotificationFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    notificationFilter === 'all'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black shadow-md shadow-[#D4AF37]/20 font-black'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  جميع الإشعارات ({notifications.length})
                </button>
                <button
                  onClick={() => setNotificationFilter('unread')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    notificationFilter === 'unread'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black shadow-md shadow-[#D4AF37]/20 font-black'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  <span>غير المقروءة</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      notificationFilter === 'unread' ? 'bg-black text-[#E0B84A]' : 'bg-rose-500 text-white'
                    }`}>
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setNotificationFilter('orders')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    notificationFilter === 'orders'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black shadow-md shadow-[#D4AF37]/20 font-black'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  حالات الطلبات والدفع ({notifications.filter(n => n.relatedType === 'order' || n.type.startsWith('order_') || n.type.startsWith('payment_')).length})
                </button>
                <button
                  onClick={() => setNotificationFilter('offers')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    notificationFilter === 'offers'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black shadow-md shadow-[#D4AF37]/20 font-black'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                  }`}
                >
                  العروض والمفضلة ({notifications.filter(n => n.relatedType === 'product' || n.type.includes('favorite') || n.type === 'coupon' || n.type === 'product_back_in_stock').length})
                </button>
              </div>

              {/* Notification Content */}
              {loadingNotifications ? (
                <div className="p-12 text-center text-[var(--text-secondary)] space-y-3 glass-panel rounded-3xl border border-[var(--border)]">
                  <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
                  <p className="text-xs">جاري تحميل إشعاراتك وتحديثات الحساب...</p>
                </div>
              ) : (() => {
                const filtered = notifications.filter(n => {
                  if (notificationFilter === 'unread') return !n.read;
                  if (notificationFilter === 'orders') return n.relatedType === 'order' || n.type.startsWith('order_') || n.type.startsWith('payment_');
                  if (notificationFilter === 'offers') return n.relatedType === 'product' || n.type.includes('favorite') || n.type === 'coupon' || n.type === 'product_back_in_stock';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center text-[var(--text-secondary)] space-y-4 glass-panel rounded-3xl border border-[var(--border)]">
                      <div className="w-14 h-14 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl flex items-center justify-center mx-auto text-[var(--text-muted)]">
                        <BellOff className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          {notificationFilter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات في هذا القسم'}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          {notificationFilter === 'unread' 
                            ? 'لقد اطلعت على جميع الإشعارات والتحديثات المعلقة بحسابك.' 
                            : 'ستظهر هنا كافة إشعارات طلباتك وتحديثات الأسعار فور حدوثها.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((notif) => {
                      const isOrder = notif.relatedType === 'order' || notif.type.startsWith('order_') || notif.type.startsWith('payment_');
                      const isProduct = notif.relatedType === 'product' || notif.type.startsWith('product_') || notif.type.includes('favorite');

                      // Dynamic Icon Selection
                      const renderIcon = () => {
                        const iconColor = isDark ? {
                          emerald: 'text-emerald-400',
                          sky: 'text-sky-400',
                          blue: 'text-blue-400',
                          indigo: 'text-indigo-400',
                          rose: 'text-rose-400',
                          amber: 'text-amber-400',
                          purple: 'text-purple-400',
                          gold: 'text-[#E0B84A]',
                        } : {
                          emerald: 'text-emerald-600',
                          sky: 'text-sky-600',
                          blue: 'text-blue-600',
                          indigo: 'text-indigo-600',
                          rose: 'text-rose-600',
                          amber: 'text-amber-600',
                          purple: 'text-purple-600',
                          gold: 'text-[#B38F1E]',
                        };

                        switch (notif.type) {
                          case 'order_created': return <ShoppingBag className={`w-5 h-5 ${iconColor.emerald}`} />;
                          case 'order_confirmed': return <CheckCircle2 className={`w-5 h-5 ${iconColor.emerald}`} />;
                          case 'order_preparing': return <Package className={`w-5 h-5 ${iconColor.sky}`} />;
                          case 'order_ready_to_ship': return <PackageCheck className={`w-5 h-5 ${iconColor.blue}`} />;
                          case 'order_shipped': return <Truck className={`w-5 h-5 ${iconColor.indigo}`} />;
                          case 'order_delivered': return <CheckCircle2 className={`w-5 h-5 ${iconColor.emerald}`} />;
                          case 'order_cancelled': return <XCircle className={`w-5 h-5 ${iconColor.rose}`} />;
                          case 'payment_received': return <CreditCard className={`w-5 h-5 ${iconColor.emerald}`} />;
                          case 'payment_pending': return <Clock className={`w-5 h-5 ${iconColor.amber}`} />;
                          case 'payment_failed': return <AlertCircle className={`w-5 h-5 ${iconColor.rose}`} />;
                          case 'product_back_in_stock': return <Sparkles className={`w-5 h-5 ${iconColor.amber}`} />;
                          case 'favorite_product_discount': return <Flame className={`w-5 h-5 ${iconColor.rose}`} />;
                          case 'favorite_price_drop': return <TrendingDown className={`w-5 h-5 ${iconColor.emerald}`} />;
                          case 'coupon': return <Tag className={`w-5 h-5 ${iconColor.purple}`} />;
                          case 'admin_announcement': return <Megaphone className={`w-5 h-5 ${iconColor.gold}`} />;
                          default: return <Info className={`w-5 h-5 ${iconColor.gold}`} />;
                        }
                      };

                      // Dynamic Badge Text
                      const getBadgeLabel = () => {
                        switch (notif.type) {
                          case 'order_created': return 'إنشاء طلب';
                          case 'order_confirmed': return 'تأكيد طلب';
                          case 'order_preparing': return 'تجهيز الطلب';
                          case 'order_ready_to_ship': return 'جاهز للشحن';
                          case 'order_shipped': return 'شحن وتوصيل';
                          case 'order_delivered': return 'تم التسليم';
                          case 'order_cancelled': return 'إلغاء الطلب';
                          case 'order_status_changed': return 'تحديث الطلب';
                          case 'payment_received': return 'تأكيد الدفع';
                          case 'payment_pending': return 'بانتظار الدفع';
                          case 'payment_failed': return 'تعذر الدفع';
                          case 'product_back_in_stock': return 'توفر بالمخزون';
                          case 'favorite_product_discount': return 'عرض بالمفضلة';
                          case 'favorite_price_drop': return 'انخفاض السعر';
                          case 'coupon': return 'كوبون خصم';
                          case 'admin_announcement': return 'تنويه إدارة';
                          default: return 'تنبيه';
                        }
                      };

                      return (
                        <div
                          key={notif.notificationId}
                          onClick={async () => {
                            if (!notif.read && user?.uid) await notificationService.markAsRead(user.uid, notif.notificationId);
                            if (notif.relatedId && notif.relatedType === 'order') {
                              setActiveTab('orders');
                              setExpandedOrderId(notif.relatedId);
                            } else if (notif.relatedId && notif.relatedType === 'product') {
                              navigate(`/product/${notif.relatedId}`);
                            }
                          }}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative group flex items-start gap-4 ${
                            notif.read
                              ? 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-elevated)]'
                              : 'bg-[#D4AF37]/5 border-[#D4AF37]/25 hover:bg-[#D4AF37]/10 shadow-[0_4px_20px_rgba(212,175,55,0.05)]'
                          }`}
                        >
                          {/* Icon Container */}
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shrink-0 flex items-center justify-center border ${
                            notif.read 
                              ? 'bg-[var(--surface-elevated)] border-[var(--border)]' 
                              : 'bg-[#D4AF37]/15 border-[#D4AF37]/35 shadow-sm'
                          }`}>
                            {renderIcon()}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                  notif.read
                                    ? 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)]'
                                    : 'bg-[#D4AF37]/15 text-[#E0B84A] border-[#D4AF37]/30'
                                }`}>
                                  {getBadgeLabel()}
                                </span>
                                {!notif.read && (
                                  <span className="text-[10px] font-bold text-[#E0B84A] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E0B84A] inline-block animate-ping" />
                                    جديد
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                {new Date(notif.createdAt).toLocaleDateString('ar-EG', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 group-hover:text-[#E0B84A] transition-colors">
                              {notif.title}
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              {notif.message}
                            </p>

                            {/* Actions footer on card */}
                            <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                              {notif.relatedId ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!notif.read && user?.uid) notificationService.markAsRead(user.uid, notif.notificationId);
                                    if (notif.relatedType === 'order') {
                                      setActiveTab('orders');
                                      setExpandedOrderId(notif.relatedId!);
                                    } else if (notif.relatedType === 'product') {
                                      navigate(`/product/${notif.relatedId}`);
                                    }
                                  }}
                                  className="text-xs font-bold text-[#E0B84A] hover:underline flex items-center gap-1.5 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>{isOrder ? 'الانتقال لتفاصيل الطلب في حسابي' : isProduct ? 'عرض صفحة المنتج الآن' : 'عرض التفاصيل'}</span>
                                </button>
                              ) : <span />}

                              <div className="flex items-center gap-1.5">
                                {!notif.read && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (user?.uid) await notificationService.markAsRead(user.uid, notif.notificationId);
                                    }}
                                    className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[#D4AF37]/20 text-[var(--text-secondary)] hover:text-[#E0B84A] border border-[var(--border)] transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
                                    title="تحديد كمقروء"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span className="hidden sm:inline">مقروء</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (user?.uid) await notificationService.deleteNotification(user.uid, notif.notificationId);
                                  }}
                                  className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-500 border border-[var(--border)] hover:border-rose-500/30 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
                                  title="حذف هذا الإشعار"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">حذف</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 6. TAB: ADDRESSES ("العناوين") */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-r-3 border-[#D4AF37] pr-3">
                <div>
                  <h2 className="text-lg font-black text-[#F8FAFC]">إدارة عناوين التوصيل والتسليم</h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">يمكنك إضافة وتحرير العناوين بالتفصيل لتفادي التأخيرات في الشحن والتوصيل.</p>
                </div>
                {!showAddressForm && (
                  <button
                    onClick={() => {
                      resetAddressForm();
                      setShowAddressForm(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#E0B84A] border border-[#D4AF37]/35 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عنوان توصيل جديد</span>
                  </button>
                )}
              </div>

              {/* Address Edit/Add Form Sheet */}
              {showAddressForm && (
                <div className="glass-panel rounded-3xl p-6 border border-[#D4AF37]/20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
                  <h3 className="text-sm font-black text-[#E0B84A] mb-4 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{editingAddress ? 'تعديل هذا العنوان' : 'إضافة عنوان توصيل جديد'}</span>
                  </h3>

                  {addressError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{addressError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddressSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Label of Address */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">تسمية العنوان <span className="text-rose-400">*</span></label>
                        <select
                          value={addrLabel}
                          onChange={(e) => setAddrLabel(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-[#091424] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        >
                          <option value="المنزل">المنزل 🏠</option>
                          <option value="العمل">العمل 💼</option>
                          <option value="بيت العائلة">بيت العائلة 🏢</option>
                          <option value="أخرى">أخرى 📍</option>
                        </select>
                      </div>

                      {/* Recipient Name */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">اسم المستلم بالكامل <span className="text-rose-400">*</span></label>
                        <input
                          type="text"
                          required
                          value={addrRecipientName}
                          onChange={(e) => setAddrRecipientName(e.target.value)}
                          placeholder="الاسم الثلاثي المعتمد لاستلام الشحنة"
                          className="w-full h-11 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        />
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">رقم الموبايل للتواصل <span className="text-rose-400">*</span></label>
                        <input
                          type="tel"
                          required
                          value={addrPhone}
                          onChange={(e) => setAddrPhone(e.target.value)}
                          placeholder="رقم المستلم (مثال: 01012345678)"
                          className="w-full h-11 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all font-mono"
                        />
                      </div>

                      {/* Governorate Select */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">المحافظة <span className="text-rose-400">*</span></label>
                        <select
                          value={addrGovernorate}
                          onChange={(e) => setAddrGovernorate(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-[#091424] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        >
                          <option value="">اختر المحافظة...</option>
                          {['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الغربية', 'الشرقية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'].map((gov) => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))}
                        </select>
                      </div>

                      {/* Area / City */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">المنطقة / الحي / المدينة <span className="text-rose-400">*</span></label>
                        <input
                          type="text"
                          required
                          value={addrArea}
                          onChange={(e) => setAddrArea(e.target.value)}
                          placeholder="مثال: مدينة نصر، المعادي"
                          className="w-full h-11 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        />
                      </div>

                      {/* Street name */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">اسم الشارع ورقم المبنى <span className="text-rose-400">*</span></label>
                        <input
                          type="text"
                          required
                          value={addrStreet}
                          onChange={(e) => setAddrStreet(e.target.value)}
                          placeholder="اسم الشارع بالتفصيل مع توضيح العمارة"
                          className="w-full h-11 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        />
                      </div>

                      {/* Apartment & Floor details */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">رقم العمارة والمبنى <span className="text-rose-400">*</span></label>
                        <input
                          type="text"
                          required
                          value={addrBuilding}
                          onChange={(e) => setAddrBuilding(e.target.value)}
                          placeholder="مثال: عمارة رقم 14ب"
                          className="w-full h-11 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#94A3B8]">الطابق والشقة (اختياري)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={addrFloor}
                            onChange={(e) => setAddrFloor(e.target.value)}
                            placeholder="الدور الثاني"
                            className="w-full h-11 px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                          />
                          <input
                            type="text"
                            value={addrApartment}
                            onChange={(e) => setAddrApartment(e.target.value)}
                            placeholder="شقة 5"
                            className="w-full h-11 px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Default address configuration */}
                    <div className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        id="isDefaultAddress"
                        checked={addrIsDefault}
                        onChange={(e) => setAddrIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded-sm accent-[#D4AF37] cursor-pointer"
                      />
                      <label htmlFor="isDefaultAddress" className="text-xs text-[#CBD5E1] cursor-pointer select-none">
                        تعيين كعنوان افتراضي ومفضل لحسابي في المعاملات اللاحقة
                      </label>
                    </div>

                    {/* Additional delivery notes */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#94A3B8]">ملاحظات وتوجيهات الشحن الإضافية (اختياري)</label>
                      <textarea
                        rows={2}
                        value={addrNotes}
                        onChange={(e) => setAddrNotes(e.target.value)}
                        placeholder="علامة مميزة، بجانب عيادة، يرجى التوصيل بعد الساعة 3 عصراً"
                        className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F8FAFC] focus:border-[#D4AF37]/50 focus:bg-[#07111C]/80 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-[#05080D] font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{editingAddress ? 'حفظ التعديلات بالعنوان' : 'تسجيل العنوان بالدفتر'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetAddressForm}
                        className="px-5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-[#CBD5E1] text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        إلغاء التراجع
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Saved Addresses grid list display */}
              {loadingAddresses ? (
                <div className="p-12 text-center text-[#94A3B8] space-y-3 glass-panel rounded-3xl border border-white/[0.06]">
                  <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
                  <p className="text-xs">جاري تحميل قائمة العناوين المحفوظة...</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-12 text-center text-[#94A3B8] space-y-4 glass-panel rounded-3xl border border-white/[0.06]">
                  <MapPin className="w-8 h-8 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#F8FAFC]">دفتر العناوين فارغ</h3>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto">لم تقم بحفظ أي عناوين تفصيلية بعد للشحن السريع.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.addressId}
                      className={`p-5 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between ${
                        addr.isDefault
                          ? 'bg-[#D4AF37]/5 border-[#D4AF37]/35 shadow-[0_4px_20px_rgba(212,175,55,0.08)]'
                          : 'bg-white/[0.02] border-white/[0.08] hover:border-[#D4AF37]/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                              {addr.label === 'المنزل' ? '🏠' : addr.label === 'العمل' ? '💼' : addr.label === 'بيت العائلة' ? '🏢' : '📍'}{' '}
                              {addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[9px] font-bold text-[#D4AF37] px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30">
                                الافتراضي ⭐
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditAddressClick(addr)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-[#CBD5E1] hover:text-[#E0B84A] transition-all cursor-pointer"
                              title="تعديل العنوان"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(addr.addressId)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.06] text-[#CBD5E1] hover:text-rose-400 transition-all cursor-pointer"
                              title="حذف العنوان"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-[#CBD5E1] text-right">
                          <p className="font-bold text-white text-sm mb-1">{addr.recipientName}</p>
                          <p className="font-mono text-[#94A3B8]">{addr.phone}</p>
                          <p className="leading-relaxed">
                            {addr.governorate}، {addr.area}، {addr.street}، عمارة {addr.building}
                            {addr.floor && `، ${addr.floor}`}
                            {addr.apartment && `، شقة ${addr.apartment}`}
                          </p>
                          {addr.notes && (
                            <p className="text-[11px] text-[#818CF8] bg-white/[0.03] p-2 rounded-lg border border-white/[0.04] mt-2">
                              📝 ملاحظة: {addr.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {!addr.isDefault && (
                        <div className="mt-4 pt-3 border-t border-white/[0.04] flex justify-end">
                          <button
                            onClick={() => handleSetDefaultAddress(addr.addressId)}
                            className="text-[10px] font-bold text-[#CBD5E1] hover:text-[#E0B84A] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>تعيين كعنوان افتراضي مفضل</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. Recently Viewed Products Tab View */}
          {activeTab === 'recently_viewed' && (
            <div className="space-y-6">
              <RecentlyViewedSection
                navigate={navigate}
                title="المنتجات التي شاهدتها مؤخرًا"
                subtitle="سجل المنتجات والأجهزة التي تصفحتها مؤخرًا في متجرنا"
                limit={20}
              />
            </div>
          )}

        </main>
      </div>

      {/* Invoice Viewer and PDF generation Modal */}
      <InvoiceModal
        order={selectedInvoiceOrder}
        isOpen={!!selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        storeSettings={settings}
        isAdmin={false}
      />

      {/* 7. Action Confirm Modal: "تسجيل الخروج" */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-[#0E1E2E] rounded-2xl border border-white/10 shadow-2xl p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <LogOut className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">تأكيد تسجيل الخروج</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">هل ترغب بالفعل في الخروج الآمن من الحساب الشخصي لمتجر {settings.storeName || 'البيت السعيد'}؟</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#CBD5E1] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                onClick={confirmLogout}
                className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                تأكيد الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Avatar Cropper Modal */}
      {showCropModal && cropImageSrc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#0E1E2E] rounded-3xl border border-white/10 shadow-2xl p-5 sm:p-6 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3" dir="rtl">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#D4AF37]" />
                <span>ضبط وقص الصورة الشخصية</span>
              </h3>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setCropImageSrc(null);
                }}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-[#CBD5E1] hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Container for Cropper (needs relative positioning and defined height) */}
            <div className="relative w-full h-64 sm:h-80 bg-[#07111C] rounded-2xl overflow-hidden border border-white/[0.06]">
              {!isImageLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#07111C]/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                    <span className="text-xs text-white font-medium">جاري تحميل الصورة...</span>
                  </div>
                </div>
              )}
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                onMediaLoaded={() => setIsImageLoaded(true)}
              />
            </div>

            {/* Live circular preview and controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center" dir="rtl">
              {/* Zoom Controls */}
              <div className="sm:col-span-8 space-y-2 text-right">
                <label className="text-xs font-bold text-[#94A3B8] flex items-center justify-between">
                  <span>درجة التقريب والزوم:</span>
                  <span className="font-mono text-[#D4AF37]">{Math.round(zoom * 100)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setZoom(prev => Math.max(1, prev - 0.1))}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#CBD5E1] hover:text-[#D4AF37] transition-all cursor-pointer"
                    title="تصغير"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-[#D4AF37] h-1.5 rounded-lg bg-white/[0.06] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#CBD5E1] hover:text-[#D4AF37] transition-all cursor-pointer"
                    title="تكبير"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Live Preview circle */}
              <div className="sm:col-span-4 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-r border-white/[0.08] pt-4 sm:pt-0 sm:pr-4">
                <span className="text-[10px] font-bold text-[#64748B] mb-2 text-center block">معاينة الصورة:</span>
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#D4AF37]/50 shadow-inner bg-[#07111C]">
                  <div style={getPreviewStyle()} />
                </div>
              </div>
            </div>

            {/* Arabic Action buttons */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.08]" dir="rtl">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setCropImageSrc(null);
                }}
                className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#CBD5E1] hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className="py-2.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/15 border border-[#D4AF37]/20 text-[#E0B84A] font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                إعادة ضبط
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                disabled={!isImageLoaded || isUploading}
                className="py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-[#05080D] font-black text-xs rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1 shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{isUploading ? 'جاري الحفظ...' : 'تأكيد الصورة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

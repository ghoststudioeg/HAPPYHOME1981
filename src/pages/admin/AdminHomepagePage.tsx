import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { homepageService, DEFAULT_HOMEPAGE_SETTINGS } from '../../lib/data/homepageService';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';
import { storageService } from '../../lib/data/storageService';
import {
  HomepageSettings,
  LimitedOffer,
  ComingSoonItem,
  HeroBanner,
  BannerMediaType,
  BannerVideoSource,
  HeroTargetType,
  BannerPlacement,
  NewsTickerItem,
  Product,
  Category
} from '../../types';
import {
  extractYouTubeVideoId,
  isYouTubeUrl,
  isValidDirectMediaUrl,
  buildYouTubeEmbedUrl,
  getYouTubeThumbnailUrl
} from '../../utils/youtube';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/admin/ConfirmDeleteModal';
import {

  Sparkles,
  Flame,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Calendar,
  Layers,
  Eye,
  X,
  Smartphone,
  Tag,
  Upload,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Bell,
  Truck,
  RefreshCw,
  Monitor,
  Globe,
  Folder,
  ShoppingBag,
  ChevronDown,
  Info,
  Video,
  Film,
  Play,
  Youtube,
  Image as ImageIcon
} from 'lucide-react';

export const BANNER_PLACEMENT_OPTIONS: { id: BannerPlacement; label: string; desc: string }[] = [
  { id: 'home_hero', label: 'الرئيسية — البنر الرئيسي (Homepage Hero)', desc: 'يظهر في أعلى الصفحة الرئيسية كبنر أساسي' },
  { id: 'home_promo', label: 'الرئيسية — قسم العروض الترويجية (Homepage Promo)', desc: 'يظهر في قسم العروض الترويجية في الرئيسية' },
  { id: 'offers_page', label: 'صفحة العروض والتخفيضات (Offers Page)', desc: 'يظهر في صفحة العروض والتخفيضات' },
  { id: 'catalog_page', label: 'صفحة الكتالوج وكل المنتجات (Catalog Page)', desc: 'يظهر أعلى صفحة المنتجات العامة' },
  { id: 'category_all', label: 'صفحات الأقسام — عام (All Categories)', desc: 'يظهر أعلى كل صفحات الأقسام' },
  { id: 'category_specific', label: 'قسم محدد (Specific Category)', desc: 'يظهر في قسم مخصص تحدده أنت' },
  { id: 'product_all', label: 'صفحات المنتجات — عام (All Product Pages)', desc: 'يظهر في صفحات تفاصيل المنتجات' },
  { id: 'product_specific', label: 'صفحة منتج محدد (Specific Product Page)', desc: 'يظهر في صفحة تفاصيل منتج معين' },
  { id: 'custom_section', label: 'قسم مخصص في المتجر (Custom Store Section)', desc: 'يظهر في أقسام المتجر المخصصة' },
];

interface AdminHomepagePageProps {
  navigate: (path: string) => void;
}

export function AdminHomepagePage({ navigate }: AdminHomepagePageProps) {
  const [activeTab, setActiveTab] = useState<'banners' | 'news' | 'sections' | 'offers' | 'comingSoon'>('banners');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Data states
  const [settings, setSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [newsList, setNewsList] = useState<NewsTickerItem[]>([]);
  const [offers, setOffers] = useState<LimitedOffer[]>([]);
  const [comingSoon, setComingSoon] = useState<ComingSoonItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'banner' | 'news' | 'offer' | 'comingSoon';
    id: string;
    itemName: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Banner Modal State
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDesktopImage, setUploadingDesktopImage] = useState(false);
  const [uploadingMobileImage, setUploadingMobileImage] = useState(false);
  const [uploadingPosterImage, setUploadingPosterImage] = useState(false);
  const [uploadingMobilePosterImage, setUploadingMobilePosterImage] = useState(false);
  const [adminVideoPreviewFailed, setAdminVideoPreviewFailed] = useState(false);
  const [bannerPreviewMode, setBannerPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showAdvancedBannerFields, setShowAdvancedBannerFields] = useState(false);

  const [bannerForm, setBannerForm] = useState({
    title: '',
    mediaType: 'image' as BannerMediaType,
    videoSource: 'direct' as BannerVideoSource,
    videoUrl: '',
    youtubeVideoId: '',
    mobileVideoUrl: '',
    mobileYoutubeVideoId: '',
    posterImageUrl: '',
    mobilePosterImageUrl: '',
    targetType: 'product' as HeroTargetType,
    targetValue: '',
    displayDuration: 5,
    subtitle: '',
    badgeText: 'عرض حصري',
    badgeType: 'gold' as 'gold' | 'red' | 'emerald' | 'blue',
    desktopImageUrl: '',
    mobileImageUrl: '',
    productImageUrl: '',
    imageSizeMode: 'contain' as 'contain' | 'cover',
    productId: '',
    productSlug: '',
    campaignPrice: 0,
    campaignStartDate: '',
    campaignEndDate: '',
    placements: ['home_hero'] as (BannerPlacement | string)[],
    specificCategoryId: '',
    specificProductId: '',
    price: 0,
    oldPrice: 0,
    discountPercent: 0,
    ctaText: 'اسأل عن المنتج',
    ctaType: 'whatsapp' as 'whatsapp' | 'product_page' | 'custom_link',
    ctaLink: '',
    isActive: true,
    sortOrder: 1,
    startDate: '',
    endDate: '',
    showOnHome: true,
    showOnCatalog: false,
    categoryIds: [] as string[]
  });

  // News Ticker Modal State
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsForm, setNewsForm] = useState({
    text: '',
    type: 'news' as 'offer' | 'news' | 'new_arrival' | 'alert' | 'custom',
    icon: '',
    link: '',
    isActive: true,
    sortOrder: 1,
    startDate: '',
    endDate: ''
  });

  // Offer Modal State
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({
    productId: '',
    productName: '',
    productSlug: '',
    productImage: '',
    productDescription: '',
    originalPrice: 0,
    offerPrice: 0,
    discountPercent: 0,
    startDate: new Date().toISOString().split('T')[0],
    startTime: '00:00',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endTime: '23:59',
    isActive: true
  });

  // Coming Soon Modal State
  const [comingSoonModalOpen, setComingSoonModalOpen] = useState(false);
  const [editingComingSoonId, setEditingComingSoonId] = useState<string | null>(null);
  const [comingSoonForm, setComingSoonForm] = useState({
    name: '',
    image: '',
    shortDescription: '',
    expectedDate: '',
    isActive: true,
    sortOrder: 1
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [s, b, n, o, c, p, cats] = await Promise.all([
        homepageService.getSettings(),
        homepageService.getAllBanners(),
        homepageService.getAllNews(),
        homepageService.getAllOffers(),
        homepageService.getAllComingSoon(),
        productService.getAllProducts(true),
        categoryService.getCategories(true)
      ]);
      setSettings(s);
      setBanners(b);
      setNewsList(n);
      setOffers(o);
      setComingSoon(c);
      setProducts(p);
      setCategories(cats);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('تعذر تحميل إعدادات الصفحة الرئيسية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // --------------------------------------------------------------------------
  // Save Section Settings
  // --------------------------------------------------------------------------
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await homepageService.updateSettings(settings);
      showNotification('تم حفظ إعدادات الصفحة الرئيسية بنجاح في Firebase.');
    } catch (err: any) {
      showNotification(err?.message || 'فشل حفظ الإعدادات', true);
    } finally {
      setSavingSettings(false);
    }
  };

  // --------------------------------------------------------------------------
  // Hero Banners Logic
  // --------------------------------------------------------------------------
  const handleProductSelectForBanner = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const discount = prod.oldPrice && prod.oldPrice > prod.price
      ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100)
      : 0;

    setBannerForm((prev) => ({
      ...prev,
      productId: prod.id,
      productSlug: prod.slug,
      title: prod.name,
      subtitle: prod.description ? prod.description.substring(0, 120) : '',
      productImageUrl: prod.mainImageUrl || '',
      price: prod.price || 0,
      oldPrice: prod.oldPrice || 0,
      discountPercent: discount
    }));
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const url = await storageService.uploadProductImage('hero_banners', file);
      setBannerForm((prev) => ({ ...prev, productImageUrl: url }));
      showNotification('تم رفع صورة الإعلان بنجاح.');
    } catch (err: any) {
      showNotification(err?.message || 'تعذر رفع الصورة', true);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDesktopImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDesktopImage(true);
      const url = await storageService.uploadProductImage('hero_desktop', file);
      setBannerForm((prev) => ({ ...prev, desktopImageUrl: url }));
      showNotification('تم رفع صورة سطح المكتب بنجاح.');
    } catch (err: any) {
      showNotification(err?.message || 'تعذر رفع الصورة', true);
    } finally {
      setUploadingDesktopImage(false);
    }
  };

  const handleMobileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingMobileImage(true);
      const url = await storageService.uploadProductImage('hero_mobile', file);
      setBannerForm((prev) => ({ ...prev, mobileImageUrl: url }));
      showNotification('تم رفع صورة الموبايل بنجاح.');
    } catch (err: any) {
      showNotification(err?.message || 'تعذر رفع الصورة', true);
    } finally {
      setUploadingMobileImage(false);
    }
  };

  const handlePosterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPosterImage(true);
      const url = await storageService.uploadProductImage('hero_poster', file);
      setBannerForm((prev) => ({
        ...prev,
        posterImageUrl: url,
        desktopImageUrl: prev.desktopImageUrl || url
      }));
      showNotification('تم رفع صورة البوستر لسطح المكتب بنجاح.');
    } catch (err: any) {
      showNotification(err?.message || 'تعذر رفع الصورة', true);
    } finally {
      setUploadingPosterImage(false);
    }
  };

  const handleMobilePosterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingMobilePosterImage(true);
      const url = await storageService.uploadProductImage('hero_mobile_poster', file);
      setBannerForm((prev) => ({
        ...prev,
        mobilePosterImageUrl: url,
        mobileImageUrl: prev.mobileImageUrl || url
      }));
      showNotification('تم رفع صورة البوستر للموبايل بنجاح.');
    } catch (err: any) {
      showNotification(err?.message || 'تعذر رفع الصورة', true);
    } finally {
      setUploadingMobilePosterImage(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.title.trim()) {
      showNotification('يرجى إدخال عنوان أو اسم الإعلان', true);
      return;
    }

    const isVideo = bannerForm.mediaType === 'video';
    let resolvedVideoSource: BannerVideoSource = bannerForm.videoSource || 'direct';
    let resolvedYoutubeId = '';
    let resolvedMobileYoutubeId = '';

    if (isVideo) {
      const cleanInput = (bannerForm.videoUrl || '').trim();
      if (!cleanInput) {
        showNotification('يرجى إدخال رابط فيديو صالح للإعلان.', true);
        return;
      }

      const detectedYouTubeId = extractYouTubeVideoId(cleanInput);
      const isYouTubeInput = resolvedVideoSource === 'youtube' || Boolean(detectedYouTubeId);

      if (isYouTubeInput) {
        resolvedVideoSource = 'youtube';
        if (!detectedYouTubeId) {
          showNotification(
            'يرجى إدخال رابط فيديو YouTube صحيح (يدعم: https://www.youtube.com/watch?v=... أو https://youtu.be/... أو https://www.youtube.com/shorts/...)',
            true
          );
          return;
        }
        resolvedYoutubeId = detectedYouTubeId;

        if (bannerForm.mobileVideoUrl && bannerForm.mobileVideoUrl.trim()) {
          const detectedMobileId = extractYouTubeVideoId(bannerForm.mobileVideoUrl.trim());
          if (detectedMobileId) {
            resolvedMobileYoutubeId = detectedMobileId;
          }
        }
      } else {
        resolvedVideoSource = 'direct';
        if (!cleanInput.startsWith('https://')) {
          showNotification('رابط الفيديو يجب أن يكون رابطاً آمناً يبدأ بـ https://', true);
          return;
        }
        if (
          cleanInput.includes('vimeo.com/') ||
          cleanInput.includes('tiktok.com/')
        ) {
          showNotification(
            'يرجى إدخال رابط فيديو مباشر ينتهي بصيغة MP4 أو WebM عبر HTTPS (مثل: https://example.com/banner-video.mp4)، أو اختر مصدر YouTube.',
            true
          );
          return;
        }

        if (bannerForm.mobileVideoUrl && bannerForm.mobileVideoUrl.trim()) {
          const cleanMobile = bannerForm.mobileVideoUrl.trim();
          if (!cleanMobile.startsWith('https://')) {
            showNotification('رابط فيديو الموبايل يجب أن يبدأ بـ https://', true);
            return;
          }
        }

        const posterImg = bannerForm.posterImageUrl || bannerForm.desktopImageUrl;
        if (!posterImg) {
          showNotification('يرجى إضافة صورة احتياطية (Poster) للفيديو لضمان ظهور البنر على جميع الأجهزة وعند بطء الاتصال.', true);
          return;
        }
      }
    } else {
      if (!bannerForm.desktopImageUrl && !bannerForm.productImageUrl && !bannerForm.mobileImageUrl) {
        showNotification('يرجى رفع أو إدخال رابط صورة الإعلان على الأقل لسطح المكتب', true);
        return;
      }
    }

    // Synchronize legacy fields for backward compatibility
    let syncProductId = bannerForm.productId || '';
    let syncProductSlug = bannerForm.productSlug || '';
    let syncCategoryIds = [...(bannerForm.categoryIds || [])];
    let syncCtaLink = bannerForm.ctaLink || '';
    let syncCtaType = bannerForm.ctaType || 'whatsapp';

    if (bannerForm.targetType === 'product') {
      const prodId = bannerForm.targetValue || bannerForm.productId;
      const found = products.find((p) => p.id === prodId || p.slug === prodId);
      syncProductId = found?.id || prodId;
      syncProductSlug = found?.slug || '';
      syncCtaType = 'product_page';
    } else if (bannerForm.targetType === 'category') {
      const catId = bannerForm.targetValue || (bannerForm.categoryIds && bannerForm.categoryIds[0]) || '';
      syncCategoryIds = catId ? [catId] : [];
    } else if (bannerForm.targetType === 'page' || bannerForm.targetType === 'offer' || bannerForm.targetType === 'external') {
      syncCtaLink = bannerForm.targetValue || '';
      syncCtaType = 'custom_link';
    }

    const chosenPlacements = bannerForm.placements.length > 0 ? bannerForm.placements : ['home_hero'];

    const cleanVideoUrl = isVideo ? (bannerForm.videoUrl?.trim() || '') : '';
    const cleanMobileVideoUrl = isVideo ? (bannerForm.mobileVideoUrl?.trim() || '') : '';

    let resolvedPoster = isVideo
      ? (bannerForm.posterImageUrl?.trim() || bannerForm.desktopImageUrl?.trim() || '')
      : (bannerForm.posterImageUrl?.trim() || '');

    // For YouTube, if no poster was manually set, auto-fallback to high-res YouTube thumbnail
    if (isVideo && resolvedVideoSource === 'youtube' && !resolvedPoster && resolvedYoutubeId) {
      resolvedPoster = getYouTubeThumbnailUrl(resolvedYoutubeId, 'maxresdefault');
    }

    const resolvedMobilePoster = isVideo
      ? (bannerForm.mobilePosterImageUrl?.trim() || bannerForm.mobileImageUrl?.trim() || resolvedPoster)
      : (bannerForm.mobilePosterImageUrl?.trim() || '');

    const resolvedDesktopImg = isVideo
      ? (bannerForm.desktopImageUrl?.trim() || resolvedPoster)
      : bannerForm.desktopImageUrl?.trim() || '';
    const resolvedMobileImg = isVideo
      ? (bannerForm.mobileImageUrl?.trim() || resolvedMobilePoster || resolvedDesktopImg)
      : bannerForm.mobileImageUrl?.trim() || '';

    const payload: Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'> = {
      ...bannerForm,
      mediaType: isVideo ? 'video' : 'image',
      videoSource: isVideo ? resolvedVideoSource : undefined,
      videoUrl: cleanVideoUrl,
      youtubeVideoId: isVideo && resolvedVideoSource === 'youtube' ? resolvedYoutubeId : undefined,
      mobileVideoUrl: cleanMobileVideoUrl,
      mobileYoutubeVideoId: isVideo && resolvedVideoSource === 'youtube' && resolvedMobileYoutubeId ? resolvedMobileYoutubeId : undefined,
      posterImageUrl: resolvedPoster,
      mobilePosterImageUrl: resolvedMobilePoster,
      desktopImageUrl: resolvedDesktopImg,
      mobileImageUrl: resolvedMobileImg,
      productId: syncProductId,
      productSlug: syncProductSlug,
      categoryIds: syncCategoryIds,
      ctaLink: syncCtaLink,
      ctaType: syncCtaType,
      targetId: bannerForm.targetValue,
      targetUrl: bannerForm.targetValue,
      campaignPrice: Number(bannerForm.campaignPrice) || 0,
      campaignStartDate: bannerForm.startDate || bannerForm.campaignStartDate || '',
      campaignEndDate: bannerForm.endDate || bannerForm.campaignEndDate || '',
      placements: chosenPlacements,
      specificCategoryId: bannerForm.specificCategoryId || '',
      specificProductId: bannerForm.specificProductId || '',
      showOnHome: chosenPlacements.includes('home_hero'),
      showOnCatalog: chosenPlacements.includes('catalog_page')
    };

    try {
      if (editingBannerId) {
        await homepageService.updateBanner(editingBannerId, payload);
        showNotification('تم تحديث الإعلان بنجاح.');
      } else {
        await homepageService.createBanner(payload);
        showNotification('تم إضافة الإعلان الجديد بنجاح.');
      }
      setBannerModalOpen(false);
      setEditingBannerId(null);
      const updated = await homepageService.getAllBanners();
      setBanners(updated);
    } catch (err: any) {
      showNotification(err?.message || 'تعذر حفظ الإعلان', true);
    }
  };

  const confirmDeleteHomeItem = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      setDeleteLoading(true);
      if (type === 'banner') {
        await homepageService.deleteBanner(id);
        showNotification('تم حذف الإعلان بنجاح.');
        setBanners((prev) => prev.filter((b) => b.id !== id));
      } else if (type === 'news') {
        await homepageService.deleteNews(id);
        showNotification('تم حذف الخبر بنجاح.');
        setNewsList((prev) => prev.filter((n) => n.id !== id));
      } else if (type === 'offer') {
        await homepageService.deleteOffer(id);
        showNotification('تم حذف العرض بنجاح.');
        setOffers((prev) => prev.filter((o) => o.id !== id));
      } else if (type === 'comingSoon') {
        await homepageService.deleteComingSoonItem(id);
        showNotification('تم حذف المنتج القادم بنجاح.');
        setComingSoon((prev) => prev.filter((c) => c.id !== id));
      }
      setDeleteTarget(null);
    } catch (err: any) {
      showNotification(err?.message || 'تعذر إتمام عملية الحذف', true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openNewBanner = () => {
    setEditingBannerId(null);
    setBannerForm({
      title: '',
      mediaType: 'image' as BannerMediaType,
      videoSource: 'direct' as BannerVideoSource,
      videoUrl: '',
      youtubeVideoId: '',
      mobileVideoUrl: '',
      mobileYoutubeVideoId: '',
      posterImageUrl: '',
      mobilePosterImageUrl: '',
      targetType: 'product' as HeroTargetType,
      targetValue: products[0]?.id || '',
      displayDuration: 5,
      subtitle: '',
      badgeText: 'عرض حصري',
      badgeType: 'gold',
      desktopImageUrl: '',
      mobileImageUrl: '',
      productImageUrl: '',
      imageSizeMode: 'contain',
      productId: products[0]?.id || '',
      productSlug: products[0]?.slug || '',
      campaignPrice: 0,
      campaignStartDate: '',
      campaignEndDate: '',
      placements: ['home_hero'],
      specificCategoryId: '',
      specificProductId: '',
      price: 0,
      oldPrice: 0,
      discountPercent: 0,
      ctaText: 'اسأل عن المنتج',
      ctaType: 'whatsapp',
      ctaLink: '',
      isActive: true,
      sortOrder: banners.length + 1,
      startDate: '',
      endDate: '',
      showOnHome: true,
      showOnCatalog: false,
      categoryIds: []
    });
    setAdminVideoPreviewFailed(false);
    setBannerPreviewMode('desktop');
    setShowAdvancedBannerFields(false);
    setBannerModalOpen(true);
  };

  const openEditBanner = (b: HeroBanner) => {
    setEditingBannerId(b.id);

    // Resolve targetType and targetValue with backwards compatibility
    let resolvedTargetType: HeroTargetType = b.targetType || 'product';
    let resolvedTargetValue: string = b.targetValue || '';

    if (!b.targetType) {
      if (b.productId) {
        resolvedTargetType = 'product';
        resolvedTargetValue = b.productId;
      } else if (b.ctaType === 'product_page' && b.productId) {
        resolvedTargetType = 'product';
        resolvedTargetValue = b.productId;
      } else if (b.ctaType === 'custom_link' && b.ctaLink) {
        if (b.ctaLink.startsWith('http')) {
          resolvedTargetType = 'external';
          resolvedTargetValue = b.ctaLink;
        } else {
          resolvedTargetType = 'page';
          resolvedTargetValue = b.ctaLink;
        }
      } else if (Array.isArray(b.categoryIds) && b.categoryIds.length > 0) {
        resolvedTargetType = 'category';
        resolvedTargetValue = b.categoryIds[0];
      }
    }

    let resolvedPlacements: (BannerPlacement | string)[] = [];
    if (Array.isArray(b.placements) && b.placements.length > 0) {
      resolvedPlacements = [...b.placements];
    } else {
      if (b.showOnHome !== false) resolvedPlacements.push('home_hero');
      if (b.showOnCatalog === true) resolvedPlacements.push('catalog_page');
    }
    if (resolvedPlacements.length === 0) {
      resolvedPlacements = ['home_hero'];
    }

    const detectedIsYouTube =
      b.videoSource === 'youtube' ||
      Boolean(b.youtubeVideoId) ||
      isYouTubeUrl(b.videoUrl || '');

    const resolvedVideoSource: BannerVideoSource = detectedIsYouTube ? 'youtube' : (b.videoSource || 'direct');
    const resolvedYoutubeId = b.youtubeVideoId || extractYouTubeVideoId(b.videoUrl || '') || '';
    const resolvedMobileYoutubeId = b.mobileYoutubeVideoId || extractYouTubeVideoId(b.mobileVideoUrl || '') || '';

    setBannerForm({
      title: b.title || '',
      mediaType: (b.mediaType || 'image') as BannerMediaType,
      videoSource: resolvedVideoSource,
      videoUrl: b.videoUrl || '',
      youtubeVideoId: resolvedYoutubeId,
      mobileVideoUrl: b.mobileVideoUrl || '',
      mobileYoutubeVideoId: resolvedMobileYoutubeId,
      posterImageUrl: b.posterImageUrl || b.desktopImageUrl || '',
      mobilePosterImageUrl: b.mobilePosterImageUrl || b.mobileImageUrl || '',
      targetType: resolvedTargetType,
      targetValue: resolvedTargetValue,
      displayDuration: b.displayDuration || 5,
      subtitle: b.subtitle || '',
      badgeText: b.badgeText || 'عرض حصري',
      badgeType: b.badgeType || 'gold',
      desktopImageUrl: b.desktopImageUrl || '',
      mobileImageUrl: b.mobileImageUrl || '',
      productImageUrl: b.productImageUrl || '',
      imageSizeMode: b.imageSizeMode || 'contain',
      productId: b.productId || (resolvedTargetType === 'product' ? resolvedTargetValue : ''),
      productSlug: b.productSlug || '',
      campaignPrice: b.campaignPrice || 0,
      campaignStartDate: b.campaignStartDate || b.startDate || '',
      campaignEndDate: b.campaignEndDate || b.endDate || '',
      placements: resolvedPlacements,
      specificCategoryId: b.specificCategoryId || '',
      specificProductId: b.specificProductId || '',
      price: b.price || 0,
      oldPrice: b.oldPrice || 0,
      discountPercent: b.discountPercent || 0,
      ctaText: b.ctaText || 'اسأل عن المنتج',
      ctaType: b.ctaType || 'whatsapp',
      ctaLink: b.ctaLink || '',
      isActive: b.isActive !== false,
      sortOrder: b.sortOrder || 1,
      startDate: b.startDate || b.campaignStartDate || '',
      endDate: b.endDate || b.campaignEndDate || '',
      showOnHome: resolvedPlacements.includes('home_hero'),
      showOnCatalog: resolvedPlacements.includes('catalog_page'),
      categoryIds: Array.isArray(b.categoryIds) ? b.categoryIds : []
    });
    setAdminVideoPreviewFailed(false);
    setBannerPreviewMode('desktop');
    setShowAdvancedBannerFields(false);
    setBannerModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // News Ticker Logic
  // --------------------------------------------------------------------------
  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsForm.text.trim()) {
      showNotification('يرجى إدخال نص الخبر أو الإعلان', true);
      return;
    }

    try {
      if (editingNewsId) {
        await homepageService.updateNews(editingNewsId, newsForm);
        showNotification('تم تحديث الخبر بنجاح.');
      } else {
        await homepageService.createNews(newsForm);
        showNotification('تم إضافة الخبر الجديد بنجاح.');
      }
      setNewsModalOpen(false);
      setEditingNewsId(null);
      const updated = await homepageService.getAllNews();
      setNewsList(updated);
    } catch (err: any) {
      showNotification(err?.message || 'تعذر حفظ الخبر', true);
    }
  };

  const handleDeleteNews = (id: string, text: string) => {
    setDeleteTarget({
      type: 'news',
      id,
      itemName: text
    });
  };

  const openEditNews = (n: NewsTickerItem) => {
    setEditingNewsId(n.id);
    setNewsForm({
      text: n.text,
      type: n.type,
      icon: n.icon || '',
      link: n.link || '',
      isActive: n.isActive,
      sortOrder: n.sortOrder || 1,
      startDate: n.startDate || '',
      endDate: n.endDate || ''
    });
    setNewsModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Offers Logic
  // --------------------------------------------------------------------------
  const handleProductSelectForOffer = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const original = prod.price || 0;
    const initialOffer = Math.round(original * 0.85);
    const discount = original > 0 ? Math.round(((original - initialOffer) / original) * 100) : 0;

    setOfferForm((prev) => ({
      ...prev,
      productId: prod.id,
      productName: prod.name,
      productSlug: prod.slug,
      productImage: prod.mainImageUrl || '',
      productDescription: prod.description || '',
      originalPrice: original,
      offerPrice: initialOffer,
      discountPercent: discount
    }));
  };

  const handleOfferPriceChange = (newPrice: number) => {
    const orig = offerForm.originalPrice;
    const discount = orig > 0 && orig > newPrice ? Math.round(((orig - newPrice) / orig) * 100) : 0;
    setOfferForm((prev) => ({
      ...prev,
      offerPrice: newPrice,
      discountPercent: discount
    }));
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.productId || !offerForm.productName) {
      showNotification('يرجى اختيار منتج للعرض', true);
      return;
    }
    if (offerForm.offerPrice <= 0) {
      showNotification('يرجى إدخال سعر العرض بشكل صحيح', true);
      return;
    }

    try {
      if (editingOfferId) {
        await homepageService.updateOffer(editingOfferId, offerForm);
        showNotification('تم تحديث العرض بنجاح.');
      } else {
        await homepageService.createOffer(offerForm);
        showNotification('تم إضافة العرض الجديد بنجاح.');
      }
      setOfferModalOpen(false);
      setEditingOfferId(null);
      const updated = await homepageService.getAllOffers();
      setOffers(updated);
    } catch (err: any) {
      showNotification(err?.message || 'تعذر حفظ العرض', true);
    }
  };

  const handleDeleteOffer = (id: string, title: string) => {
    setDeleteTarget({
      type: 'offer',
      id,
      itemName: title
    });
  };

  const openEditOffer = (offer: LimitedOffer) => {
    setEditingOfferId(offer.id);
    setOfferForm({
      productId: offer.productId,
      productName: offer.productName,
      productSlug: offer.productSlug || '',
      productImage: offer.productImage || '',
      productDescription: offer.productDescription || '',
      originalPrice: offer.originalPrice,
      offerPrice: offer.offerPrice,
      discountPercent: offer.discountPercent,
      startDate: offer.startDate,
      startTime: offer.startTime || '00:00',
      endDate: offer.endDate,
      endTime: offer.endTime || '23:59',
      isActive: offer.isActive
    });
    setOfferModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Coming Soon Logic
  // --------------------------------------------------------------------------
  const handleSaveComingSoon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comingSoonForm.name.trim()) {
      showNotification('يرجى إدخال اسم المنتج القادم', true);
      return;
    }

    try {
      if (editingComingSoonId) {
        await homepageService.updateComingSoonItem(editingComingSoonId, comingSoonForm);
        showNotification('تم تحديث المنتج القادم بنجاح.');
      } else {
        await homepageService.createComingSoonItem(comingSoonForm);
        showNotification('تم إضافة المنتج القادم بنجاح.');
      }
      setComingSoonModalOpen(false);
      setEditingComingSoonId(null);
      const updated = await homepageService.getAllComingSoon();
      setComingSoon(updated);
    } catch (err: any) {
      showNotification(err?.message || 'تعذر حفظ المنتج القادم', true);
    }
  };

  const handleDeleteBanner = (id: string, title: string) => {
    setDeleteTarget({
      type: 'banner',
      id,
      itemName: title
    });
  };

  const handleDeleteComingSoon = (id: string, name: string) => {
    setDeleteTarget({
      type: 'comingSoon',
      id,
      itemName: name
    });
  };

  const openEditComingSoon = (item: ComingSoonItem) => {
    setEditingComingSoonId(item.id);
    setComingSoonForm({
      name: item.name,
      image: item.image,
      shortDescription: item.shortDescription || '',
      expectedDate: item.expectedDate || '',
      isActive: item.isActive,
      sortOrder: item.sortOrder || 1
    });
    setComingSoonModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="h-14 bg-[#101B2B] rounded-2xl animate-pulse"></div>
        <LoadingSkeleton type="table" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              إدارة الصفحة الرئيسية
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              التحكم الكامل في سلايدر الإعلانات، شريط الأخبار، العروض، والأقسام
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[#D4AF37] border border-[var(--border)] hover:border-[#D4AF37]/30 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة الصفحة الرئيسية</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)] shadow-sm overflow-x-auto custom-scrollbar no-scrollbar">
        {[
          { id: 'banners', icon: Sparkles, label: 'إعلانات الـ Hero', count: banners.length },
          { id: 'news', icon: Bell, label: 'شريط الأخبار', count: newsList.length },
          { id: 'sections', icon: Sliders, label: 'ترتيب الأقسام' },
          { id: 'offers', icon: Flame, label: 'عروض محدودة', count: offers.length },
          { id: 'comingSoon', icon: Clock, label: 'قادم قريبًا', count: comingSoon.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap min-w-max flex-1 justify-center ${
                isActive
                  ? 'bg-[#D4AF37] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#D4AF37]'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Hero Banners */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'banners' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">إعلانات البنر الترويجية (Hero)</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                إعلانات مصورة احترافية في واجهة المتجر توجّه الزوار للمنتجات والأقسام والعروض
              </p>
            </div>

            <button
              onClick={openNewBanner}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة إعلان بنر جديد</span>
            </button>
          </div>

          {banners.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-8 h-8 text-[#D4AF37] opacity-50" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">لا توجد إعلانات بنر مضافة حالياً</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">أضف إعلانات ترويجية مصورة للواجهة لجذب الزوار وتوجيههم لمنتجاتك وعروضك</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {banners.map((banner) => {
                // Find linked target name
                let targetLabel = 'غير محدد';
                const targetType = banner.targetType || (banner.productId ? 'product' : banner.ctaType === 'custom_link' ? 'page' : 'product');
                if (targetType === 'product') {
                  const prod = products.find((p) => p.id === (banner.targetValue || banner.productId) || p.slug === (banner.targetValue || banner.productId));
                  targetLabel = prod ? `منتج: ${prod.name}` : `منتج (#${banner.targetValue || banner.productId || ''})`;
                } else if (targetType === 'category') {
                  const catId = banner.targetValue || (banner.categoryIds && banner.categoryIds[0]);
                  const cat = categories.find((c) => c.id === catId);
                  targetLabel = cat ? `قسم: ${cat.name}` : `قسم (#${catId || ''})`;
                } else if (targetType === 'offer') {
                  targetLabel = 'صفحة العروض والتخفيضات (/offers)';
                } else if (targetType === 'page') {
                  targetLabel = `صفحة داخلية: ${banner.targetValue || banner.ctaLink || '/'}`;
                } else if (targetType === 'external') {
                  targetLabel = `رابط خارجي: ${banner.targetValue || banner.ctaLink || ''}`;
                }

                const heroImg = banner.desktopImageUrl || banner.mobileImageUrl || banner.productImageUrl || banner.backgroundImageUrl;

                return (
                  <div
                    key={banner.id}
                    className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {banner.isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                              نشط
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border)] text-[10px] font-bold">
                              معطل
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            الترتيب: {banner.sortOrder || 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                          {banner.mediaType === 'video' ? (
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                              <Video className="w-3.5 h-3.5" />
                              فيديو
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[#D4AF37] font-bold">
                              <ImageIcon className="w-3.5 h-3.5" />
                              صورة
                            </span>
                          )}
                          <span className="text-[var(--text-muted)] opacity-30">|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {banner.displayDuration || 5} ثوانٍ
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] shrink-0 shadow-inner group-hover:border-[#D4AF37]/30 transition-colors">
                          {heroImg ? (
                            <img src={getValidImageSrc(heroImg)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-[var(--text-muted)] opacity-20" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[#D4AF37] transition-colors">
                            {banner.title}
                          </h4>
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                            {banner.subtitle || 'لا يوجد وصف فرعي'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-1">
                            <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            <span className="truncate max-w-[150px]">{targetLabel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                         <div className="p-2 bg-[var(--surface-elevated)]/50 rounded-xl border border-[var(--border)] text-center">
                            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">البادج (Badge)</p>
                            <p className="text-[11px] font-bold text-[var(--text-primary)]">{banner.badgeText || '—'}</p>
                         </div>
                         <div className="p-2 bg-[var(--surface-elevated)]/50 rounded-xl border border-[var(--border)] text-center">
                            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">النص (CTA)</p>
                            <p className="text-[11px] font-bold text-[var(--text-primary)]">{banner.ctaText || '—'}</p>
                         </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                       <div className="flex flex-wrap gap-1">
                         {banner.placements?.map(p => (
                            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-muted)]">
                               {BANNER_PLACEMENT_OPTIONS.find(opt => opt.id === p)?.label.split(' — ')[0] || p}
                            </span>
                         ))}
                       </div>

                       <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditBanner(banner)}
                          className="p-2 text-[var(--text-secondary)] hover:text-[#D4AF37] bg-[var(--surface-elevated)] hover:bg-[var(--surface)] rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-sm active:scale-90"
                          title="تعديل الإعلان"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner.id, banner.title)}
                          className="p-2 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-xl border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer shadow-sm active:scale-90"
                          title="حذف الإعلان"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ------------------------------------------------------------- */}
      {/* TAB 2: News Ticker */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'news' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">شريط الأخبار والإعلانات النصية</h2>
              <p className="text-xs text-[var(--text-secondary)]">أخبار سريعة تظهر في شريط متحرك في أعلى المتجر</p>
            </div>

            <button
              onClick={() => {
                setEditingNewsId(null);
                setNewsForm({
                  text: '',
                  type: 'news',
                  icon: '',
                  link: '',
                  isActive: true,
                  sortOrder: newsList.length + 1,
                  startDate: '',
                  endDate: ''
                });
                setNewsModalOpen(true);
              }}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة خبر جديد</span>
            </button>
          </div>

          {/* Quick Ticker Settings Panel */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-primary)] block">سرعة الحركة (ثواني)</label>
              <input
                type="number"
                min="2"
                max="20"
                value={settings.newsTickerSpeed || 5}
                onChange={(e) => setSettings((prev) => ({ ...prev, newsTickerSpeed: Math.max(2, Number(e.target.value)) }))}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl p-2.5 outline-none focus:border-[#D4AF37] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-primary)] block">مظهر الخلفية</label>
              <select
                value={settings.newsTickerBgStyle || 'dark'}
                onChange={(e) => setSettings((prev) => ({ ...prev, newsTickerBgStyle: e.target.value as any }))}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl p-2.5 outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
              >
                <option value="dark">داكن كلاسيكي (Luxury Dark)</option>
                <option value="gold">ذهبي فاخر (Gold Gradient)</option>
                <option value="emerald">زمردي جذاب (Emerald Gradient)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[#D4AF37] font-bold text-xs rounded-xl border border-[var(--border)] hover:border-[#D4AF37]/40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>حفظ إعدادات الشريط</span>
              </button>
            </div>
          </div>

          {newsList.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Bell className="w-8 h-8 text-[#D4AF37] opacity-50" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">لا توجد أخبار مضافة حالياً</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">أضف تنبيهات أو أخبار سريعة تظهر للزوار بشكل مستمر</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {newsList.map((item) => (
                <div
                  key={item.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-white transition-all shadow-inner">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                         {item.isActive ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">نشط</span>
                         ) : (
                            <span className="text-[10px] text-[var(--text-muted)] font-bold">معطل</span>
                         )}
                         <span className="text-[10px] text-[var(--text-muted)]">•</span>
                         <span className="text-[10px] text-[var(--text-muted)]">ترتيب: {item.sortOrder || 1}</span>
                      </div>
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{item.text}</p>
                      {item.link && (
                        <span className="text-[10px] text-[#D4AF37] flex items-center gap-1 mt-1 truncate">
                          <ExternalLink className="w-3 h-3" />
                          {item.link}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEditNews(item)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[#D4AF37] bg-[var(--surface-elevated)] hover:bg-[var(--surface)] rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-sm active:scale-90"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNews(item.id, item.text)}
                      className="p-2 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-xl border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer shadow-sm active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: Sections Settings */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sections' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">ترتيب وتفعيل أقسام الصفحة الرئيسية</h2>
                <p className="text-xs text-[var(--text-secondary)]">تحكم في ظهور وترتيب الأقسام الرئيسية في واجهة المتجر</p>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                {savingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ الترتيب والإعدادات</span>
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'showHeroSlider', label: 'سلايدر الإعلانات الرئيسي (Hero Slider)', icon: Sparkles },
                { key: 'showNewsTicker', label: 'شريط الأخبار المتحرك (News Ticker)', icon: Bell },
                { key: 'showFeaturedCategories', label: 'الأقسام المميزة (Featured Categories)', icon: Layers },
                { key: 'showOffersSection', label: 'قسم العروض لفترة محدودة (Flash Sales)', icon: Flame },
                { key: 'showFeaturedProducts', label: 'المنتجات المميزة والجديدة (Featured Products)', icon: ShoppingBag },
                { key: 'showBannersSection', label: 'قسم البنرات الترويجية الثانوية (Promo Banners)', icon: ImageIcon },
                { key: 'showComingSoonSection', label: 'قسم قادم قريباً (Coming Soon)', icon: Clock }
              ].map((section) => (
                <div
                  key={section.key}
                  className="p-4 bg-[var(--surface-elevated)]/50 border border-[var(--border)] rounded-2xl flex items-center justify-between gap-4 hover:border-[#D4AF37]/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform shadow-sm">
                      <section.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{section.label}</span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(settings as any)[section.key]}
                      onChange={(e) => setSettings({ ...settings, [section.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--surface-elevated)] border border-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37] peer-checked:border-[#D4AF37]"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: Limited Offers */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'offers' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">عروض لفترة محدودة (Flash Sales)</h2>
              <p className="text-xs text-[var(--text-secondary)]">منتجات بأسعار مخفضة جداً مع عد تنازلي لجذب الزوار</p>
            </div>

            <button
              onClick={() => {
                setEditingOfferId(null);
                setOfferForm({
                  productId: products[0]?.id || '',
                  productName: products[0]?.name || '',
                  productSlug: products[0]?.slug || '',
                  productImage: products[0]?.mainImageUrl || '',
                  productDescription: products[0]?.description || '',
                  originalPrice: products[0]?.price || 0,
                  offerPrice: Math.round((products[0]?.price || 0) * 0.8),
                  discountPercent: 20,
                  startDate: new Date().toISOString().split('T')[0],
                  startTime: '00:00',
                  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  endTime: '23:59',
                  isActive: true
                });
                setOfferModalOpen(true);
              }}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عرض جديد</span>
            </button>
          </div>

          {offers.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Flame className="w-8 h-8 text-[#D4AF37] opacity-50" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">لا توجد عروض مضافة حالياً</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">أضف عروض تخفيض قوية بأسعار خاصة لفترة محددة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {offers.map((offer) => {
                let statusBadge = null;
                if (!offer.isActive) {
                  statusBadge = <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--border)] text-[10px] font-bold">معطل</span>;
                } else {
                  const now = new Date();
                  const start = new Date(`${offer.startDate}T${offer.startTime || '00:00'}`);
                  const end = new Date(`${offer.endDate}T${offer.endTime || '23:59'}`);

                  if (now < start) {
                    statusBadge = <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">مجدول</span>;
                  } else if (now >= start && now <= end) {
                    statusBadge = <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold animate-pulse">نشط الآن</span>;
                  } else {
                    statusBadge = <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">منتهي</span>;
                  }
                }

                return (
                  <div
                    key={offer.id}
                    className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        {statusBadge}
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          خصم {offer.discountPercent}%
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] shrink-0 shadow-inner group-hover:border-[#D4AF37]/30 transition-colors">
                          <img
                            src={getValidImageSrc(offer.productImage || '/logo.svg')}
                            alt={offer.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[#D4AF37] transition-colors">
                            {offer.productName}
                          </h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-base font-black text-[#D4AF37]">
                              {offer.offerPrice.toLocaleString('ar-EG')} ج.م
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] line-through">
                              {offer.originalPrice.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-[var(--surface-elevated)]/50 rounded-xl border border-[var(--border)] text-[10px] text-[var(--text-secondary)] space-y-1.5 shadow-inner">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#D4AF37]" /> البداية:</span>
                          <span className="font-mono text-[var(--text-primary)] font-bold">
                            {offer.startDate} ({offer.startTime || '00:00'})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-rose-500" /> النهاية:</span>
                          <span className="font-mono text-[var(--text-primary)] font-bold">
                            {offer.endDate} ({offer.endTime || '23:59'})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-[var(--border)] flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditOffer(offer)}
                        className="p-2 text-[var(--text-secondary)] hover:text-[#D4AF37] bg-[var(--surface-elevated)] hover:bg-[var(--surface)] rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-sm active:scale-90"
                        title="تعديل العرض"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer.id, offer.productName)}
                        className="p-2 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-xl border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer shadow-sm active:scale-90"
                        title="حذف العرض"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: Coming Soon */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'comingSoon' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">منتجات قادم قريبًا</h2>
              <p className="text-xs text-[var(--text-secondary)]">عرض تشويقي للمنتجات المتوقع وصولها قريبًا</p>
            </div>

            <button
              onClick={() => {
                setEditingComingSoonId(null);
                setComingSoonForm({
                  name: '',
                  image: '',
                  shortDescription: '',
                  expectedDate: '',
                  isActive: true,
                  sortOrder: comingSoon.length + 1
                });
                setComingSoonModalOpen(true);
              }}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج قادم</span>
            </button>
          </div>

          {comingSoon.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-8 h-8 text-[#D4AF37] opacity-50" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">لا توجد عناصر قادمة مضافة حالياً</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">أضف منتجات تشويقية مع تواريخ متوقعة لشد انتباه العملاء</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {comingSoon.map((item) => (
                <div
                  key={item.id}
                  className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] shadow-inner group-hover:border-[#D4AF37]/30 transition-colors">
                      <img
                        src={getValidImageSrc(item.image || '/logo.svg')}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[#D4AF37] transition-colors">{item.name}</h4>
                        {item.isActive ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                            نشط
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-full border border-[var(--border)] font-bold">
                            معطل
                          </span>
                        )}
                      </div>

                      {item.expectedDate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-bold bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>الموعد المتوقع: {item.expectedDate}</span>
                        </div>
                      )}

                      {item.shortDescription && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {item.shortDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-[var(--border)] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditComingSoon(item)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[#D4AF37] bg-[var(--surface-elevated)] hover:bg-[var(--surface)] rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-sm active:scale-90"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteComingSoon(item.id, item.name)}
                      className="p-2 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded-xl border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer shadow-sm active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: Coming Soon */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'comingSoon' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#F5F5F3]">منتجات قادم قريبًا</h2>
              <p className="text-xs text-[#AAB4C3]">عرض تشويقي للمنتجات المتوقع وصولها قريبًا</p>
            </div>

            <button
              onClick={() => {
                setEditingComingSoonId(null);
                setComingSoonForm({
                  name: '',
                  image: '',
                  shortDescription: '',
                  expectedDate: '',
                  isActive: true,
                  sortOrder: comingSoon.length + 1
                });
                setComingSoonModalOpen(true);
              }}
              className="px-4 py-2.5 bg-[#D6A83A] hover:bg-[#E0B64B] text-[#070D16] font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج قادم</span>
            </button>
          </div>

          {comingSoon.length === 0 ? (
            <div className="bg-[#101B2B] border border-[#1a2d47] rounded-2xl p-12 text-center space-y-3">
              <Clock className="w-10 h-10 text-sky-400 mx-auto opacity-50" />
              <h3 className="text-sm font-bold text-[#F5F5F3]">لا توجد عناصر قادمة مضافة حالياً</h3>
              <p className="text-xs text-[#AAB4C3]">أضف منتجات تشويقية مع تواريخ متوقعة لشد انتباه العملاء</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoon.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#101B2B] border border-[#1a2d47] rounded-2xl p-5 space-y-3 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#070D16] border border-[#132235]">
                      <img
                        src={getValidImageSrc(item.image || '/logo.svg')}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-[#F5F5F3]">{item.name}</span>
                        {item.isActive ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded font-bold">
                            نشط
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-bold">
                            معطل
                          </span>
                        )}
                      </div>

                      {item.expectedDate && (
                        <span className="text-[11px] text-sky-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>الموعد: {item.expectedDate}</span>
                        </span>
                      )}

                      {item.shortDescription && (
                        <p className="text-xs text-[#AAB4C3] mt-2 line-clamp-2 leading-relaxed">
                          {item.shortDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#132235] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditComingSoon(item)}
                      className="p-2 text-[#AAB4C3] hover:text-[#D6A83A] bg-[#070D16] hover:bg-[#132235] rounded-xl border border-[#132235] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteComingSoon(item.id, item.name)}
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 rounded-xl border border-rose-900/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Banner Form */}
      {/* ------------------------------------------------------------- */}
      {bannerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-[var(--surface-elevated)]/50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                  <span>{editingBannerId ? 'تعديل بنر الإعلان الترويجي' : 'إضافة بنر إعلان جديد'}</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  قم بضبط الوسائط المرئية ووجهة النقر للإعلان
                </p>
              </div>
              <button
                onClick={() => setBannerModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-rose-500 p-2 rounded-xl hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              {/* 1. Live Banner Preview */}
              <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      معاينة الإعلان المباشرة
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setBannerPreviewMode('desktop')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        bannerPreviewMode === 'desktop'
                          ? 'bg-[#D4AF37] text-white shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>سطح المكتب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerPreviewMode('mobile')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        bannerPreviewMode === 'mobile'
                          ? 'bg-[#D4AF37] text-white shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>الموبايل</span>
                    </button>
                  </div>
                </div>

                {/* Preview Stage Box */}
                {(() => {
                  const isVideo = bannerForm.mediaType === 'video';
                  const activeRawVideoUrl = bannerPreviewMode === 'mobile'
                      ? (bannerForm.mobileVideoUrl?.trim() || bannerForm.videoUrl?.trim() || '')
                      : (bannerForm.videoUrl?.trim() || bannerForm.mobileVideoUrl?.trim() || '');

                  const isYouTube = bannerForm.videoSource === 'youtube' || Boolean(bannerForm.youtubeVideoId) || isYouTubeUrl(activeRawVideoUrl);

                  const activeYouTubeId = bannerPreviewMode === 'mobile'
                      ? (bannerForm.mobileYoutubeVideoId || extractYouTubeVideoId(bannerForm.mobileVideoUrl) || bannerForm.youtubeVideoId)
                      : (bannerForm.youtubeVideoId || extractYouTubeVideoId(bannerForm.videoUrl));

                  const ytEmbedUrl = isYouTube && activeYouTubeId
                    ? buildYouTubeEmbedUrl(activeYouTubeId, { autoplay: true, muted: true, loop: true, controls: false, playsinline: true })
                    : '';

                  const previewImg = bannerPreviewMode === 'mobile'
                      ? (bannerForm.mobilePosterImageUrl || bannerForm.mobileImageUrl || bannerForm.desktopImageUrl || bannerForm.productImageUrl)
                      : (bannerForm.posterImageUrl || bannerForm.desktopImageUrl || bannerForm.productImageUrl);

                  return (
                    <div className="relative w-full bg-black/5 dark:bg-black/20 border border-[var(--border)] rounded-xl overflow-hidden aspect-[21/9] flex items-center justify-center shadow-inner">
                      {isVideo && isYouTube && ytEmbedUrl ? (
                        <iframe
                          key={`yt-${bannerPreviewMode}-${activeYouTubeId}`}
                          src={getValidImageSrc(ytEmbedUrl)}
                          className="w-full h-full pointer-events-none"
                          allow="autoplay"
                        />
                      ) : isVideo && !isYouTube && activeRawVideoUrl ? (
                        <video
                          key={`vid-${bannerPreviewMode}-${activeRawVideoUrl}`}
                          src={getValidImageSrc(activeRawVideoUrl)}
                          poster={previewImg || undefined}
                          autoPlay muted loop playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : previewImg ? (
                        <img
                          src={getValidImageSrc(previewImg)}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                          <ImageIcon className="w-8 h-8 opacity-20" />
                          <span className="text-[10px]">بانتظار إضافة الوسائط...</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <form id="bannerFormElement" onSubmit={handleSaveBanner} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">عنوان الإعلان</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="أدخل عنواناً جذاباً..."
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl p-3 outline-none focus:border-[#D4AF37] transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">نوع الوسائط</label>
                    <div className="flex p-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl">
                      <button
                        type="button"
                        onClick={() => setBannerForm(prev => ({ ...prev, mediaType: 'image' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                          bannerForm.mediaType === 'image' || !bannerForm.mediaType
                            ? 'bg-[var(--surface)] text-[#D4AF37] shadow-sm border border-[var(--border)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>صورة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerForm(prev => ({ ...prev, mediaType: 'video' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                          bannerForm.mediaType === 'video'
                            ? 'bg-[var(--surface)] text-[#D4AF37] shadow-sm border border-[var(--border)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Video className="w-4 h-4" />
                        <span>فيديو</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Media Config Groups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-[var(--surface-elevated)]/30 border border-[var(--border)] rounded-2xl">
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[#D4AF37]">
                        <Monitor className="w-4 h-4" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">إعدادات سطح المكتب</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)]">رابط الصورة (Desktop)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={bannerForm.desktopImageUrl}
                              onChange={(e) => setBannerForm(prev => ({ ...prev, desktopImageUrl: e.target.value }))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37]"
                            />
                            <label className="absolute left-2 top-1.5 p-1 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg cursor-pointer transition-colors">
                              <Upload className="w-4 h-4" />
                              <input type="file" accept="image/*" className="hidden" onChange={handleDesktopImageUpload} />
                            </label>
                          </div>
                        </div>
                        {bannerForm.mediaType === 'video' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)]">رابط الفيديو (MP4 / YouTube)</label>
                            <input
                              type="text"
                              value={bannerForm.videoUrl}
                              onChange={(e) => setBannerForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37]"
                              dir="ltr"
                            />
                          </div>
                        )}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[#D4AF37]">
                        <Smartphone className="w-4 h-4" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">إعدادات الموبايل</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)]">رابط الصورة (Mobile)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={bannerForm.mobileImageUrl}
                              onChange={(e) => setBannerForm(prev => ({ ...prev, mobileImageUrl: e.target.value }))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37]"
                            />
                            <label className="absolute left-2 top-1.5 p-1 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg cursor-pointer transition-colors">
                              <Upload className="w-4 h-4" />
                              <input type="file" accept="image/*" className="hidden" onChange={handleMobileImageUpload} />
                            </label>
                          </div>
                        </div>
                        {bannerForm.mediaType === 'video' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)]">رابط الفيديو (Mobile)</label>
                            <input
                              type="text"
                              value={bannerForm.mobileVideoUrl}
                              onChange={(e) => setBannerForm(prev => ({ ...prev, mobileVideoUrl: e.target.value }))}
                              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37]"
                              dir="ltr"
                            />
                          </div>
                        )}
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">وجهة النقر (Target)</label>
                    <select
                      value={bannerForm.targetType}
                      onChange={(e) => setBannerForm(prev => ({ ...prev, targetType: e.target.value as any }))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl p-3 outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                    >
                      <option value="none">لا شيء (صورة فقط)</option>
                      <option value="link">رابط مخصص</option>
                      <option value="product">منتج محدد</option>
                      <option value="category">قسم محدد</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">الحالة والترتيب</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl">
                         <label className="text-xs font-bold text-[var(--text-primary)]">نشط</label>
                         <input
                           type="checkbox"
                           checked={bannerForm.isActive}
                           onChange={(e) => setBannerForm(prev => ({ ...prev, isActive: e.target.checked }))}
                           className="w-4 h-4 accent-[#D4AF37]"
                         />
                      </div>
                      <input
                        type="number"
                        value={bannerForm.sortOrder}
                        onChange={(e) => setBannerForm(prev => ({ ...prev, sortOrder: Number(e.target.value) }))}
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                        placeholder="الترتيب"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Schedule Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-[var(--surface-elevated)]/30 border border-[var(--border)] rounded-2xl">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ البدء</label>
                        <input
                            type="date"
                            value={bannerForm.startDate || ''}
                            onChange={(e) => setBannerForm(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ الانتهاء</label>
                        <input
                            type="date"
                            value={bannerForm.endDate || ''}
                            onChange={(e) => setBannerForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                        />
                    </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[var(--border)] bg-[var(--surface-elevated)]/50 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setBannerModalOpen(false)}
                className="px-6 py-2.5 text-[var(--text-secondary)] font-bold text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] transition-all cursor-pointer active:scale-95"
              >
                إلغاء
              </button>
              <button
                form="bannerFormElement"
                type="submit"
                disabled={savingBanner}
                className="px-8 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                {savingBanner ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{editingBannerId ? 'حفظ التعديلات' : 'إضافة الإعلان'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: News Ticker Form */}
      {/* ------------------------------------------------------------- */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editingNewsId ? 'تعديل الخبر بالشريط' : 'إضافة خبر جديد للشريط'}
              </h3>
              <button
                onClick={() => setNewsModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNews} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">نوع الخبر / التصنيف</label>
                <select
                  value={newsForm.type}
                  onChange={(e) => setNewsForm((prev) => ({ ...prev, type: e.target.value as any }))}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                >
                  <option value="offer">🔥 عرض خاص (Offer)</option>
                  <option value="new_arrival">📱 وصول جديد (New Arrival)</option>
                  <option value="news">🚚 متوفر في الفروع والشحن (Delivery)</option>
                  <option value="news">⭐ آخر الأخبار والتحديثات (News)</option>
                  <option value="alert">⚡ تنبيه هام (Alert)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">نص الخبر أو الإعلان</label>
                <textarea
                  value={newsForm.text}
                  onChange={(e) => setNewsForm((prev) => ({ ...prev, text: e.target.value }))}
                  rows={3}
                  placeholder="مثال: خصم 10% لفترة محدودة على جميع الشواحن والإكسسوارات الأصلية..."
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">رابط عند الضغط (اختياري)</label>
                <input
                  type="text"
                  value={newsForm.link}
                  onChange={(e) => setNewsForm((prev) => ({ ...prev, link: e.target.value }))}
                  placeholder="مثال: /products?category=accessories أو رابط خارجي"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">ترتيب الظهور</label>
                  <input
                    type="number"
                    value={newsForm.sortOrder}
                    onChange={(e) => setNewsForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={newsForm.endDate}
                    onChange={(e) => setNewsForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)]/50 border border-[var(--border)] rounded-xl">
                <input
                  type="checkbox"
                  id="newsActive"
                  checked={newsForm.isActive}
                  onChange={(e) => setNewsForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                />
                <label htmlFor="newsActive" className="text-xs text-[var(--text-primary)] font-bold cursor-pointer">
                  تفعيل ظهور الخبر في الشريط
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewsModalOpen(false)}
                  className="px-6 py-2.5 text-[var(--text-secondary)] font-bold text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white rounded-xl font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  حفظ الخبر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Offer Form */}
      {/* ------------------------------------------------------------- */}
      {offerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editingOfferId ? 'تعديل العرض المحدود' : 'إضافة عرض لفترة محدودة'}
              </h3>
              <button
                onClick={() => setOfferModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOffer} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">اختر المنتج للعرض</label>
                <select
                  value={offerForm.productId}
                  onChange={(e) => handleProductSelectForOffer(e.target.value)}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all cursor-pointer text-sm"
                  required
                >
                  <option value="">-- اختر منتجاً من الكتالوج --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">السعر الأصلي (ج.م)</label>
                  <div className="w-full bg-[var(--surface-elevated)]/50 border border-[var(--border)] text-[var(--text-muted)] p-3 rounded-xl text-sm font-medium">
                    {offerForm.originalPrice}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">سعر العرض (ج.م)</label>
                  <input
                    type="number"
                    value={offerForm.offerPrice}
                    onChange={(e) => handleOfferPriceChange(Number(e.target.value))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[#D4AF37] font-bold p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                    required
                    min="1"
                  />
                </div>
              </div>

              {offerForm.discountPercent > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 font-bold text-center text-xs">
                  نسبة الخصم المحسوبة: {offerForm.discountPercent}%
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ بداية العرض</label>
                  <input
                    type="date"
                    value={offerForm.startDate}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-xs"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">وقت البداية</label>
                  <input
                    type="time"
                    value={offerForm.startTime}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ نهاية العرض</label>
                  <input
                    type="date"
                    value={offerForm.endDate}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-xs"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-primary)]">وقت النهاية</label>
                  <input
                    type="time"
                    value={offerForm.endTime}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)]/50 border border-[var(--border)] rounded-xl">
                <input
                  type="checkbox"
                  id="offerActive"
                  checked={offerForm.isActive}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                />
                <label htmlFor="offerActive" className="text-xs text-[var(--text-primary)] font-bold cursor-pointer">
                  تفعيل العرض فوراً
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(false)}
                  className="px-6 py-2.5 text-[var(--text-secondary)] font-bold text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white rounded-xl font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  حفظ العرض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Coming Soon Form */}
      {/* ------------------------------------------------------------- */}
      {comingSoonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {editingComingSoonId ? 'تعديل منتج قادم' : 'إضافة منتج تشويقي قادم'}
              </h3>
              <button
                onClick={() => setComingSoonModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComingSoon} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">اسم المنتج</label>
                <input
                  type="text"
                  value={comingSoonForm.name}
                  onChange={(e) => setComingSoonForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: Samsung Galaxy S25 Ultra"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">رابط صورة المنتج</label>
                <input
                  type="url"
                  value={comingSoonForm.image}
                  onChange={(e) => setComingSoonForm((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">موعد التوفر المتوقع (نصي)</label>
                <input
                  type="text"
                  value={comingSoonForm.expectedDate}
                  onChange={(e) => setComingSoonForm((prev) => ({ ...prev, expectedDate: e.target.value }))}
                  placeholder="مثال: أكتوبر 2026 / خلال أسبوعين"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">وصف تشويقي مختصر</label>
                <textarea
                  value={comingSoonForm.shortDescription}
                  onChange={(e) => setComingSoonForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
                  rows={3}
                  placeholder="مواصفات سريعة ولمحة عن الجهاز..."
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] p-3 rounded-xl outline-none focus:border-[#D4AF37] transition-all text-sm"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)]/50 border border-[var(--border)] rounded-xl">
                <input
                  type="checkbox"
                  id="comingSoonActive"
                  checked={comingSoonForm.isActive}
                  onChange={(e) => setComingSoonForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                />
                <label htmlFor="comingSoonActive" className="text-xs text-[var(--text-primary)] font-bold cursor-pointer">
                  تفعيل العرض في الصفحة الرئيسية
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setComingSoonModalOpen(false)}
                  className="px-6 py-2.5 text-[var(--text-secondary)] font-bold text-xs rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#D4AF37] hover:bg-[#E0B64B] text-white rounded-xl font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  حفظ العنصر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal for Homepage Items */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteHomeItem}
        title={
          deleteTarget?.type === 'banner'
            ? 'حذف إعلان السلايدر نهائيًا'
            : deleteTarget?.type === 'news'
            ? 'حذف خبر الشريط نهائيًا'
            : deleteTarget?.type === 'offer'
            ? 'حذف العرض النهائي'
            : 'حذف المنتج القادم نهائيًا'
        }
        itemName={deleteTarget?.itemName}
        message={
          deleteTarget?.type === 'banner'
            ? 'هل أنت متأكد من حذف هذا الإعلان من السلايدر الرئيسي؟ سيتم حذف بيانات الإعلان بالإضافة إلى الصور الترويجية المسجلة من Supabase Storage.'
            : deleteTarget?.type === 'offer'
            ? 'هل أنت متأكد من حذف هذا العرض الخاص؟ سيتم إزالة إعداد العرض فقط ولن يتم حذف المنتج الأصلي من المتجر.'
            : deleteTarget?.type === 'comingSoon'
            ? 'هل أنت متأكد من حذف عنصر القادم قريبًا؟ سيتم إزالة إعداد العرض المسبق ولن يتم حذف المنتج الأصلي من المتجر.'
            : 'هل أنت متأكد من حذف هذا الخبر من الشريط الإخباري العلوي؟'
        }
        loading={deleteLoading}
      />
    </div>
  );
}

import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';
import { storageService } from '../../lib/data/storageService';
import { inventoryService } from '../../lib/data/inventoryService';
import { normalizeSlug } from '../../lib/seoUtils';
import { Product, Category, Company, ProductColor, ProductColorVariant, StockStatus } from '../../types';
import { companyService } from '../../lib/data/companyService';
import { ImageUploader } from '../../components/admin/ImageUploader';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/admin/ConfirmDeleteModal';
import { StockAdjustModal } from '../../components/admin/StockAdjustModal';
import { StockHistoryModal } from '../../components/admin/StockHistoryModal';
import { installmentService } from '../../lib/data/installmentService';
import { FinancingProvider } from '../../types/installment';
import { ProviderLogo } from '../../components/installments/ProviderLogo';
import {

  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  X,
  Check,
  AlertCircle,
  Loader2,
  MessageCircle,
  Palette,
  Upload,
  ArrowUp,
  ArrowDown,
  Layers,
  History,
  Boxes,
  AlertTriangle,
  PackageCheck,
  Clock,
  CreditCard,
  Building2
} from 'lucide-react';

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'coming_soon'>('all');

  const handleSetStockFilter = (filter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'coming_soon') => {
    setSelectedStockFilter(filter);
    const params = new URLSearchParams(window.location.search);
    if (filter && filter !== 'all') {
      params.set('filter', filter);
    } else {
      params.delete('filter');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam === 'low_stock' || filterParam === 'out_of_stock' || filterParam === 'in_stock' || filterParam === 'coming_soon' || filterParam === 'all') {
      setSelectedStockFilter(filterParam as any);
    }
  }, []);

  // Inventory Modals State
  const [adjustStockProduct, setAdjustStockProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // Delete Modal state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [oldPrice, setOldPrice] = useState<number | undefined>(undefined);
  const [sku, setSku] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [description, setDescription] = useState('');
  const [featuresStr, setFeaturesStr] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  // Inventory Form State
  const [stockQuantity, setStockQuantity] = useState<number>(10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(3);
  const [stockStatusOverride, setStockStatusOverride] = useState<StockStatus | ''>('');
  const [showExactStockToCustomer, setShowExactStockToCustomer] = useState(false);

  // Product Colors State
  const [colors, setColors] = useState<ProductColorVariant[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');
  const [newColorImageUrl, setNewColorImageUrl] = useState('');
  const [newColorSku, setNewColorSku] = useState('');
  const [newColorStock, setNewColorStock] = useState<number | undefined>(undefined);
  const [newColorPrice, setNewColorPrice] = useState<number | undefined>(undefined);
  const [newColorActive, setNewColorActive] = useState(true);
  const [imageColorMap, setImageColorMap] = useState<Record<string, string>>({});
  const [uploadingColorImage, setUploadingColorImage] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);

  // Mobile Specifications State
  const [specRam, setSpecRam] = useState('');
  const [specStorage, setSpecStorage] = useState('');
  const [specProcessor, setSpecProcessor] = useState('');
  const [specRearCamera, setSpecRearCamera] = useState('');
  const [specFrontCamera, setSpecFrontCamera] = useState('');
  const [specBattery, setSpecBattery] = useState('');
  const [specChargingSpeed, setSpecChargingSpeed] = useState('');
  const [specFingerprint, setSpecFingerprint] = useState('');
  const [specScreen, setSpecScreen] = useState('');
  const [specNetwork, setSpecNetwork] = useState('');
  const [specOs, setSpecOs] = useState('');

  // Gallery Auto Slide Override State ('default' | 'on' | 'off')
  const [galleryAutoSlideMode, setGalleryAutoSlideMode] = useState<'default' | 'on' | 'off'>('default');
  const [galleryAutoSlideInterval, setGalleryAutoSlideInterval] = useState<number | undefined>(undefined);

  // Installment Settings State
  const [allInstallmentProviders, setAllInstallmentProviders] = useState<FinancingProvider[]>([]);
  const [installmentEnabled, setInstallmentEnabled] = useState(true);
  const [allowedProviderIds, setAllowedProviderIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats, comps, providers] = await Promise.all([
        productService.getAllProducts(true),
        categoryService.getCategories(true),
        companyService.getCompanies(true).catch(() => []),
        installmentService.getProviders().catch(() => [])
      ]);
      setProducts(prods);
      setCategories(cats);
      setCompanies(comps || []);
      setAllInstallmentProviders(providers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Product Color Handlers
  const handleAddOrUpdateColor = () => {
    if (!newColorName.trim()) return;
    const existingImages = (editingColorIndex !== null && colors[editingColorIndex]?.images) ? colors[editingColorIndex].images : [];
    const mainImg = newColorImageUrl.trim() || '';
    const images = mainImg ? (existingImages.includes(mainImg) ? existingImages : [mainImg, ...existingImages]) : existingImages;

    const colorObj: ProductColorVariant = {
      name: newColorName.trim(),
      colorName: newColorName.trim(),
      hex: newColorHex.trim() || undefined,
      colorCode: newColorHex.trim() || undefined,
      imageUrl: mainImg || undefined,
      mainImage: mainImg,
      images,
      active: newColorActive,
      sku: newColorSku.trim() || undefined,
      stockQuantity: newColorStock !== undefined && newColorStock >= 0 ? newColorStock : undefined,
      price: newColorPrice !== undefined && newColorPrice > 0 ? newColorPrice : undefined
    };

    if (editingColorIndex !== null) {
      const updated = [...colors];
      updated[editingColorIndex] = colorObj;
      setColors(updated);
      setEditingColorIndex(null);
    } else {
      setColors([...colors, colorObj]);
    }

    setNewColorName('');
    setNewColorHex('');
    setNewColorImageUrl('');
    setNewColorSku('');
    setNewColorStock(undefined);
    setNewColorPrice(undefined);
    setNewColorActive(true);
  };

  const handleEditColor = (index: number) => {
    const c = colors[index];
    setNewColorName(c.name);
    setNewColorHex(c.hex || '');
    setNewColorImageUrl(c.imageUrl || '');
    setNewColorSku(c.sku || '');
    setNewColorStock(c.stockQuantity);
    setNewColorPrice(c.price);
    setNewColorActive(c.active !== false);
    setEditingColorIndex(index);
  };

  const handleRemoveColor = (index: number) => {
    const removedColor = colors[index];
    setColors(colors.filter((_, i) => i !== index));

    // Also clean up image mappings for this color
    if (removedColor?.name) {
      const updatedMap = { ...imageColorMap };
      Object.entries(updatedMap).forEach(([url, cName]) => {
        if (cName === removedColor.name) {
          delete updatedMap[url];
        }
      });
      setImageColorMap(updatedMap);
    }

    if (editingColorIndex === index) {
      setEditingColorIndex(null);
      setNewColorName('');
      setNewColorHex('');
      setNewColorImageUrl('');
      setNewColorSku('');
      setNewColorStock(undefined);
      setNewColorPrice(undefined);
      setNewColorActive(true);
    }
  };

  const handleSetColorMainImage = (colorName: string, url: string) => {
    if (!colorName || !url) return;
    setColors((prev) =>
      prev.map((c: any) => {
        const cName = c.name || c.colorName;
        if (cName === colorName) {
          const prevImages = Array.isArray(c.images) ? c.images : [];
          const images = prevImages.includes(url) ? prevImages : [url, ...prevImages];
          return { ...c, imageUrl: url, mainImage: url, images };
        }
        return c;
      })
    );
    // Ensure the image is also mapped to this color
    setImageColorMap((prev) => ({
      ...prev,
      [url]: colorName
    }));
  };

  const handleMoveColor = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === colors.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...colors];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setColors(updated);
  };

  const handleColorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingColorImage(true);
      const url = await storageService.uploadProductImage(editingProduct?.id || 'new_color', file);
      setNewColorImageUrl(url);
    } catch (err: any) {
      alert(err?.message || 'تعذر رفع صورة اللون');
    } finally {
      setUploadingColorImage(false);
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setCompanyId('');
    setPrice(0);
    setOldPrice(undefined);
    setSku(`BAYT-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsAvailable(true);
    setIsPublished(true);
    setIsFeatured(false);
    setDescription('');
    setFeaturesStr('');
    setMainImageUrl('');
    setAdditionalImages([]);
    setStockQuantity(10);
    setLowStockThreshold(3);
    setStockStatusOverride('');
    setShowExactStockToCustomer(false);
    setColors([]);
    setImageColorMap({});
    setNewColorName('');
    setNewColorHex('');
    setNewColorImageUrl('');
    setNewColorSku('');
    setNewColorStock(undefined);
    setNewColorPrice(undefined);
    setNewColorActive(true);
    setEditingColorIndex(null);
    setSpecRam('');
    setSpecStorage('');
    setSpecProcessor('');
    setSpecRearCamera('');
    setSpecFrontCamera('');
    setSpecBattery('');
    setSpecChargingSpeed('');
    setSpecFingerprint('');
    setSpecScreen('');
    setSpecNetwork('');
    setSpecOs('');
    setGalleryAutoSlideMode('default');
    setGalleryAutoSlideInterval(undefined);
    setInstallmentEnabled(true);
    setAllowedProviderIds([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategoryId(prod.categoryId);
    setCompanyId(prod.companyId || '');
    setPrice(prod.price);
    setOldPrice(prod.oldPrice);
    setSku(prod.sku);
    setIsAvailable(prod.isAvailable);
    setIsPublished(prod.isPublished);
    setIsFeatured(prod.isFeatured);
    setDescription(prod.description);
    setFeaturesStr(prod.features ? prod.features.join('\n') : '');
    setMainImageUrl(prod.mainImageUrl || '');
    setAdditionalImages(prod.additionalImages || []);
    
    // Inventory
    setStockQuantity(typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.isAvailable ? 10 : 0));
    setLowStockThreshold(typeof prod.lowStockThreshold === 'number' ? prod.lowStockThreshold : 3);
    setStockStatusOverride(prod.stockStatus || '');
    setShowExactStockToCustomer(prod.showExactStockToCustomer || false);

    const initialColors = (prod.colorVariants || prod.colors || []) as ProductColorVariant[];
    setColors(initialColors);

    // Reconstruct imageColorMap
    let loadedImageColorMap: Record<string, string> = {};
    if (prod.imageColorMap) {
      loadedImageColorMap = { ...prod.imageColorMap };
    } else if (prod.colorImageMap) {
      Object.entries(prod.colorImageMap).forEach(([colorName, urls]) => {
        if (Array.isArray(urls)) {
          urls.forEach((u) => {
            if (u) loadedImageColorMap[u] = colorName;
          });
        }
      });
    }
    if (prod.colorVariants) {
      prod.colorVariants.forEach((v) => {
        const colName = v.colorName || (v as any).name;
        if (colName) {
          (v.images || []).forEach((u) => {
            if (u) loadedImageColorMap[u] = colName;
          });
          if (v.mainImage) loadedImageColorMap[v.mainImage] = colName;
        }
      });
    }
    setImageColorMap(loadedImageColorMap);

    setNewColorName('');
    setNewColorHex('');
    setNewColorImageUrl('');
    setNewColorSku('');
    setNewColorStock(undefined);
    setNewColorPrice(undefined);
    setNewColorActive(true);
    setEditingColorIndex(null);
    
    // Installment settings
    setInstallmentEnabled(prod.installmentConfig?.enabled !== false);
    setAllowedProviderIds(prod.installmentConfig?.allowedProviderIds || []);

    // Gallery settings
    const gs = prod.gallerySettings;
    if (gs?.autoSlideEnabled === true) {
      setGalleryAutoSlideMode('on');
    } else if (gs?.autoSlideEnabled === false) {
      setGalleryAutoSlideMode('off');
    } else {
      setGalleryAutoSlideMode('default');
    }
    setGalleryAutoSlideInterval(gs?.autoSlideInterval);

    // Specifications
    const specs = prod.specifications || {};
    setSpecRam(specs.ram || '');
    setSpecStorage(specs.storage || '');
    setSpecProcessor(specs.processor || '');
    setSpecRearCamera(specs.rearCamera || '');
    setSpecFrontCamera(specs.frontCamera || '');
    setSpecBattery(specs.battery || '');
    setSpecChargingSpeed(specs.chargingSpeed || '');
    setSpecFingerprint(specs.fingerprint || '');
    setSpecScreen(specs.screen || '');
    setSpecNetwork(specs.network || '');
    setSpecOs(specs.os || '');

    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImageUploading) {
      setFormError('يوجد صور لم يكتمل رفعها بعد.');
      return;
    }
    if (!name.trim()) {
      setFormError('اسم المنتج مطلوب.');
      return;
    }
    if (price <= 0) {
      setFormError('يرجى تحديد سعر صالح للمنتج.');
      return;
    }
    if (!categoryId) {
      setFormError('يرجى اختيار القسم.');
      return;
    }

    // 3. FIRST IMAGE FALLBACK & VALIDATION: Every active/imaged color variant must have exactly one correct mainImage.
    if (colors && colors.length > 0) {
      const updatedColors = [...colors];
      let colorsModified = false;

      // First run: Apply fallback if a variant has images but no main image selected
      for (let i = 0; i < updatedColors.length; i++) {
        const c = updatedColors[i];
        const colName = (c.name || (c as any).colorName || '').trim();
        if (!colName) continue;

        let colMainImg = c.mainImage || c.imageUrl;

        const assignedUrls = Object.entries(imageColorMap)
          .filter(([_, mappedName]) => mappedName === colName)
          .map(([url]) => url);

        if ((!colMainImg || !colMainImg.trim()) && assignedUrls.length > 0) {
          colMainImg = assignedUrls[0];
          updatedColors[i] = {
            ...c,
            imageUrl: colMainImg,
            mainImage: colMainImg
          };
          colorsModified = true;
        }
      }

      if (colorsModified) {
        setColors(updatedColors);
      }

      // Second run: Perform strict validation
      const finalColorsToCheck = colorsModified ? updatedColors : colors;
      for (const c of finalColorsToCheck) {
        const colName = (c.name || (c as any).colorName || '').trim();
        if (!colName) continue;

        const colMainImg = c.mainImage || c.imageUrl;

        // Check assigned images mapped to this color
        const assignedUrls = Object.entries(imageColorMap)
          .filter(([_, mappedName]) => mappedName === colName)
          .map(([url]) => url);

        const hasAnyImage = Boolean(colMainImg && colMainImg.trim()) || assignedUrls.length > 0;

        // Active variants require at least one image
        if (c.active !== false && !hasAnyImage) {
          setFormError(`يرجى رفع أو تحديد صورة واحدة على الأقل لمتغير اللون: "${colName}"`);
          return;
        }

        if (hasAnyImage) {
          if (!colMainImg || !colMainImg.trim()) {
            setFormError(`اختر صورة رئيسية للون: ${colName}`);
            return;
          }

          // Validate that the main image belongs to that color variant (Requirement 9)
          const mappedColor = imageColorMap[colMainImg];
          if (mappedColor && mappedColor !== colName) {
            setFormError(`الصورة الرئيسية المحددة للون "${colName}" تنتمي إلى لون آخر وهو "${mappedColor}". يرجى اختيار صورة صحيحة.`);
            return;
          }

          // Ensure it is part of the color's assigned images
          if (assignedUrls.length > 0 && !assignedUrls.includes(colMainImg)) {
            setFormError(`الصورة الرئيسية المحددة للون "${colName}" يجب أن تكون موجودة ضمن صور هذا اللون.`);
            return;
          }
        }
      }
    }

    setSaving(true);
    setFormError(null);

    const targetCat = categories.find((c) => c.id === categoryId);
    const categoryName = targetCat ? targetCat.name : '';

    const featuresArray = featuresStr
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    // Build specifications object (only non-empty values)
    const specificationsPayload: Record<string, string> = {};
    if (specRam.trim()) specificationsPayload.ram = specRam.trim();
    if (specStorage.trim()) specificationsPayload.storage = specStorage.trim();
    if (specProcessor.trim()) specificationsPayload.processor = specProcessor.trim();
    if (specRearCamera.trim()) specificationsPayload.rearCamera = specRearCamera.trim();
    if (specFrontCamera.trim()) specificationsPayload.frontCamera = specFrontCamera.trim();
    if (specBattery.trim()) specificationsPayload.battery = specBattery.trim();
    if (specChargingSpeed.trim()) specificationsPayload.chargingSpeed = specChargingSpeed.trim();
    if (specFingerprint.trim()) specificationsPayload.fingerprint = specFingerprint.trim();
    if (specScreen.trim()) specificationsPayload.screen = specScreen.trim();
    if (specNetwork.trim()) specificationsPayload.network = specNetwork.trim();
    if (specOs.trim()) specificationsPayload.os = specOs.trim();

    // Build gallerySettings payload
    const gallerySettingsPayload = {
      autoSlideEnabled:
        galleryAutoSlideMode === 'on' ? true : galleryAutoSlideMode === 'off' ? false : undefined,
      autoSlideInterval: galleryAutoSlideInterval ? Number(galleryAutoSlideInterval) : undefined
    };

    // Build installmentConfig payload
    const installmentConfigPayload = {
      enabled: installmentEnabled,
      allowedProviderIds: allowedProviderIds.length > 0 ? allowedProviderIds : undefined
    };

    // Calculate final stock status & availability
    const cleanStockQty = Math.max(0, Number(stockQuantity) || 0);
    const cleanThreshold = Math.max(1, Number(lowStockThreshold) || 3);
    const isComingSoon = stockStatusOverride === 'coming_soon';
    const computedAvailable = isComingSoon ? false : (cleanStockQty > 0 && isAvailable);
    const finalStockStatus = stockStatusOverride || inventoryService.deriveStockStatus(cleanStockQty, cleanThreshold, computedAvailable, isComingSoon);

    // Build colorImageMap payload from imageColorMap
    const colorImageMapPayload: Record<string, string[]> = {};
    Object.entries(imageColorMap).forEach(([url, colorName]) => {
      if (colorName) {
        if (!colorImageMapPayload[colorName]) {
          colorImageMapPayload[colorName] = [];
        }
        if (!colorImageMapPayload[colorName].includes(url)) {
          colorImageMapPayload[colorName].push(url);
        }
      }
    });

    // Also include custom color swatch imageUrl if set
    colors.forEach((c) => {
      if (c.imageUrl && c.name) {
        if (!colorImageMapPayload[c.name]) {
          colorImageMapPayload[c.name] = [];
        }
        if (!colorImageMapPayload[c.name].includes(c.imageUrl)) {
          colorImageMapPayload[c.name].unshift(c.imageUrl);
        }
      }
    });

    // Build structured variants array for each color
    const variantsPayload: ProductColorVariant[] = (colors || []).map((c, idx) => {
      const colorImages = colorImageMapPayload[c.name] || [];
      const mainImg = c.mainImage || c.imageUrl || colorImages[0] || mainImageUrl || '';
      
      // Ensure all color-specific images (including the main one) are part of the images list
      const allImagesForVariant = Array.from(new Set([
        ...(mainImg ? [mainImg] : []),
        ...colorImages
      ])).filter((img): img is string => Boolean(img && img.trim()));

      return {
        id: (c as any).id || `variant_${idx}_${Date.now()}`,
        name: c.name,
        colorName: c.name,
        hex: c.hex,
        colorCode: c.hex,
        imageUrl: mainImg,
        mainImage: mainImg,
        images: allImagesForVariant,
        active: c.active !== false,
        sku: c.sku || (sku ? `${sku}-${idx + 1}` : undefined),
        stockQuantity: c.stockQuantity,
        price: c.price,
        oldPrice: c.oldPrice
      };
    });

    try {
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, {
          name: name.trim(),
          categoryId,
          categoryName,
          companyId: companyId ? companyId : (null as any),
          price,
          oldPrice: oldPrice ? Number(oldPrice) : null,
          sku: sku.trim(),
          isAvailable: computedAvailable,
          isPublished,
          isFeatured,
          stockQuantity: cleanStockQty,
          lowStockThreshold: cleanThreshold,
          stockStatus: finalStockStatus,
          showExactStockToCustomer,
          description: description.trim(),
          features: featuresArray,
          mainImageUrl: mainImageUrl || '',
          additionalImages: additionalImages || [],
          specifications: specificationsPayload,
          colors: colors || [],
          colorVariants: variantsPayload,
          variants: variantsPayload,
          colorImageMap: colorImageMapPayload,
          imageColorMap: imageColorMap || {},
          gallerySettings: gallerySettingsPayload,
          installmentConfig: installmentConfigPayload
        });
      } else {
        const cleanBaseSlug = normalizeSlug(name.trim()) || 'product';
        let uniqueSlug = cleanBaseSlug;
        let suffix = 1;
        while (products.some(p => p.slug === uniqueSlug)) {
          suffix++;
          uniqueSlug = `${cleanBaseSlug}-${suffix}`;
        }

        await productService.createProduct({
          name: name.trim(),
          slug: uniqueSlug,
          categoryId,
          categoryName,
          companyId: companyId ? companyId : undefined,
          price,
          oldPrice: oldPrice ? Number(oldPrice) : null,
          sku: sku.trim(),
          isAvailable: computedAvailable,
          isPublished,
          isFeatured,
          stockQuantity: cleanStockQty,
          lowStockThreshold: cleanThreshold,
          stockStatus: finalStockStatus,
          showExactStockToCustomer,
          description: description.trim(),
          features: featuresArray,
          mainImageUrl: mainImageUrl || '',
          additionalImages: additionalImages || [],
          specifications: specificationsPayload,
          colors: colors || [],
          colorVariants: variantsPayload,
          variants: variantsPayload,
          colorImageMap: colorImageMapPayload,
          imageColorMap: imageColorMap || {},
          gallerySettings: gallerySettingsPayload,
          installmentConfig: installmentConfigPayload,
          sortOrder: products.length + 1
        });
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message || 'حدث خطأ أثناء حفظ المنتج في Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      setDeleteLoading(true);
      await productService.deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'حدث خطأ أثناء حذف المنتج من قاعدة البيانات.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDuplicate = async (prod: Product) => {
    try {
      await productService.duplicateProduct(prod.id);
      await loadData();
    } catch (err) {
      alert('حدث خطأ أثناء نسخ المنتج.');
    }
  };

  const handleTogglePublish = async (prod: Product) => {
    try {
      await productService.updateProduct(prod.id, { isPublished: !prod.isPublished });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFeatured = async (prod: Product) => {
    try {
      await productService.updateProduct(prod.id, { isFeatured: !prod.isFeatured });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAvailable = async (prod: Product) => {
    try {
      await productService.updateProduct(prod.id, { isAvailable: !prod.isAvailable });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const inventorySummary = inventoryService.calculateInventorySummary(products);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesCompany = selectedCompanyFilter === 'all' || (selectedCompanyFilter === 'none' ? !p.companyId : p.companyId === selectedCompanyFilter);
    
    let matchesStock = true;
    const stock = typeof p.stockQuantity === 'number' ? p.stockQuantity : (p.isAvailable ? 10 : 0);
    const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 3;
    const status = p.stockStatus || inventoryService.deriveStockStatus(stock, threshold, p.isAvailable);

    if (selectedStockFilter === 'in_stock') {
      matchesStock = status === 'in_stock';
    } else if (selectedStockFilter === 'low_stock') {
      matchesStock = status === 'low_stock';
    } else if (selectedStockFilter === 'out_of_stock') {
      matchesStock = status === 'out_of_stock';
    } else if (selectedStockFilter === 'coming_soon') {
      matchesStock = status === 'coming_soon';
    }

    return matchesSearch && matchesCat && matchesCompany && matchesStock;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">إدارة المنتجات والمخزون</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            إضافة وتعديل وحذف المنتجات، التحكم بالمخزون الذري وسجل حركات التوريد
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-5 py-3 bg-[#D4AF37] hover:bg-[#E0B64B] text-black font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D4AF37]/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Inventory KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          onClick={() => handleSetStockFilter('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStockFilter === 'all'
              ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/30'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-xs font-bold">إجمالي المنتجات</span>
            <Boxes className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-[var(--text-primary)]">{inventorySummary.totalProducts}</span>
            <span className="text-[10px] text-[var(--text-muted)]">({inventorySummary.totalStockUnits} قطعة)</span>
          </div>
        </div>

        <div
          onClick={() => handleSetStockFilter('in_stock')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStockFilter === 'in_stock'
              ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-xs font-bold">متوفر بالمخزن</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-xl font-black font-mono text-emerald-500">{inventorySummary.inStockCount}</span>
        </div>

        <div
          onClick={() => handleSetStockFilter('low_stock')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStockFilter === 'low_stock'
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-xs font-bold">مخزون منخفض ⚠️</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl font-black font-mono text-amber-500">{inventorySummary.lowStockCount}</span>
        </div>

        <div
          onClick={() => handleSetStockFilter('out_of_stock')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStockFilter === 'out_of_stock'
              ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-xs font-bold">نفد من المخزون</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-xl font-black font-mono text-rose-500">{inventorySummary.outOfStockCount}</span>
        </div>

        <div
          onClick={() => handleSetStockFilter('coming_soon')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            selectedStockFilter === 'coming_soon'
              ? 'bg-sky-500/10 border-sky-500/40 ring-1 ring-sky-500/30'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-1">
            <span className="text-xs font-bold">قريباً بالموقع</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <span className="text-xl font-black font-mono text-sky-500">{inventorySummary.comingSoonCount}</span>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم المنتج أو كود SKU..."
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-xs rounded-xl py-2.5 pr-9 pl-3 text-[var(--text-primary)] outline-none"
          />
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-3" />
        </div>

        <select
          value={selectedStockFilter}
          onChange={(e) => handleSetStockFilter(e.target.value as any)}
          className="w-full sm:w-44 bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3 outline-none focus:border-[#D4AF37]"
        >
          <option value="all">كل حالات المخزون</option>
          <option value="in_stock">متوفر ({inventorySummary.inStockCount})</option>
          <option value="low_stock">مخزون منخفض ({inventorySummary.lowStockCount})</option>
          <option value="out_of_stock">نفد من المخزن ({inventorySummary.outOfStockCount})</option>
          <option value="coming_soon">قريباً ({inventorySummary.comingSoonCount})</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-48 bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3 outline-none focus:border-[#D4AF37]"
        >
          <option value="all">جميع الأقسام ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {companies.length > 0 && (
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            className="w-full sm:w-44 bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3 outline-none focus:border-[#D4AF37]"
          >
            <option value="all">جميع الشركات</option>
            <option value="none">بدون شركة محددة</option>
            {companies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Products Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="p-4">المنتج</th>
                  <th className="p-4">القسم</th>
                  <th className="p-4">السعر</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4 text-center">المخزون والتوفر</th>
                  <th className="p-4 text-center">نقرات واتساب</th>
                  <th className="p-4 text-center">النشر</th>
                  <th className="p-4 text-center">مميز</th>
                  <th className="p-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredProducts.map((prod) => {
                  const stock = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.isAvailable ? 10 : 0);
                  const threshold = typeof prod.lowStockThreshold === 'number' ? prod.lowStockThreshold : 3;
                  const status = prod.stockStatus || inventoryService.deriveStockStatus(stock, threshold, prod.isAvailable);

                  return (
                    <tr key={prod.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={getValidImageSrc(prod.mainImageUrl || '/logo.svg')}
                          alt={prod.name}
                          className="w-12 h-12 rounded-xl object-cover bg-[var(--surface-elevated)] shrink-0 border border-[var(--border)]"
                        />
                        <div>
                          <span className="font-bold text-sm text-[var(--text-primary)] block line-clamp-1">{prod.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {(prod.additionalImages?.length || 0) + 1} صور
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-[var(--text-secondary)] font-medium">{prod.categoryName || '—'}</td>

                      <td className="p-4 font-black text-[#D4AF37] text-sm">
                        {prod.price.toLocaleString('ar-EG')} ج.م
                      </td>

                      <td className="p-4 font-mono text-[var(--text-secondary)]">{prod.sku}</td>

                      {/* Stock & Availability Column */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {status === 'coming_soon' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-500 font-bold text-[10px]">
                                <Clock className="w-3 h-3" />
                                <span>قريباً</span>
                              </span>
                            ) : status === 'out_of_stock' || stock <= 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-[10px]">
                                <XCircle className="w-3 h-3" />
                                <span>نفد المخزون</span>
                              </span>
                            ) : status === 'low_stock' || stock <= threshold ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3" />
                                <span>منخفض ({stock})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>متوفر ({stock})</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Stock Controls */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setAdjustStockProduct(prod)}
                              title="تعديل المخزون والتوريد"
                              className="px-2 py-0.5 rounded-md bg-[var(--surface-elevated)] hover:bg-[#D4AF37]/20 text-[var(--text-secondary)] hover:text-[#D4AF37] border border-[var(--border)] text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Layers className="w-3 h-3" />
                              <span>تعديل</span>
                            </button>
                            <button
                              onClick={() => setHistoryProduct(prod)}
                              title="سجل حركات المخزون"
                              className="p-1 rounded-md bg-[var(--surface-elevated)] hover:bg-sky-500/20 text-[var(--text-secondary)] hover:text-sky-500 border border-[var(--border)] transition-all cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp Clicks */}
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold font-mono text-xs">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{prod.whatsappClicks || 0}</span>
                        </span>
                      </td>

                      {/* Publish toggle */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleTogglePublish(prod)}
                          title={prod.isPublished ? 'إلغاء النشر' : 'نشر'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            prod.isPublished
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                          }`}
                        >
                          {prod.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Featured toggle */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleFeatured(prod)}
                          title={prod.isFeatured ? 'إلغاء التمييز' : 'تمييز المنتج'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            prod.isFeatured
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-[#D4AF37]'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${prod.isFeatured ? 'fill-current' : ''}`} />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(prod)}
                            title="تعديل المنتج"
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[#D4AF37] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(prod)}
                            title="نسخ المنتج"
                            className="p-1.5 text-[var(--text-secondary)] hover:text-sky-500 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeletingProduct(prod)}
                            title="حذف المنتج"
                            className="p-1.5 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl">
            <div className="p-5 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
                </h3>
                {editingProduct && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold font-mono">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{editingProduct.whatsappClicks || 0} نقرة واستفسار</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">اسم المنتج *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="مثال: شنطة ظهر مدرسية أصلية مبطنة"
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">القسم *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                    <span>الشركة / الماركة (اختياري)</span>
                    {companyId && (
                      <button
                        type="button"
                        onClick={() => setCompanyId('')}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
                  >
                    <option value="">بدون شركة (غير محدد)</option>
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name} {comp.isActive === false ? '(غير مفعلة)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">كود المنتج (SKU) *</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    dir="ltr"
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">السعر الحالي (ج.م) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    min={0}
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">السعر القديم قبل الخصم (اختياري)</label>
                  <input
                    type="number"
                    value={oldPrice || ''}
                    onChange={(e) => setOldPrice(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="اتركه فارغاً إن لم يكن هناك خصم"
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-secondary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
                  />
                </div>
              </div>

              {/* Status & Inventory Section */}
              <div className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2 text-[#D6A83A]">
                    <Boxes className="w-4 h-4" />
                    <span className="text-xs font-bold">التحكم بالمخزون والتوفر</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">إدارة الكميات الحقيقية المتاحة للبيع ومنع البيع الزائد</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                      الكمية المتوفرة بالمخزن *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setStockQuantity(val);
                        if (val === 0 && stockStatusOverride !== 'coming_soon') {
                          setIsAvailable(false);
                        } else if (val > 0) {
                          setIsAvailable(true);
                        }
                      }}
                      required
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs font-mono font-bold rounded-xl py-2 px-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                      حد تنبيه انخفاض المخزون
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs font-mono font-bold rounded-xl py-2 px-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                      حالة المخزون المعروضة
                    </label>
                    <select
                      value={stockStatusOverride}
                      onChange={(e) => setStockStatusOverride(e.target.value as any)}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2 px-3 outline-none"
                    >
                      <option value="">تلقائي (حسب الكمية)</option>
                      <option value="in_stock">متوفر بالمخزن</option>
                      <option value="low_stock">مخزون منخفض</option>
                      <option value="out_of_stock">نفد من المخزن</option>
                      <option value="coming_soon">قريباً بالموقع</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={showExactStockToCustomer}
                        onChange={(e) => setShowExactStockToCustomer(e.target.checked)}
                        className="rounded bg-[var(--surface-elevated)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span>عرض الكمية للعملاء</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="rounded bg-[var(--surface-elevated)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span>منشور في الكتالوج</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="rounded bg-[var(--surface-elevated)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span>متاح للطلب والبيع</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="rounded bg-[var(--surface-elevated)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span>منتج مميز بالرئيسية</span>
                  </label>
                </div>
              </div>

              {/* Images via ImageUploader */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-2">
                  صور المنتج (رفع وضغط فيري إلى Firebase Storage)
                </label>
                <ImageUploader
                  productId={editingProduct?.id || 'new'}
                  mainImageUrl={mainImageUrl}
                  additionalImages={additionalImages}
                  availableColors={colors}
                  imageColorMap={imageColorMap}
                  onImageColorMapChange={(map) => setImageColorMap(map)}
                  onSetColorMainImage={handleSetColorMainImage}
                  onUploadStateChange={setIsImageUploading}
                  onChange={(main, additional) => {
                    setMainImageUrl(main);
                    setAdditionalImages(additional);
                  }}
                />
              </div>

              {/* Product Colors Management Section */}
              <div className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2 text-[#D6A83A]">
                    <Palette className="w-4 h-4" />
                    <span className="text-xs font-bold">إدارة خيارات ألوان المنتج (Color Variants)</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">تتيح للمشتري اختيار اللون وتبديل صور المعرض تلقائياً</span>
                </div>

                {/* Existing Colors Cards List */}
                {colors.length > 0 ? (
                  <div className="space-y-3">
                    {colors.map((c: any, idx) => {
                      const colName = c.colorName || c.name || '';
                      const colHex = c.colorCode || c.hex;
                      const colMainImg = c.mainImage || c.imageUrl;

                      // Assigned images in imageColorMap
                      const assignedUrls = Object.entries(imageColorMap)
                        .filter(([_, mappedColorName]) => mappedColorName === colName)
                        .map(([url]) => url);

                      const variantImages = Array.isArray(c.images) ? c.images : [];

                      const allColorImages = Array.from(new Set([
                        ...(colMainImg ? [colMainImg] : []),
                        ...assignedUrls,
                        ...variantImages
                      ])).filter((u): u is string => Boolean(u && u.trim()));

                      const hasMainImage = Boolean(colMainImg && colMainImg.trim());

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border-2 transition-all space-y-3 bg-[var(--surface-elevated)] ${
                            hasMainImage
                              ? 'border-[#D6A83A]/60 shadow-lg shadow-[#D6A83A]/5'
                              : 'border-amber-500/80 bg-amber-500/5'
                          }`}
                        >
                          {/* Top Header Row */}
                          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                            <div className="flex items-center gap-3">
                              {/* Swatch circle */}
                              <div className="relative shrink-0">
                                {colHex ? (
                                  <span
                                    className="w-7 h-7 rounded-full border-2 border-white/40 shadow-md block"
                                    style={{ backgroundColor: colHex }}
                                  />
                                ) : (
                                  <span className="w-7 h-7 rounded-full bg-[var(--surface-secondary)] border-2 border-white/20 flex items-center justify-center text-xs text-[var(--text-primary)] font-black">
                                    {colName.slice(0, 1)}
                                  </span>
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-[var(--text-primary)]">{colName}</h4>
                                  {c.active === false ? (
                                    <span className="text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                                      معطل
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                      مفعل
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5 flex-wrap">
                                  {colHex && <span className="font-mono">Hex: {colHex}</span>}
                                  {c.sku && <span>SKU: {c.sku}</span>}
                                  {c.stockQuantity !== undefined && <span>المخزون: {c.stockQuantity}</span>}
                                  {c.price !== undefined && <span>السعر: {c.price} ج.م</span>}
                                  <span className="text-[#D6A83A] font-bold">({allColorImages.length} صور مرتبطة)</span>
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)]">
                              <button
                                type="button"
                                onClick={() => handleMoveColor(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                                title="تحريك لأعلى"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveColor(idx, 'down')}
                                disabled={idx === colors.length - 1}
                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                                title="تحريك لأسفل"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditColor(idx)}
                                className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                                title="تعديل بيانات اللون"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveColor(idx)}
                                className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                title="حذف هذا اللون"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Main Image & Gallery Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                            {/* Main Image Card (5 cols) */}
                            <div className="md:col-span-5 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)] flex flex-col justify-between gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[#D6A83A] flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 fill-current" />
                                  الصورة الرئيسية لهذا اللون (Main Image)
                                </span>
                                {hasMainImage ? (
                                  <span className="text-[9px] bg-[#D6A83A]/10 text-[#D6A83A] border border-[#D6A83A]/30 px-1.5 py-0.5 rounded font-bold">
                                    محددة ✓
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                    مطلوبة ⚠️
                                  </span>
                                )}
                              </div>

                              {hasMainImage ? (
                                <div className="relative aspect-video bg-[var(--surface-secondary)] rounded-lg overflow-hidden border border-[#D6A83A]/30 group flex items-center justify-center">
                                  <img src={getValidImageSrc(colMainImg)} alt={colName} className="w-full h-full object-contain" />
                                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditColor(idx)}
                                      className="bg-[#D6A83A] text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-amber-400 cursor-pointer"
                                    >
                                      تغيير الصورة الرئيسية
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center space-y-2">
                                  <p className="text-[11px] text-amber-600 font-semibold leading-relaxed">
                                    ⚠️ يرجى تحديد صورة رئيسية لهذا اللون من الصور المرفوعة أو اختيار واحدة أدناه.
                                  </p>
                                  {allColorImages.length > 0 && (
                                    <div className="space-y-1 pt-1">
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleSetColorMainImage(colName, e.target.value);
                                          }
                                        }}
                                        className="w-full bg-[var(--surface-secondary)] border border-amber-500/30 text-[var(--text-primary)] text-xs rounded-lg py-1 px-2 outline-none cursor-pointer"
                                      >
                                        <option value="">-- اختر صورة لتصبح رئيسية لهذا اللون --</option>
                                        {allColorImages.map((u, i) => (
                                          <option key={i} value={u}>
                                            صورة {i + 1}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Gallery Thumbnails (7 cols) */}
                            <div className="md:col-span-7 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)] flex flex-col justify-between gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
                                  <Palette className="w-3.5 h-3.5 text-[#D6A83A]" />
                                  معرض صور هذا اللون ({allColorImages.length})
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  انقر على أي صورة لتعيينها كرئيسية للون
                                </span>
                              </div>

                              {allColorImages.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                                  {allColorImages.map((imgUrl, i) => {
                                    const isMainForColor = imgUrl === colMainImg;
                                    return (
                                      <div
                                        key={i}
                                        onClick={() => handleSetColorMainImage(colName, imgUrl)}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-[var(--surface-secondary)] cursor-pointer select-none ${
                                          isMainForColor 
                                            ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/20 shadow-lg scale-98' 
                                            : 'border-[var(--border)] hover:border-[#D4AF37]/50'
                                        }`}
                                      >
                                        <img src={getValidImageSrc(imgUrl)} alt={`صورة ${i + 1}`} className="w-full h-full object-cover" />

                                        {isMainForColor ? (
                                          <>
                                            {/* Persistent Checkmark at top-right */}
                                            <div className="absolute top-1.5 right-1.5 bg-[#D4AF37] text-black w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shadow-md z-10">
                                              ✓
                                            </div>
                                            {/* Bottom banner for Main Image label */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-[#D4AF37] text-black py-0.5 text-center text-[8.5px] font-black tracking-wide uppercase leading-tight z-10">
                                              الصورة الرئيسية
                                            </div>
                                          </>
                                        ) : (
                                          <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1">
                                            <span className="bg-black/80 border border-[#D4AF37]/40 text-[#D4AF37] text-[8.5px] font-black px-2 py-1 rounded shadow-md text-center">
                                              تعيين كصورة رئيسية
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-4 border border-dashed border-[var(--border)] rounded-lg text-center flex items-center justify-center h-full">
                                  <p className="text-xs text-[var(--text-muted)] italic">لا توجد صور مخصصة لهذا اللون حتى الآن. استخدم خيار "اللون المخصص" بأعلى لربط الصور.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic text-center py-2">لا توجد ألوان مضافة لهذا المنتج حتى الآن.</p>
                )}

                {/* Add / Edit Color Form */}
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)] block">
                    {editingColorIndex !== null ? 'تعديل بيانات خيار اللون' : 'إضافة خيار لون جديد'}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">اسم اللون * (مثال: أبيض لؤلؤي)</label>
                      <input
                        type="text"
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        placeholder="أبيض / أزرق سماوي / أسود ملكي"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">رمز اللون Hex (اختر أو اكتب)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={newColorHex || '#000000'}
                          onChange={(e) => setNewColorHex(e.target.value)}
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={newColorHex}
                          onChange={(e) => setNewColorHex(e.target.value)}
                          placeholder="#FFFFFF"
                          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">رمز SKU المخصص للون (اختياري)</label>
                      <input
                        type="text"
                        value={newColorSku}
                        onChange={(e) => setNewColorSku(e.target.value)}
                        placeholder="SKU-COLOR-01"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">مخزون اللون المخصص (اختياري)</label>
                      <input
                        type="number"
                        min={0}
                        value={newColorStock ?? ''}
                        onChange={(e) => setNewColorStock(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="كمية المخزون للون"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">سعر خاص للون (اختياري)</label>
                      <input
                        type="number"
                        min={0}
                        value={newColorPrice ?? ''}
                        onChange={(e) => setNewColorPrice(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="سعر المنتج بهذا اللون"
                        className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                        الصورة الرئيسية لهذا اللون (Main Image)
                      </label>
                      <div className="space-y-1.5">
                        {[mainImageUrl, ...additionalImages].filter((img) => img && img.trim()).length > 0 && (
                          <select
                            value={newColorImageUrl}
                            onChange={(e) => setNewColorImageUrl(e.target.value)}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A] cursor-pointer"
                          >
                            <option value="">-- اختر الصورة الرئيسية من الصور المرفوعة --</option>
                            {[mainImageUrl, ...additionalImages]
                              .filter((img) => img && img.trim())
                              .map((url, i) => (
                                <option key={i} value={url}>
                                  صورة {i + 1} ({url.split('/').pop() || url})
                                </option>
                              ))}
                          </select>
                        )}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newColorImageUrl}
                            onChange={(e) => setNewColorImageUrl(e.target.value)}
                            placeholder="رابط الصورة المباشر أو اختر من القائمة"
                            className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D6A83A]"
                          />
                          <label className="cursor-pointer bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[#D6A83A] p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center">
                            {uploadingColorImage ? <Loader2 className="w-4 h-4 animate-spin text-[#D6A83A]" /> : <Upload className="w-4 h-4" />}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleColorImageUpload}
                              className="hidden"
                              disabled={uploadingColorImage}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newColorActive}
                        onChange={(e) => setNewColorActive(e.target.checked)}
                        className="rounded bg-[var(--surface)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span>اللون متاح ومفعل للعملاء</span>
                    </label>

                    <div className="flex items-center gap-2">
                      {editingColorIndex !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingColorIndex(null);
                            setNewColorName('');
                            setNewColorHex('');
                            setNewColorImageUrl('');
                            setNewColorSku('');
                            setNewColorStock(undefined);
                            setNewColorPrice(undefined);
                            setNewColorActive(true);
                          }}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-lg"
                        >
                          إلغاء
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddOrUpdateColor}
                        disabled={!newColorName.trim()}
                        className="bg-[#D6A83A] hover:bg-[#b88e2c] text-black font-bold text-xs px-4 py-1.5 rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {editingColorIndex !== null ? 'تحديث خيار اللون' : 'إضافة اللون بالقائمة'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Specifications (11 fields) */}
              <div className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="text-xs font-bold text-[#D6A83A]">
                    المواصفات الأساسية (تظهر تلقائيًا لقسم الموبايلات)
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">الحقول الفارغة لن تظهر في الصفحة</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">الرام (RAM)</label>
                    <input
                      type="text"
                      value={specRam}
                      onChange={(e) => setSpecRam(e.target.value)}
                      placeholder="مثال: 8 GB"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">المساحة الداخلية</label>
                    <input
                      type="text"
                      value={specStorage}
                      onChange={(e) => setSpecStorage(e.target.value)}
                      placeholder="مثال: 256 GB"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">المعالج (CPU)</label>
                    <input
                      type="text"
                      value={specProcessor}
                      onChange={(e) => setSpecProcessor(e.target.value)}
                      placeholder="مثال: Snapdragon 7 Gen 3"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">الكاميرا الخلفية</label>
                    <input
                      type="text"
                      value={specRearCamera}
                      onChange={(e) => setSpecRearCamera(e.target.value)}
                      placeholder="مثال: 50 MP + 8 MP"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">الكاميرا الأمامية</label>
                    <input
                      type="text"
                      value={specFrontCamera}
                      onChange={(e) => setSpecFrontCamera(e.target.value)}
                      placeholder="مثال: 32 MP"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">البطارية</label>
                    <input
                      type="text"
                      value={specBattery}
                      onChange={(e) => setSpecBattery(e.target.value)}
                      placeholder="مثال: 5000 mAh"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">سرعة الشحن</label>
                    <input
                      type="text"
                      value={specChargingSpeed}
                      onChange={(e) => setSpecChargingSpeed(e.target.value)}
                      placeholder="مثال: 80W"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">البصمة</label>
                    <input
                      type="text"
                      value={specFingerprint}
                      onChange={(e) => setSpecFingerprint(e.target.value)}
                      placeholder="مثال: تحت الشاشة"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">الشاشة</label>
                    <input
                      type="text"
                      value={specScreen}
                      onChange={(e) => setSpecScreen(e.target.value)}
                      placeholder="مثال: 6.7 بوصة AMOLED 120Hz"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">الشبكة</label>
                    <input
                      type="text"
                      value={specNetwork}
                      onChange={(e) => setSpecNetwork(e.target.value)}
                      placeholder="مثال: 5G / 4G LTE"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">نظام التشغيل</label>
                    <input
                      type="text"
                      value={specOs}
                      onChange={(e) => setSpecOs(e.target.value)}
                      placeholder="مثال: Android 14"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Product Gallery Settings Override */}
              <div className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] space-y-4">
                <div className="border-b border-[var(--border)] pb-2">
                  <span className="text-xs font-bold text-[#D6A83A]">
                    إعدادات معرض الصور الخاص بالمنتج (Product Gallery Settings)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1.5">تغيير الصور تلقائيًا (Auto Slide)</label>
                    <select
                      value={galleryAutoSlideMode}
                      onChange={(e) => setGalleryAutoSlideMode(e.target.value as 'default' | 'on' | 'off')}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none cursor-pointer"
                    >
                      <option value="default">حسب الإعداد الافتراضي للمتجر</option>
                      <option value="on">تشغيل تلقائي دائمًا لهذا المنتج</option>
                      <option value="off">إيقاف تلقائي دائمًا لهذا المنتج</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1.5">مدة التغيير (اختياري - بالثواني)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={galleryAutoSlideInterval || ''}
                      onChange={(e) => setGalleryAutoSlideInterval(e.target.value ? Number(e.target.value) : undefined)}
                      disabled={galleryAutoSlideMode === 'off'}
                      placeholder="مثال: 5"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-lg py-2 px-2.5 outline-none disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Product Installment Settings */}
              <div className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2 text-[#D6A83A]">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-bold">إعدادات التقسيط الخاصة بالمنتج</span>
                  </div>
                  <span className="text-[10px] text-[#AAB4C3]">تحديد إمكانية التقسيط والجهات المسموح بها لهذا المنتج</span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={installmentEnabled}
                      onChange={(e) => setInstallmentEnabled(e.target.checked)}
                      className="rounded bg-[var(--surface)] text-[#D6A83A] focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span>إتاحة نظام التقسيط لهذا المنتج</span>
                  </label>

                  {installmentEnabled && allInstallmentProviders.length > 0 && (
                    <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">جهات التقسيط المتاحة لهذا المنتج:</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {allowedProviderIds.length === 0 ? '(مسموح بجميع الجهات المفعّلة)' : `(محدد: ${allowedProviderIds.length})`}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {allInstallmentProviders.map((prov) => {
                          const isChecked = allowedProviderIds.length === 0 || allowedProviderIds.includes(prov.id);
                          return (
                            <label
                              key={prov.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-[#D6A83A]/10 border-[#D6A83A]/30 text-[var(--text-primary)]'
                                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-muted)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (allowedProviderIds.length === 0) {
                                      // Was all allowed, nothing changed
                                    } else {
                                      const next = [...allowedProviderIds, prov.id];
                                      if (next.length === allInstallmentProviders.length) {
                                        setAllowedProviderIds([]);
                                      } else {
                                        setAllowedProviderIds(next);
                                      }
                                    }
                                  } else {
                                    let current = allowedProviderIds.length === 0
                                      ? allInstallmentProviders.map(p => p.id)
                                      : [...allowedProviderIds];
                                    current = current.filter(id => id !== prov.id);
                                    setAllowedProviderIds(current);
                                  }
                                }}
                                className="rounded bg-[var(--surface-secondary)] text-[#D6A83A] focus:ring-0 w-3.5 h-3.5"
                              />
                              <ProviderLogo provider={prov} size="sm" />
                              <span className="text-xs font-bold">{prov.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">الوصف التفصيلي للمنتج</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب مواصفات المنتج، الخامة، المقاسات، والاستخدامات..."
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none leading-relaxed"
                />
              </div>

              {/* Features Tag Input (one per line) */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  المميزات الرئيسية (ميزة واحدة في كل سطر)
                </label>
                <textarea
                  rows={3}
                  value={featuresStr}
                  onChange={(e) => setFeaturesStr(e.target.value)}
                  placeholder="خامات مقاومة للماء&#10;سوست متينة وعالية الجودة&#10;ضمان لمدة عام كامل"
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none font-mono"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] text-xs font-bold rounded-xl border border-[var(--border)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving || isImageUploading}
                  className="px-6 py-2.5 bg-[#D6A83A] hover:bg-[#E0B64B] text-black text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ في Firebase...</span>
                    </>
                  ) : isImageUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري رفع الصور...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Product Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingProduct)}
        onClose={() => setDeletingProduct(null)}
        onConfirm={confirmDeleteProduct}
        title="حذف المنتج نهائيًا"
        itemName={deletingProduct?.name}
        message="هل أنت متأكد من حذف هذا المنتج؟ سيتم حذف بيانات المنتج نهائيًا من Firebase وقاعدة البيانات، بالإضافة إلى مسح جميع الصور المرتبطة به من Supabase Storage."
        warningNote="لا يمكن التراجع عن هذه العملية بعد إتمام الحذف."
        loading={deleteLoading}
      />

      {/* Stock Adjustment Modal */}
      {adjustStockProduct && (
        <StockAdjustModal
          product={adjustStockProduct}
          isOpen={Boolean(adjustStockProduct)}
          onClose={() => setAdjustStockProduct(null)}
          onSuccess={async () => {
            await loadData();
          }}
        />
      )}

      {/* Stock History Audit Modal */}
      {historyProduct && (
        <StockHistoryModal
          product={historyProduct}
          isOpen={Boolean(historyProduct)}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
}

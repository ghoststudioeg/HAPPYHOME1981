import { Category, Product, StoreSettings } from '../../types';

export const INITIAL_CATEGORIES: Omit<Category, 'id'>[] = [
  {
    name: 'شنط مدرسية',
    slug: 'school-bags',
    description: 'تشكيلة شنط مدرسية متينة وعصرية لجميع المراحل الدراسية',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 1,
    parentId: 'bags'
  },
  {
    name: 'شنط سفر',
    slug: 'travel-bags',
    description: 'حقائب سفر وترولي قوية وخفيفة الوزن بمقاسات مختلفة',
    image: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 2,
    parentId: 'bags'
  },
  {
    name: 'أجهزة منزلية',
    slug: 'home-appliances',
    description: 'أفضل الأجهزة لتسهيل الأعمال المنزلية اليومية بأعلى كفاءة',
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 3,
    parentId: 'home'
  },
  {
    name: 'أجهزة كهربائية',
    slug: 'electrical-appliances',
    description: 'أجهزة المطبخ والكهرباء من الماركات الموثوقة مع ضمان الجودة',
    image: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 4,
    parentId: 'home'
  },
  {
    name: 'موبايلات',
    slug: 'smartphones',
    description: 'أحدث الهواتف الذكية بجميع الفئات السعرية والمواصفات',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 5,
    parentId: 'electronics'
  },
  {
    name: 'تابلت',
    slug: 'tablets',
    description: 'أجهزة لوحية للمذاكرة والعمل والترفيه لجميع أفراد الأسرة',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 6,
    parentId: 'electronics'
  },
  {
    name: 'شاشات',
    slug: 'screens-tvs',
    description: 'شاشات ذكية وتلفزيونات فائقة الدقة 4K بأحجام متنوعة',
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 7,
    parentId: 'electronics'
  },
  {
    name: 'سماعات',
    slug: 'headphones',
    description: 'سماعات رأس وسماعات لاسلكية عازلة للضوضاء ونقاء فائق للصوت',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 8,
    parentId: 'electronics'
  },
  {
    name: 'اسبيكرات',
    slug: 'speakers',
    description: 'مكبرات صوت بلوتوث قوية للحفلات والمنزل بتصميم مقاوم للماء',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 9,
    parentId: 'electronics'
  },
  {
    name: 'إكسسوارات إلكترونية',
    slug: 'electronics-accessories',
    description: 'شواحن، كابلات، باور بانك، وحوامل هواتف عالية الجودة',
    image: 'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 10,
    parentId: 'electronics'
  },
  {
    name: 'أدوات منزلية',
    slug: 'household-goods',
    description: 'أدوات المطبخ والتنظيم وديكورات متميزة للمنزل العصري',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 11,
    parentId: 'home'
  },
  {
    name: 'هدايا وإكسسوارات',
    slug: 'gifts-and-accessories',
    description: 'مجموعة مميزة من الهدايا التذكارية والإكسسوارات لكل المناسبات',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 12,
    parentId: null
  },
  {
    name: 'أخرى',
    slug: 'other',
    description: 'منتجات ومستلزمات عامة لتلبية كافة الرغبات المتنوعة',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80',
    visibility: true,
    sortOrder: 13,
    parentId: null
  }
];

export const INITIAL_DEMO_PRODUCT: Omit<Product, 'id'> = {
  name: 'شنطة مدرسية للأطفال',
  slug: 'school-backpack-kids',
  categoryId: 'school-bags',
  categoryName: 'شنط مدرسية',
  sku: 'BAG-001',
  price: 799,
  oldPrice: 999,
  description: 'شنطة مدرسية عملية بتصميم عصري ومناسبة للاستخدام اليومي. مصنوعة من خامات مقاومة للماء مع بطانة مريحة للظهر وحمالات كتف مبطنة لراحة الطفل طوال اليوم المدرسي.',
  features: [
    'تصميم عملي',
    'مساحة تخزين جيدة',
    'جيوب متعددة',
    'مناسبة للمدرسة',
    'خامة متينة مقاومة للتمزق والماء',
    'حمالات كتف مبطنة ومريحة'
  ],
  mainImageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80',
  additionalImages: [
    'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?auto=format&fit=crop&w=1000&q=80'
  ],
  isAvailable: true,
  isFeatured: true,
  isPublished: true,
  stockQuantity: 15,
  lowStockThreshold: 3,
  stockStatus: 'in_stock',
  sortOrder: 1
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'البيت السعيد',
  tagline: 'قسط كل اللي نفسك فيه',
  logoUrl: '/logo.svg',
  whatsappNumber: '01555577122',
  phone: '01555577122',
  facebookUrl: 'https://facebook.com',
  instagramUrl: 'https://instagram.com',
  address: '25 شارع النور، منشية عبد المنعم رياض، أم بيومي، شبرا الخيمة',
  workingHours: 'يوميًا ما عدا يوم الأحد، من 12:00 صباحًا حتى 12:00 مساءً',
  heroTitle: 'كل ما يحتاجه بيتك في مكان واحد',
  heroSubtitle: 'منتجات مختارة للبيت، المدرسة، السفر، الإلكترونيات والهدايا بأسعار مناسبة وجودة تثق فيها.',
  galleryAutoSlideEnabled: true,
  galleryAutoSlideInterval: 5
};

import { Product } from '../types';
import { extractBrand } from './brandUtils';

export interface RecommendationOptions {
  limit?: number;
  priceTolerancePercent?: number;
}

/**
 * Checks whether two products belong to the same category/type
 */
export function isSameCategory(p1: Product, p2: Product): boolean {
  if (!p1 || !p2) return false;

  const cat1 = p1.categoryId?.trim();
  const cat2 = p2.categoryId?.trim();

  // 1. Primary key: categoryId is strictly enforced
  if (cat1 && cat2) {
    return cat1 === cat2;
  }

  // If one has a categoryId and the other doesn't, they are incompatible
  if (cat1 || cat2) {
    return false;
  }

  // 2. Secondary fallback only when both lack categoryId: non-empty categoryName or categorySlug
  const catName1 = (p1.categoryName || '').toLowerCase().trim();
  const catName2 = (p2.categoryName || '').toLowerCase().trim();
  if (catName1 && catName2 && catName1 === catName2) return true;

  const catSlug1 = ((p1 as any).categorySlug || '').toLowerCase().trim();
  const catSlug2 = ((p2 as any).categorySlug || '').toLowerCase().trim();
  if (catSlug1 && catSlug2 && catSlug1 === catSlug2) return true;

  return false;
}

/**
 * Checks whether a product belongs to the mobile/smartphone category
 */
export function isMobileProduct(product: Product): boolean {
  const catName = (product.categoryName || '').toLowerCase();
  const catId = (product.categoryId || '').toLowerCase();

  return (
    catName.includes('موبايل') ||
    catName.includes('هواتف') ||
    catName.includes('phone') ||
    catName.includes('smartphone') ||
    catId.includes('smartphones') ||
    catId.includes('mobile') ||
    catId.includes('phones')
  );
}

/**
 * Generates smart product recommendations prioritizing:
 * 1. Same categoryId (or name/slug fallback)
 * 2. Close price bracket (default ±20%, dynamically expanding if needed)
 * 3. Brand diversity
 * 4. In-stock availability
 * 5. Published status & excluding the current product
 */
export function getRecommendedProducts(
  currentProduct: Product,
  allProducts: Product[],
  options: RecommendationOptions = {}
): Product[] {
  const limit = options.limit || 4;
  const initialTolerance = (options.priceTolerancePercent || 20) / 100;

  if (!currentProduct || !allProducts || allProducts.length === 0) {
    return [];
  }

  const currentBrand = extractBrand(currentProduct.name);
  const currentPrice = currentProduct.price || 0;

  // Filter valid candidate pool - STRICTLY same category!
  const baseCandidates = allProducts.filter((p) => {
    // Never include current product
    if (p.id === currentProduct.id || p.slug === currentProduct.slug) return false;
    // Must be published
    if (p.isPublished === false) return false;
    // Must be in same category
    return isSameCategory(p, currentProduct);
  });

  if (baseCandidates.length === 0) {
    // NEVER fallback to unrelated categories
    return [];
  }

  // Scoring function for a candidate
  const scoreCandidate = (cand: Product, tolerance: number): number => {
    let score = 0;
    const candBrand = extractBrand(cand.name);
    const candPrice = cand.price || 0;

    // 1. Same categoryId matching gets bonus
    if (currentProduct.categoryId && cand.categoryId && cand.categoryId === currentProduct.categoryId) {
      score += 100;
    }

    // 2. Brand diversity bonus: different brand gets bonus
    if (candBrand.toLowerCase() !== currentBrand.toLowerCase()) {
      score += 50;
    } else {
      score += 10;
    }

    // 3. Price proximity scoring
    if (currentPrice > 0 && candPrice > 0) {
      const priceDiffPercent = Math.abs(candPrice - currentPrice) / currentPrice;
      if (priceDiffPercent <= tolerance) {
        score += 40 * (1 - priceDiffPercent / tolerance);
      } else {
        score += Math.max(0, 15 - priceDiffPercent * 10);
      }
    }

    // 4. Availability bonus
    if (cand.isAvailable) {
      score += 20;
    }

    // 5. Featured bonus
    if (cand.isFeatured) {
      score += 5;
    }

    return score;
  };

  // Attempt 1: Strict price tolerance (±20%)
  let candidatePool = baseCandidates.filter((p) => {
    if (currentPrice <= 0 || !p.price) return true;
    const diff = Math.abs(p.price - currentPrice) / currentPrice;
    return diff <= initialTolerance;
  });

  // Attempt 2: If pool too small, expand price tolerance to ±40%
  if (candidatePool.length < limit) {
    candidatePool = baseCandidates.filter((p) => {
      if (currentPrice <= 0 || !p.price) return true;
      const diff = Math.abs(p.price - currentPrice) / currentPrice;
      return diff <= 0.4;
    });
  }

  // Attempt 3: If still too small, use all base candidates in category
  if (candidatePool.length < limit) {
    candidatePool = baseCandidates;
  }

  // Score all candidates
  const scored = candidatePool.map((p) => ({
    product: p,
    brand: extractBrand(p.name),
    score: scoreCandidate(p, initialTolerance)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Diverse Brand Selection:
  const selected: Product[] = [];
  const chosenBrands = new Set<string>();

  // Pass 1: Pick top product of each unique brand (excluding current product's brand if possible)
  for (const item of scored) {
    if (selected.length >= limit) break;
    if (item.brand.toLowerCase() !== currentBrand.toLowerCase() && !chosenBrands.has(item.brand.toLowerCase())) {
      selected.push(item.product);
      chosenBrands.add(item.brand.toLowerCase());
    }
  }

  // Pass 2: If still need more, pick any distinct brand not yet chosen (including current brand if necessary)
  if (selected.length < limit) {
    for (const item of scored) {
      if (selected.length >= limit) break;
      if (!chosenBrands.has(item.brand.toLowerCase())) {
         selected.push(item.product);
         chosenBrands.add(item.brand.toLowerCase());
      }
    }
  }

  // Pass 3: Fill remaining slots with remaining highest scoring items
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((p) => p.id));
    for (const item of scored) {
      if (selected.length >= limit) break;
      if (!selectedIds.has(item.product.id)) {
        selected.push(item.product);
        selectedIds.add(item.product.id);
      }
    }
  }

  return selected;
}

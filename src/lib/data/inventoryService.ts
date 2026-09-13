import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product, StockStatus, InventoryLog, InventoryAdjustmentReason, InventorySummary } from '../../types';
import { notificationEngine } from '../notificationEngine';

export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export function deriveStockStatus(
  stockQuantity: number,
  lowStockThreshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
  isAvailable: boolean = true,
  isComingSoon: boolean = false
): StockStatus {
  if (isComingSoon) {
    return 'coming_soon';
  }
  if (stockQuantity <= 0 || !isAvailable) {
    return 'out_of_stock';
  }
  if (stockQuantity <= lowStockThreshold) {
    return 'low_stock';
  }
  return 'in_stock';
}

export const inventoryService = {
  /**
   * Derive status helper
   */
  deriveStockStatus,

  /**
   * Adjust product stock atomically using Firestore Transaction
   */
  async adjustStock(params: {
    productId: string;
    change: number; // e.g. +5, -2
    reason: InventoryAdjustmentReason;
    referenceId?: string;
    note?: string;
    adjustedBy?: string;
  }): Promise<{ previousStock: number; newStock: number; status: StockStatus }> {
    const { productId, change, reason, referenceId, note, adjustedBy } = params;

    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const prodRef = doc(db, 'products', productId);
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const logRef = doc(db, 'inventory_logs', logId);

    let previousStock = 0;
    let newStock = 0;
    let newStatus: StockStatus = 'in_stock';
    let productName = '';
    let productSku = '';
    let lowThreshold = DEFAULT_LOW_STOCK_THRESHOLD;

    await runTransaction(db, async (transaction) => {
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`المنتج المطلوب غير موجود (${productId})`);
      }

      const prodData = prodSnap.data() as Product;
      productName = prodData.name;
      productSku = prodData.sku || '';
      lowThreshold = typeof prodData.lowStockThreshold === 'number' ? prodData.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;

      // Authoritative previous stock
      previousStock = typeof prodData.stockQuantity === 'number'
        ? prodData.stockQuantity
        : (prodData.isAvailable !== false ? 10 : 0);

      // Prevent dropping below zero unless deliberate adjustment
      newStock = Math.max(0, previousStock + change);

      const isComingSoon = prodData.stockStatus === 'coming_soon';
      const nextAvailable = isComingSoon ? false : newStock > 0;
      newStatus = deriveStockStatus(newStock, lowThreshold, nextAvailable, isComingSoon);

      const now = new Date().toISOString();

      // Update product document
      transaction.update(prodRef, {
        stockQuantity: newStock,
        stockStatus: newStatus,
        isAvailable: nextAvailable,
        updatedAt: now
      });

      // Write immutable inventory log
      const logData: InventoryLog = {
        id: logId,
        productId,
        productName,
        productSku,
        change,
        previousStock,
        newStock,
        reason,
        referenceId: referenceId || undefined,
        note: note || undefined,
        adjustedBy: adjustedBy || 'admin',
        timestamp: now
      };

      transaction.set(logRef, logData);
    });

    // Outside transaction notifications for admin awareness
    try {
      if (newStock === 0 && previousStock > 0) {
        await notificationEngine.fireStoreEvent({
          eventType: 'OUT_OF_STOCK',
          payload: {
            productId,
            productName,
            stock: 0
          }
        });
      } else if (newStock > 0 && newStock <= lowThreshold && (previousStock > lowThreshold || previousStock === 0)) {
        await notificationEngine.fireStoreEvent({
          eventType: 'LOW_STOCK',
          payload: {
            productId,
            productName,
            stock: newStock
          }
        });
      } else if (previousStock === 0 && newStock > 0) {
        await notificationEngine.fireStoreEvent({
          eventType: 'RESTOCKED',
          payload: {
            productId,
            productName,
            stock: newStock
          }
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch stock notification:', e);
    }

    return { previousStock, newStock, status: newStatus };
  },

  /**
   * Set exact stock quantity and threshold for a product
   */
  async setProductStock(params: {
    productId: string;
    newQuantity: number;
    lowStockThreshold?: number;
    showExactStockToCustomer?: boolean;
    stockStatusOverride?: StockStatus;
    reason?: InventoryAdjustmentReason;
    note?: string;
    adjustedBy?: string;
  }): Promise<{ previousStock: number; newStock: number }> {
    const {
      productId,
      newQuantity,
      lowStockThreshold,
      showExactStockToCustomer,
      stockStatusOverride,
      reason = 'manual_adjustment',
      note,
      adjustedBy
    } = params;

    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const prodRef = doc(db, 'products', productId);
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const logRef = doc(db, 'inventory_logs', logId);

    let previousStock = 0;
    let finalStock = Math.max(0, Math.floor(newQuantity));
    let productName = '';
    let productSku = '';
    let threshold = lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    await runTransaction(db, async (transaction) => {
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`المنتج غير موجود (${productId})`);
      }

      const prodData = prodSnap.data() as Product;
      productName = prodData.name;
      productSku = prodData.sku || '';
      previousStock = typeof prodData.stockQuantity === 'number'
        ? prodData.stockQuantity
        : (prodData.isAvailable !== false ? 10 : 0);

      threshold = lowStockThreshold !== undefined
        ? lowStockThreshold
        : (typeof prodData.lowStockThreshold === 'number' ? prodData.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD);

      const isComingSoon = stockStatusOverride === 'coming_soon' || (prodData.stockStatus === 'coming_soon' && !stockStatusOverride);
      const isAvailable = isComingSoon ? false : finalStock > 0;
      const status = stockStatusOverride || deriveStockStatus(finalStock, threshold, isAvailable, isComingSoon);

      const now = new Date().toISOString();

      const updateData: Partial<Product> = {
        stockQuantity: finalStock,
        lowStockThreshold: threshold,
        stockStatus: status,
        isAvailable,
        updatedAt: now
      };

      if (showExactStockToCustomer !== undefined) {
        updateData.showExactStockToCustomer = showExactStockToCustomer;
      }

      transaction.update(prodRef, updateData);

      const change = finalStock - previousStock;
      const logData: InventoryLog = {
        id: logId,
        productId,
        productName,
        productSku,
        change,
        previousStock,
        newStock: finalStock,
        reason,
        note: note || undefined,
        adjustedBy: adjustedBy || 'admin',
        timestamp: now
      };

      transaction.set(logRef, logData);
    });

    // Notify if needed
    try {
      if (finalStock === 0 && previousStock > 0) {
        await notificationEngine.fireStoreEvent({
          eventType: 'OUT_OF_STOCK',
          payload: { productId, productName, stock: 0 }
        });
      } else if (finalStock > 0 && finalStock <= threshold && previousStock > threshold) {
        await notificationEngine.fireStoreEvent({
          eventType: 'LOW_STOCK',
          payload: { productId, productName, stock: finalStock }
        });
      } else if (previousStock === 0 && finalStock > 0) {
        await notificationEngine.fireStoreEvent({
          eventType: 'RESTOCKED',
          payload: { productId, productName, stock: finalStock }
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch stock notification:', e);
    }

    return { previousStock, newStock: finalStock };
  },

  /**
   * Get historical inventory logs for a specific product
   */
  async getProductLogs(productId: string, maxLimit: number = 50): Promise<InventoryLog[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, 'inventory_logs');
      const q = query(
        colRef,
        where('productId', '==', productId),
        orderBy('timestamp', 'desc'),
        limit(maxLimit)
      );
      const snap = await getDocs(q);
      const logs: InventoryLog[] = [];
      snap.forEach((d) => logs.push(d.data() as InventoryLog));
      return logs;
    } catch (err) {
      console.error(`Failed to fetch inventory logs for product ${productId}:`, err);
      // Fallback query without compound index if needed
      try {
        const colRef = collection(db, 'inventory_logs');
        const q = query(colRef, where('productId', '==', productId), limit(maxLimit));
        const snap = await getDocs(q);
        const logs: InventoryLog[] = [];
        snap.forEach((d) => logs.push(d.data() as InventoryLog));
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (fallbackErr) {
        console.error('Fallback fetch logs error:', fallbackErr);
        return [];
      }
    }
  },

  /**
   * Get all latest inventory logs across all products (Admin stock audit stream)
   */
  async getAllInventoryLogs(maxLimit: number = 100): Promise<InventoryLog[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, 'inventory_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxLimit));
      const snap = await getDocs(q);
      const logs: InventoryLog[] = [];
      snap.forEach((d) => logs.push(d.data() as InventoryLog));
      return logs;
    } catch (err) {
      console.error('Failed to fetch all inventory logs:', err);
      return [];
    }
  },

  /**
   * Compute inventory summary statistics
   */
  calculateInventorySummary(products: Product[]): InventorySummary {
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let comingSoonCount = 0;
    let totalStockUnits = 0;

    for (const prod of products) {
      const stock = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.isAvailable ? 10 : 0);
      const threshold = typeof prod.lowStockThreshold === 'number' ? prod.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
      const status = prod.stockStatus || deriveStockStatus(stock, threshold, prod.isAvailable);

      totalStockUnits += Math.max(0, stock);

      if (status === 'coming_soon') {
        comingSoonCount++;
      } else if (status === 'out_of_stock' || stock <= 0 || !prod.isAvailable) {
        outOfStockCount++;
      } else if (status === 'low_stock' || stock <= threshold) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    }

    return {
      totalProducts: products.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      comingSoonCount,
      totalStockUnits
    };
  }
};

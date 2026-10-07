import { supabaseDb } from './supabaseDb';
import { InventoryLog } from '../../types';

export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export function deriveStockStatus(arg1: any, arg2?: any, arg3?: any, arg4?: any): 'in_stock' | 'out_of_stock' | 'coming_soon' {
  const stockQuantity = typeof arg1 === 'number' ? arg1 : 0;
  let isAvailable = true;

  if (typeof arg2 === 'number' && typeof arg3 === 'boolean') {
    // Matches: (stock, threshold, isAvailable) or (cleanStockQty, cleanThreshold, computedAvailable, isComingSoon)
    const isComingSoon = typeof arg4 === 'boolean' ? arg4 : false;
    isAvailable = isComingSoon ? false : arg3;
  } else if (typeof arg2 === 'boolean') {
    // Matches: (stockQuantity, isAvailable, ...)
    isAvailable = arg2;
  }

  if (!isAvailable) return 'coming_soon';
  if (stockQuantity <= 0) return 'out_of_stock';
  return 'in_stock';
}

export const inventoryService = {
  async getInventoryLogs(): Promise<InventoryLog[]> {
    try {
      const logs = await supabaseDb.getCollection<InventoryLog>('inventory_logs');
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  },

  async getProductLogs(productId: string, limitCount = 50): Promise<InventoryLog[]> {
    try {
      const logs = await this.getInventoryLogs();
      return logs.filter((l) => l.productId === productId).slice(0, limitCount);
    } catch {
      return [];
    }
  },

  async logStockChange(logData: Omit<InventoryLog, 'id' | 'timestamp'>): Promise<string> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const log: InventoryLog = {
      ...logData,
      id,
      timestamp: new Date().toISOString()
    };
    await supabaseDb.setDoc('inventory_logs', id, log);
    return id;
  },

  async adjustStock(payload: {
    productId: string;
    change: number;
    reason: string;
    note?: string;
    adjustedBy?: string;
  }): Promise<void> {
    const { productId, change, reason, note } = payload;
    const product = await supabaseDb.getDoc<any>('products', productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const currentQty = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
    const newQty = Math.max(0, currentQty + change);
    
    await supabaseDb.updateDoc('products', productId, { stockQuantity: newQty });
    
    await this.logStockChange({
      productId,
      productName: product.name || '',
      sku: product.sku || '',
      type: change > 0 ? 'in' : 'out',
      quantity: Math.abs(change),
      reason: reason || 'Adjustment',
      note: note || '',
      previousStock: currentQty,
      newStock: newQty,
      operator: 'admin'
    });
  },

  async setProductStock(payload: {
    productId: string;
    newQuantity: number;
    reason: string;
    note?: string;
    adjustedBy?: string;
  }): Promise<void> {
    const { productId, newQuantity, reason, note } = payload;
    const product = await supabaseDb.getDoc<any>('products', productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const currentQty = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
    const newQty = Math.max(0, newQuantity);
    
    await supabaseDb.updateDoc('products', productId, { stockQuantity: newQty });
    
    await this.logStockChange({
      productId,
      productName: product.name || '',
      sku: product.sku || '',
      type: newQty >= currentQty ? 'in' : 'out',
      quantity: Math.abs(newQty - currentQty),
      reason: reason || 'Set Stock',
      note: note || '',
      previousStock: currentQty,
      newStock: newQty,
      operator: 'admin'
    });
  },

  deriveStockStatus(stockQuantity: any, isAvailable?: any, threshold?: any, options?: any): 'in_stock' | 'out_of_stock' | 'coming_soon' {
    return deriveStockStatus(stockQuantity, isAvailable, threshold, options);
  },

  calculateInventorySummary(products: any[]): {
    totalProducts: number;
    totalStockUnits: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    comingSoonCount: number;
  } {
    let totalProducts = 0;
    let totalStockUnits = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let comingSoonCount = 0;

    for (const p of products || []) {
      if (p.isDeleted) continue;
      totalProducts++;
      const q = p.stockQuantity ?? 0;
      totalStockUnits += q;

      if (!p.isAvailable) {
        comingSoonCount++;
      } else if (q <= 0) {
        outOfStockCount++;
      } else if (q <= (p.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD)) {
        lowStockCount++;
        inStockCount++;
      } else {
        inStockCount++;
      }
    }

    return {
      totalProducts,
      totalStockUnits,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      comingSoonCount
    };
  }
};

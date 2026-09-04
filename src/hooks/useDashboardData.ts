'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Branch, MasterProduct, Shipment, BranchInventory, SalesTransaction, ConsolidatedFinancials } from '@/types';

interface UseDashboardDataOptions {
  currentUser: User | null;
}

interface UseDashboardDataReturn {
  branches: Branch[];
  products: MasterProduct[];
  shipments: Shipment[];
  inventories: BranchInventory[];
  transactions: SalesTransaction[];
  analytics: ConsolidatedFinancials | null;
  refreshData: () => Promise<void>;
}

function buildUrl(base: string, currentUser: User | null, params?: Record<string, string>): string {
  const url = new URL(base, window.location.origin);
  if (currentUser?.role === 'CABANG_STAFF' && currentUser.branchId) {
    url.searchParams.set('branchId', currentUser.branchId);
  }
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function useDashboardData({ currentUser }: UseDashboardDataOptions): UseDashboardDataReturn {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [inventories, setInventories] = useState<BranchInventory[]>([]);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [analytics, setAnalytics] = useState<ConsolidatedFinancials | null>(null);

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBranches(data.data.branches);
      })
      .catch(() => {});
  }, []);

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const cb = String(Date.now());

      const [pRes, sRes, iRes, txRes, aRes] = await Promise.all([
        fetch(`/api/products?cb=${cb}`, { cache: 'no-store' }),
        fetch(buildUrl('/api/shipments', currentUser, { cb }), { cache: 'no-store' }),
        fetch(buildUrl('/api/inventory', currentUser, { cb }), { cache: 'no-store' }),
        fetch(buildUrl('/api/pos', currentUser, { cb }), { cache: 'no-store' }),
        fetch(buildUrl('/api/analytics', currentUser, { cb }), { cache: 'no-store' }),
      ]);

      const [pData, sData, iData, txData, aData] = await Promise.all([
        pRes.json(),
        sRes.json(),
        iRes.json(),
        txRes.json(),
        aRes.json(),
      ]);

      if (pData.success) setProducts(pData.data);
      if (sData.success) setShipments(sData.data);
      if (iData.success) setInventories(iData.data);
      if (txData.success) setTransactions(txData.data);
      if (aData.success) setAnalytics(aData.data);
    } catch {
      // Refresh error — silent
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) refreshData();
  }, [currentUser, refreshData]);

  return { branches, products, shipments, inventories, transactions, analytics, refreshData };
}

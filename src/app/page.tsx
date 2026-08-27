'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  Branch,
  MasterProduct,
  Shipment,
  BranchInventory,
  SalesTransaction,
  ConsolidatedFinancials,
} from '@/types';
import { Navbar } from '@/components/ui/Navbar';
import { Sidebar, TabType } from '@/components/ui/Sidebar';
import { HQMasterModule } from '@/components/modules/HQMasterModule';
import { HQDispatchModule } from '@/components/modules/HQDispatchModule';
import { BranchReceiveModule } from '@/components/modules/BranchReceiveModule';
import { BranchPOSModule } from '@/components/modules/BranchPOSModule';
import { LiveProductsModule } from '@/components/modules/LiveProductsModule';
import { HQAnalyticsModule } from '@/components/modules/HQAnalyticsModule';
import { RevenueHistoryModule } from '@/components/modules/RevenueHistoryModule';
import { GlobalInventoryModule } from '@/components/modules/GlobalInventoryModule';
import { BellRing } from 'lucide-react';

export default function Home() {
  const { currentUser, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data states
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [inventories, setInventories] = useState<BranchInventory[]>([]);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [analytics, setAnalytics] = useState<ConsolidatedFinancials | null>(null);

  // SSE Realtime state
  const [sseConnected, setSseConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Protected route check
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  // Fetch branches
  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBranches(data.data.branches);
        }
      })
      .catch((err) => console.error('Error fetching branches:', err));
  }, []);

  // Refresh data function
  const refreshData = useCallback(async () => {
    try {
      // 1. Fetch Products
      const pRes = await fetch('/api/products');
      const pData = await pRes.json();
      if (pData.success) setProducts(pData.data);

      // 2. Fetch Shipments
      const sUrl =
        currentUser?.role === 'CABANG_STAFF' && currentUser.branchId
          ? `/api/shipments?branchId=${currentUser.branchId}`
          : '/api/shipments';
      const sRes = await fetch(sUrl);
      const sData = await sRes.json();
      if (sData.success) setShipments(sData.data);

      // 3. Fetch Inventory
      const iUrl =
        currentUser?.role === 'CABANG_STAFF' && currentUser.branchId
          ? `/api/inventory?branchId=${currentUser.branchId}`
          : '/api/inventory';
      const iRes = await fetch(iUrl);
      const iData = await iRes.json();
      if (iData.success) setInventories(iData.data);

      // 4. Fetch POS Transactions
      const txUrl =
        currentUser?.role === 'CABANG_STAFF' && currentUser.branchId
          ? `/api/pos?branchId=${currentUser.branchId}`
          : '/api/pos';
      const txRes = await fetch(txUrl);
      const txData = await txRes.json();
      if (txData.success) setTransactions(txData.data);

      // 5. Fetch Analytics
      const aUrl =
        currentUser?.role === 'CABANG_STAFF' && currentUser.branchId
          ? `/api/analytics?branchId=${currentUser.branchId}`
          : '/api/analytics';
      const aRes = await fetch(aUrl);
      const aData = await aRes.json();
      if (aData.success) setAnalytics(aData.data);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      if (
        currentUser.role === 'HQ_ADMIN' &&
        (activeTab === 'pos' || activeTab === 'reception' || activeTab === 'live_products')
      ) {
        setActiveTab('analytics');
      } else if (
        currentUser.role === 'CABANG_STAFF' &&
        (activeTab === 'master' || activeTab === 'dispatch' || activeTab === 'inventory_global')
      ) {
        setActiveTab('analytics');
      }
      refreshData();
    }
  }, [currentUser, refreshData]);

  // Setup Server-Sent Events (SSE) Listener
  useEffect(() => {
    const eventSource = new EventSource('/api/realtime/shipments');

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PING') return;

        if (payload.type === 'SHIPMENT_CREATED') {
          showToast(`🔔 Notifikasi Kiriman Baru dari HQ: ${payload.shipmentNumber}`);
          refreshData();
        } else if (payload.type === 'SHIPMENT_RECEIVED') {
          showToast(`✅ Cabang telah memvalidasi penerimaan pengiriman!`);
          refreshData();
        } else if (payload.type === 'TRANSACTION_CREATED') {
          showToast(`🛒 Transaksi POS Berhasil: ${payload.transactionNumber}`);
          refreshData();
        }
      } catch (err) {
        console.error('SSE Error parsing:', err);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [refreshData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500 font-medium">
        Memverifikasi sesi login...
      </div>
    );
  }

  const pendingReceptionCount = shipments.filter((s) => s.status === 'DIKIRIM').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans selection:bg-slate-200">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 animate-bounce bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 border border-slate-700">
          <BellRing className="w-4 h-4 animate-spin text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingReceptionCount={pendingReceptionCount}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          sseConnected={sseConnected}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={handleLogout}
        />

        {/* Dynamic Tab Body Content */}
        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {currentUser.role === 'HQ_ADMIN' && (
            <>
              {activeTab === 'analytics' && (
                <HQAnalyticsModule analytics={analytics} currentUser={currentUser} />
              )}
              {activeTab === 'master' && (
                <HQMasterModule products={products} currentUser={currentUser} onRefresh={refreshData} />
              )}
              {activeTab === 'dispatch' && (
                <HQDispatchModule
                  products={products}
                  shipments={shipments}
                  branches={branches}
                  currentUser={currentUser}
                  onRefresh={refreshData}
                />
              )}
              {activeTab === 'inventory_global' && <GlobalInventoryModule inventories={inventories} />}
              {activeTab === 'history' && (
                <RevenueHistoryModule transactions={transactions} branches={branches} currentUser={currentUser} />
              )}
            </>
          )}

          {currentUser.role === 'CABANG_STAFF' && (
            <>
              {activeTab === 'analytics' && (
                <HQAnalyticsModule analytics={analytics} currentUser={currentUser} />
              )}
              {activeTab === 'pos' && (
                <BranchPOSModule inventories={inventories} currentUser={currentUser} onRefresh={refreshData} />
              )}
              {activeTab === 'reception' && (
                <BranchReceiveModule
                  shipments={shipments}
                  currentUser={currentUser}
                  onRefresh={refreshData}
                  sseConnected={sseConnected}
                />
              )}
              {activeTab === 'live_products' && (
                <LiveProductsModule inventories={inventories} currentUser={currentUser} />
              )}
              {activeTab === 'history' && (
                <RevenueHistoryModule transactions={transactions} branches={branches} currentUser={currentUser} />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 font-medium">
          KangKebab Multichannel System © 2026 — Built with Next.js, Prisma, Local SQLite &amp; SSE Realtime
        </footer>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { TabType } from '@/types';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { HQMasterModule } from '@/components/modules/HQMasterModule';
import { HQDispatchModule } from '@/components/modules/HQDispatchModule';
import { BranchReceiveModule } from '@/components/modules/BranchReceiveModule';
import { BranchPOSModule } from '@/components/modules/BranchPOSModule';
import { LiveProductsModule } from '@/components/modules/LiveProductsModule';
import { HQAnalyticsModule } from '@/components/modules/HQAnalyticsModule';
import { RevenueHistoryModule } from '@/components/modules/RevenueHistoryModule';
import { GlobalInventoryModule } from '@/components/modules/GlobalInventoryModule';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSSE } from '@/hooks/useSSE';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { BellRing } from 'lucide-react';

export default function Home() {
  const { currentUser, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { branches, products, shipments, inventories, transactions, analytics, refreshData } = useDashboardData({ currentUser });

  const handleSSERefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const { connected: sseConnected, toastMessage } = useSSE({
    currentUser,
    onShipmentCreated: handleSSERefresh,
    onShipmentReceived: handleSSERefresh,
    onTransactionCreated: handleSSERefresh,
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

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
    }
  }, [currentUser, activeTab]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs text-muted-foreground font-medium">
        Memverifikasi sesi login...
      </div>
    );
  }

  const pendingReceptionCount = shipments.filter((s) => s.status === 'DIKIRIM').length;

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-primary/20 relative">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 animate-bounce bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 border border-slate-700">
          <BellRing className="w-4 h-4 animate-spin text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingReceptionCount={pendingReceptionCount}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          sseConnected={sseConnected}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            {currentUser.role === 'HQ_ADMIN' && (
              <>
                {activeTab === 'analytics' && <HQAnalyticsModule analytics={analytics} currentUser={currentUser} />}
                {activeTab === 'master' && <HQMasterModule products={products} currentUser={currentUser} onRefresh={refreshData} />}
                {activeTab === 'dispatch' && (
                  <HQDispatchModule products={products} shipments={shipments} branches={branches} currentUser={currentUser} onRefresh={refreshData} />
                )}
                {activeTab === 'inventory_global' && <GlobalInventoryModule inventories={inventories} />}
                {activeTab === 'history' && <RevenueHistoryModule transactions={transactions} branches={branches} currentUser={currentUser} onRefresh={() => refreshData()} />}
              </>
            )}

            {currentUser.role === 'CABANG_STAFF' && (
              <>
                {activeTab === 'analytics' && <HQAnalyticsModule analytics={analytics} currentUser={currentUser} />}
                {activeTab === 'pos' && <BranchPOSModule inventories={inventories} currentUser={currentUser} onRefresh={refreshData} />}
                {activeTab === 'reception' && (
                  <BranchReceiveModule shipments={shipments} currentUser={currentUser} onRefresh={refreshData} sseConnected={sseConnected} />
                )}
                {activeTab === 'live_products' && <LiveProductsModule inventories={inventories} currentUser={currentUser} onRefresh={() => refreshData()} />}
                {activeTab === 'history' && <RevenueHistoryModule transactions={transactions} branches={branches} currentUser={currentUser} onRefresh={() => refreshData()} />}
              </>
            )}
          </ErrorBoundary>
        </main>

        <Footer />
      </div>
    </div>
  );
}

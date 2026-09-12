'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { TabType } from '@/types';
import { AppSidebar } from '@/components/app-sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { HQMasterModule } from '@/components/modules/HQMasterModule';
import { HQDispatchModule } from '@/components/modules/HQDispatchModule';
import { BranchReceiveModule } from '@/components/modules/BranchReceiveModule';
import { BranchPOSModule } from '@/components/modules/BranchPOSModule';
import { LiveProductsModule } from '@/components/modules/LiveProductsModule';
import { HQAnalyticsModule } from '@/components/modules/HQAnalyticsModule';
import { RevenueHistoryModule } from '@/components/modules/RevenueHistoryModule';
import { GlobalInventoryModule } from '@/components/modules/GlobalInventoryModule';
import { ResellerPricingModule } from '@/components/modules/ResellerPricingModule';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSSE } from '@/hooks/useSSE';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { BellRing } from 'lucide-react';

export default function Home() {
  const { currentUser, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('analytics');

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
    <SidebarProvider>
      <AppSidebar
        currentUser={currentUser}
        activeTab={activeTab}
        pendingReceptionCount={pendingReceptionCount}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      />

      <SidebarInset>
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          sseConnected={sseConnected}
          onLogout={handleLogout}
        />

        {toastMessage && (
          <div className="fixed top-16 right-4 z-50 animate-bounce bg-foreground text-background font-bold text-xs px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2">
            <BellRing className="w-4 h-4 animate-spin text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <main className="flex-1 px-4 md:px-6 py-6 space-y-6 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            {currentUser.role === 'HQ_ADMIN' && (
              <>
                {activeTab === 'analytics' && <HQAnalyticsModule analytics={analytics} currentUser={currentUser} />}
                {activeTab === 'master' && <HQMasterModule products={products} currentUser={currentUser} onRefresh={refreshData} />}
                {activeTab === 'dispatch' && (
                  <HQDispatchModule products={products} shipments={shipments} branches={branches} currentUser={currentUser} onRefresh={refreshData} />
                )}
                {activeTab === 'inventory_global' && <GlobalInventoryModule inventories={inventories} />}
                {activeTab === 'reseller_prices' && (
                  <ResellerPricingModule inventories={inventories} branches={branches} currentUser={currentUser} onRefresh={refreshData} />
                )}
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
      </SidebarInset>
    </SidebarProvider>
  );
}

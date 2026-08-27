'use client';

import React from 'react';
import { User } from '@/types';
import { Radio, Menu, ChevronRight, Home, LogOut } from 'lucide-react';
import { TabType } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavbarProps {
  currentUser: User | null;
  activeTab: TabType;
  sseConnected: boolean;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  sseConnected,
  onOpenMobileMenu,
  onLogout,
}) => {
  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'analytics':
        return 'Konsolidasi HQ';
      case 'master':
        return 'Master Data & Pricing';
      case 'dispatch':
        return 'Pengiriman ke Cabang';
      case 'inventory_global':
        return 'Stok Opname Cabang';
      case 'pos':
        return 'POS Kasir Multichannel';
      case 'reception':
        return 'Terima & Validasi Barang';
      case 'live_products':
        return 'Katalog Live Product';
      case 'history':
        return 'Riwayat Transaksi';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
      {/* Left: Mobile Menu Toggle & Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileMenu}
          className="md:hidden text-slate-700 h-8 w-8"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Breadcrumb Trail */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <Home className="w-3.5 h-3.5 text-slate-400" />
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-bold">{getTabTitle(activeTab)}</span>
        </div>
      </div>

      {/* Right: SSE Live Status & Logout */}
      <div className="flex items-center space-x-3">
        {/* SSE Status Pill */}
        <Badge
          variant="outline"
          className={`flex items-center space-x-1.5 px-3 py-1 font-semibold rounded-full ${
            sseConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <Radio className={`w-3 h-3 ${sseConnected ? 'animate-pulse text-emerald-600' : 'text-amber-600'}`} />
          <span className="hidden sm:inline">{sseConnected ? 'Realtime SSE Active' : 'Connecting SSE...'}</span>
        </Badge>

        {/* Logout Quick Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onLogout}
          className="text-xs font-semibold h-8"
        >
          <LogOut className="w-3.5 h-3.5 mr-2 text-slate-500" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
};

'use client';

import React from 'react';
import { User } from '@/types';
import {
  LayoutDashboard,
  PackageCheck,
  Truck,
  ShoppingBag,
  History,
  Boxes,
  Layers,
  Store,
  LogOut,
  X,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export type TabType =
  | 'analytics'
  | 'master'
  | 'dispatch'
  | 'reception'
  | 'pos'
  | 'live_products'
  | 'inventory_global'
  | 'history';

interface TabItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface SidebarProps {
  currentUser: User | null;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingReceptionCount?: number;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  pendingReceptionCount = 0,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  if (!currentUser) return null;

  const role = currentUser.role;

  const hqTabs: TabItem[] = [
    { id: 'analytics', label: 'Konsolidasi HQ', icon: LayoutDashboard },
    { id: 'master', label: 'Master Data & Pricing', icon: Boxes },
    { id: 'dispatch', label: 'Pengiriman ke Cabang', icon: Truck },
    { id: 'inventory_global', label: 'Stok Opname Cabang', icon: Layers },
    { id: 'history', label: 'Riwayat Omzet', icon: History },
  ];

  const branchTabs: TabItem[] = [
    { id: 'analytics', label: 'Analytics Penjualan', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Kasir Multichannel', icon: ShoppingBag },
    {
      id: 'reception',
      label: 'Terima & Validasi Barang',
      icon: PackageCheck,
      badge: pendingReceptionCount > 0 ? pendingReceptionCount : undefined,
    },
    { id: 'live_products', label: 'Katalog Live Product', icon: Store },
    { id: 'history', label: 'Riwayat Transaksi', icon: History },
  ];

  const currentTabs = role === 'HQ_ADMIN' ? hqTabs : branchTabs;

  const SidebarContent = () => (
    <div className="flex flex-col justify-between h-full text-slate-800">
      <div className="p-4 space-y-5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
            KK
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 tracking-tight">KangKebab</div>
            <div className="text-[10px] text-slate-500 font-medium">Multichannel POS</div>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search..."
            readOnly
            className="pl-8 bg-slate-50 border-slate-200 text-xs h-9"
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
              {role === 'HQ_ADMIN' ? 'Headquarter' : 'Operasional Cabang'}
            </div>
            <div className="space-y-1">
              {currentTabs.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <Button
                    key={t.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={`w-full justify-start text-xs font-semibold h-10 ${
                      isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    onClick={() => {
                      onSelectTab(t.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                  >
                    <Icon className="w-4 h-4 mr-2.5" />
                    <span className="flex-1 text-left">{t.label}</span>
                    {t.badge && (
                      <Badge variant="destructive" className="ml-auto px-1.5 py-0 text-[10px]">
                        {t.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-slate-900 text-white text-xs font-bold">
              {currentUser.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {role === 'HQ_ADMIN' ? 'HQ Admin' : currentUser.branch?.name || 'Cabang Madiun'}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0 flex-shrink-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpenMobile} onOpenChange={(open) => !open && onCloseMobile?.()}>
        <SheetContent side="left" className="w-[80vw] max-w-xs p-0 bg-white">
          <SheetHeader className="hidden">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
};

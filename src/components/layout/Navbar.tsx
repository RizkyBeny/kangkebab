'use client';

import React from 'react';
import { User, TabType } from '@/types';
import { TAB_LABELS } from '@/constants';
import { Radio, Menu, ChevronRight, Home, LogOut } from 'lucide-react';
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
  activeTab,
  sseConnected,
  onOpenMobileMenu,
  onLogout,
}) => {
  return (
    <header className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-20 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm transition-all">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileMenu}
          className="md:hidden text-foreground h-8 w-8 hover:bg-primary/10"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground font-medium">
          <Home className="w-3.5 h-3.5 text-primary/70" />
          <ChevronRight className="w-3 h-3 text-border" />
          <span className="text-foreground font-bold tracking-tight">{TAB_LABELS[activeTab]}</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
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

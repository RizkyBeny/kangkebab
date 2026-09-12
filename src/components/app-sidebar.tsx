"use client"

import {
  LayoutDashboard,
  Boxes,
  Truck,
  Percent,
  Layers,
  History,
  ShoppingBag,
  PackageCheck,
  Store,
  LogOut,
  ChevronsUpDown,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { User, TabType } from "@/types"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface AppSidebarProps {
  currentUser: User;
  activeTab: TabType;
  pendingReceptionCount?: number;
  onSelectTab: (tab: TabType) => void;
  onLogout: () => void;
}

const hqNav: NavItem[] = [
  { id: "analytics", label: "Konsolidasi HQ", icon: LayoutDashboard },
  { id: "master", label: "Master Data & Pricing", icon: Boxes },
  { id: "dispatch", label: "Pengiriman ke Cabang", icon: Truck },
  { id: "reseller_prices", label: "Harga Reseller", icon: Percent },
  { id: "inventory_global", label: "Stok Opname Cabang", icon: Layers },
  { id: "history", label: "Riwayat Omzet", icon: History },
]

const branchNav: NavItem[] = [
  { id: "analytics", label: "Analytics Penjualan", icon: LayoutDashboard },
  { id: "pos", label: "POS Kasir Multichannel", icon: ShoppingBag },
];

const branchNavExtra = (pendingReceptionCount: number) => [
  { id: "reception" as TabType, label: "Terima & Validasi Barang", icon: PackageCheck, badge: pendingReceptionCount > 0 ? pendingReceptionCount : undefined },
  { id: "live_products" as TabType, label: "Katalog Live Product", icon: Store },
  { id: "history" as TabType, label: "Riwayat Transaksi", icon: History },
]

function SidebarNav({ items, activeTab, onSelectTab }: { items: NavItem[]; activeTab: TabType; onSelectTab: (tab: TabType) => void }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={item.label}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
            {item.badge != null && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({
  currentUser,
  activeTab,
  pendingReceptionCount = 0,
  onSelectTab,
  onLogout,
}: AppSidebarProps) {
  const isHq = currentUser.role === "HQ_ADMIN";
  const groupLabel = isHq ? "Headquarter" : "Operasional Cabang";
  const navItems: NavItem[] = isHq ? hqNav : [...branchNav, ...branchNavExtra(pendingReceptionCount)];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
                KK
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">KangKebab</span>
                <span className="truncate text-[11px] text-muted-foreground">Multichannel POS</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarNav items={navItems} activeTab={activeTab} onSelectTab={onSelectTab} />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="size-6 rounded-lg ring-1 ring-sidebar-border">
                  <AvatarFallback className="text-[11px] font-semibold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{currentUser.name}</span>
                  <span className="truncate text-[11px]">{isHq ? "HQ Admin" : currentUser.branch?.name || "Cabang"}</span>
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{currentUser.name}</span>
                  <span className="font-normal text-muted-foreground">{currentUser.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={cn("w-full cursor-pointer")}
                  onClick={onLogout}
                >
                  <LogOut />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
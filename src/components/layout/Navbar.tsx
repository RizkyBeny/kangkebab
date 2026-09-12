"use client";

import React from "react";
import { User, TabType } from "@/types";
import { TAB_LABELS } from "@/constants";
import { Radio, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface NavbarProps {
  currentUser: User | null;
  activeTab: TabType;
  sseConnected: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  sseConnected,
  onLogout,
}) => {
  if (!currentUser) return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6">
      <SidebarTrigger />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>KangKebab</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{TAB_LABELS[activeTab]}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-3">
        <Badge
          variant={sseConnected ? "outline" : "secondary"}
          className="gap-1.5 rounded-full px-3 font-medium"
        >
          <span
            className={`size-1.5 rounded-full ${
              sseConnected ? "bg-emerald-500" : "animate-pulse bg-amber-500"
            }`}
          />
          <span className="hidden capitalize sm:inline">
            {sseConnected ? "Realtime Aktif" : "Menghubungkan..."}
          </span>
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4 mr-1.5" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
};
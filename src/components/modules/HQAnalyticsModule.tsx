'use client';

import React from 'react';
import { ConsolidatedFinancials, User } from '@/types';
import { formatRupiah } from '@/constants';
import {
  AlertOctagon,
  DollarSign,
  LayoutDashboard,
  Loader2,
  Music2,
  Percent,
  PieChart,
  ShoppingBag,
  Store,
} from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface HQAnalyticsModuleProps {
  analytics: ConsolidatedFinancials | null;
  currentUser: User;
}

const LOW_STOCK_THRESHOLD = 5;

function stockBadge(remaining: number) {
  if (remaining <= 0) {
    return <Badge className="border-transparent bg-rose-100 text-rose-700">Habis</Badge>;
  }
  if (remaining <= LOW_STOCK_THRESHOLD) {
    return <Badge className="border-transparent bg-amber-100 text-amber-700">Menipis</Badge>;
  }
  return null;
}

function stockColor(remaining: number) {
  if (remaining <= 0) return 'text-rose-600';
  if (remaining <= LOW_STOCK_THRESHOLD) return 'text-amber-600';
  return 'text-foreground';
}

const SectionTitle: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <h3 className="flex items-center gap-2 text-base font-semibold">
    <Icon className="size-4 text-muted-foreground" />
    {children}
  </h3>
);

export const HQAnalyticsModule: React.FC<HQAnalyticsModuleProps> = ({ analytics, currentUser }) => {
  if (!analytics) {
    return (
      <EmptyState
        icon={Loader2}
        title="Memuat data analitik..."
        description="Konsolidasi finansial dan stok sedang disiapkan."
      />
    );
  }

  const description =
    currentUser.role === 'HQ_ADMIN'
      ? 'Konsolidasi performa keuangan, omzet, margin kotor, dan operasional stok keseluruhan cabang.'
      : `Performa keuangan, omzet, dan margin kotor untuk ${currentUser.branch?.name || 'Cabang'}.`;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        description={description}
        icon={LayoutDashboard}
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Omzet
            </CardTitle>
            <CardAction>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              {formatRupiah(analytics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalTransactionsCount} transaksi sukses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modal (COGS)
            </CardTitle>
            <CardAction>
              <ShoppingBag className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              {formatRupiah(analytics.totalCostOfGoods)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total biaya pokok produk terjual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Margin
            </CardTitle>
            <CardAction>
              <Percent className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              {formatRupiah(analytics.grossMarginAmount)}
            </div>
            <p className="text-xs text-emerald-600 font-medium">
              Margin kotor {analytics.grossMarginPercentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Barang Rusak
            </CardTitle>
            <CardAction>
              <AlertOctagon className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">
              {analytics.totalDamagedItemsCount} unit
            </div>
            <p className="text-xs text-muted-foreground">
              Nilai modal {formatRupiah(analytics.damagedGoodsValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Channel Offline</p>
              <div className="text-xl md:text-2xl font-bold tracking-tight tabular-nums text-emerald-600">
                {formatRupiah(analytics.offlineRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">Penjualan langsung di kasir toko fisik</p>
            </div>
            <Store className="size-8 md:size-10 text-emerald-600/20 shrink-0" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Channel Shopee</p>
              <div className="text-xl md:text-2xl font-bold tracking-tight tabular-nums text-orange-600">
                {formatRupiah(analytics.shopeeRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">Penjualan online via Shopee Marketplace</p>
            </div>
            <ShoppingBag className="size-8 md:size-10 text-orange-600/20 shrink-0" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Channel TikTok</p>
              <div className="text-xl md:text-2xl font-bold tracking-tight tabular-nums text-cyan-600">
                {formatRupiah(analytics.tiktokRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">Penjualan online via TikTok Shop</p>
            </div>
            <Music2 className="size-8 md:size-10 text-cyan-600/20 shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Branch Performance Comparison (HQ Only) */}
      {currentUser.role === 'HQ_ADMIN' && (
        <div className="space-y-4">
          <SectionTitle icon={PieChart}>Performa Cabang Operasional</SectionTitle>

          {/* Desktop Table */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Cabang</TableHead>
                  <TableHead>Total Omzet</TableHead>
                  <TableHead>Offline</TableHead>
                  <TableHead>Shopee</TableHead>
                  <TableHead>TikTok</TableHead>
                  <TableHead>Modal (COGS)</TableHead>
                  <TableHead>Margin Kotor</TableHead>
                  <TableHead>Transaksi</TableHead>
                  <TableHead>Brg. Rusak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.branchPerformance.map((b) => {
                  const marginPct = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0;
                  return (
                    <TableRow key={b.branchId}>
                      <TableCell className="font-mono text-xs text-foreground/70">{b.branchCode}</TableCell>
                      <TableCell className="font-medium">{b.branchName}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatRupiah(b.revenue)}</TableCell>
                      <TableCell className="text-emerald-600 tabular-nums">{formatRupiah(b.offlineRevenue)}</TableCell>
                      <TableCell className="text-orange-600 tabular-nums">{formatRupiah(b.shopeeRevenue)}</TableCell>
                      <TableCell className="text-cyan-600 tabular-nums">{formatRupiah(b.tiktokRevenue)}</TableCell>
                      <TableCell className="text-foreground/70 tabular-nums">{formatRupiah(b.cost)}</TableCell>
                      <TableCell>
                        <span className="font-semibold tabular-nums text-emerald-600">{formatRupiah(b.margin)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({marginPct.toFixed(1)}%)</span>
                      </TableCell>
                      <TableCell className="tabular-nums">{b.transactionCount} tx</TableCell>
                      <TableCell>
                        <span className={`tabular-nums ${b.damagedCount > 0 ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>
                          {b.damagedCount} unit
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {analytics.branchPerformance.map((b) => {
              const marginPct = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0;
              return (
                <Card key={b.branchId}>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{b.branchName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">Kode: {b.branchCode}</div>
                      </div>
                      <Badge variant={b.damagedCount > 0 ? 'destructive' : 'secondary'}>
                        {b.damagedCount} Rusak
                      </Badge>
                    </div>

                    <div className="divide-y divide-border/70 text-sm">
                      <div className="flex items-center justify-between py-1.5 first:pt-0">
                        <span className="text-muted-foreground">Total Omzet</span>
                        <span className="font-semibold tabular-nums">{formatRupiah(b.revenue)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground">Offline</span>
                        <span className="font-medium tabular-nums text-emerald-600">{formatRupiah(b.offlineRevenue)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground">Shopee</span>
                        <span className="font-medium tabular-nums text-orange-600">{formatRupiah(b.shopeeRevenue)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground">TikTok</span>
                        <span className="font-medium tabular-nums text-cyan-600">{formatRupiah(b.tiktokRevenue)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground">Modal (COGS)</span>
                        <span className="tabular-nums text-foreground/80">{formatRupiah(b.cost)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 last:pb-0">
                        <span className="font-medium">Margin Kotor</span>
                        <div className="text-right">
                          <span className="font-semibold tabular-nums text-emerald-600">{formatRupiah(b.margin)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({marginPct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Performance and Stock */}
      <div className="space-y-4 pt-4 border-t border-border/70">
        <SectionTitle icon={ShoppingBag}>Performa &amp; Sisa Stok Produk</SectionTitle>

        {(() => {
          const lowStockCount = analytics.productPerformance.filter(
            (p) => p.remainingStock <= LOW_STOCK_THRESHOLD
          ).length;
          if (lowStockCount === 0) return null;
          return (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <AlertOctagon />
              <AlertDescription className="text-xs font-medium text-amber-800">
                {lowStockCount} produk dengan stok menipis ({'\u2264'} {LOW_STOCK_THRESHOLD} unit) — segera alokasikan
                stok melalui menu Pengiriman ke Cabang.
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Desktop Table */}
        <Card className="hidden md:block overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produk &amp; Varian</TableHead>
                <TableHead className="text-right">Terjual (Qty)</TableHead>
                <TableHead className="text-right">Sisa Stok Tersedia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.productPerformance.map((p) => {
                const badge = stockBadge(p.remainingStock);
                return (
                  <TableRow key={p.masterProductId}>
                    <TableCell className="font-mono text-xs text-foreground/70">{p.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.variant}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold tabular-nums">{p.qtySold}</span>
                      <span className="ml-1 text-xs text-muted-foreground">unit</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold tabular-nums ${stockColor(p.remainingStock)}`}>
                        {p.remainingStock}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">unit</span>
                      {badge && <span className="ml-2 inline-block align-middle">{badge}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {analytics.productPerformance.map((p) => {
            const badge = stockBadge(p.remainingStock);
            return (
              <Card key={p.masterProductId}>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.variant}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">SKU: {p.sku}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border/70 pt-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Terjual</p>
                      <div className="font-semibold tabular-nums">
                        {p.qtySold} <span className="text-xs font-normal text-muted-foreground">unit</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-xs text-muted-foreground">Sisa Stok</p>
                      <div className={`font-semibold tabular-nums ${stockColor(p.remainingStock)}`}>
                        {p.remainingStock} <span className="text-xs font-normal text-muted-foreground">unit</span>
                      </div>
                      {badge && <div className="flex justify-end">{badge}</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
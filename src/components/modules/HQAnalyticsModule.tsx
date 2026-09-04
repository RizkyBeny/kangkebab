'use client';

import React from 'react';
import { ConsolidatedFinancials, User } from '@/types';
import { formatRupiah } from '@/constants';
import {
  DollarSign,
  PieChart,
  AlertOctagon,
  Store,
  Smartphone,
  ShoppingBag,
  Percent,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface HQAnalyticsModuleProps {
  analytics: ConsolidatedFinancials | null;
  currentUser: User;
}

export const HQAnalyticsModule: React.FC<HQAnalyticsModuleProps> = ({ analytics, currentUser }) => {
  if (!analytics) {
    return (
      <Card className="p-8 text-center text-xs text-muted-foreground border-dashed border-border">
        Memuat data analitik konsolidasi...
      </Card>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header Welcome Area */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-xl">
            {currentUser.role === 'HQ_ADMIN' 
              ? 'Konsolidasi performa keuangan, omzet, margin kotor, dan operasional stok keseluruhan cabang.' 
              : `Performa keuangan, omzet, dan margin kotor untuk ${currentUser.branch?.name || 'Cabang'}.`}
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Omzet</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(analytics.totalRevenue)}
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-emerald-600 font-bold mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{analytics.totalTransactionsCount} Transaksi Sukses</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Modal (COGS) */}
        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modal (COGS)</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(analytics.totalCostOfGoods)}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1">
              Total biaya pokok produk terjual
            </div>
          </CardContent>
        </Card>

        {/* Gross Margin */}
        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gross Margin</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
              {formatRupiah(analytics.grossMarginAmount)}
            </div>
            <div className="text-[11px] text-indigo-600 font-bold mt-1">
              Margin Kotor: {analytics.grossMarginPercentage.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Barang Rusak */}
        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Barang Rusak</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
              {analytics.totalDamagedItemsCount} unit
            </div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">
              Nilai Modal: {formatRupiah(analytics.damagedGoodsValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm border-border rounded-xl flex items-center justify-between p-5 flex-row">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] tracking-wider font-bold">
              CHANNEL OFFLINE
            </Badge>
            <div className="text-xl md:text-2xl font-bold text-foreground font-mono">
              {formatRupiah(analytics.offlineRevenue)}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Penjualan langsung di kasir toko fisik</p>
          </div>
          <Store className="w-12 h-12 md:w-16 md:h-16 text-emerald-500/10" />
        </Card>

        <Card className="shadow-sm border-border rounded-xl flex items-center justify-between p-5 flex-row">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] tracking-wider font-bold">
              CHANNEL ONLINE
            </Badge>
            <div className="text-xl md:text-2xl font-bold text-foreground font-mono">
              {formatRupiah(analytics.onlineRevenue)}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">Penjualan online via Shopee / TikTok Shop</p>
          </div>
          <Smartphone className="w-12 h-12 md:w-16 md:h-16 text-indigo-500/10" />
        </Card>
      </div>

      {/* Branch Performance Comparison (HQ Only) */}
      {currentUser.role === 'HQ_ADMIN' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <PieChart className="w-5 h-5 text-foreground/80" />
            Performa Cabang Operasional
          </h3>
          
          {/* Desktop Table */}
          <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50 border-b border-border/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">Kode</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nama Cabang</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Omzet</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Modal (COGS)</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Margin Kotor</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Transaksi</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Brg. Rusak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.branchPerformance.map((b) => {
                  const marginPct = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0;
                  return (
                    <TableRow key={b.branchId} className="group transition-colors hover:bg-muted/30">
                      <TableCell className="font-mono font-medium text-foreground/80 text-xs py-4">{b.branchCode}</TableCell>
                      <TableCell className="font-bold text-foreground text-sm">{b.branchName}</TableCell>
                      <TableCell className="font-bold text-foreground font-mono text-sm">{formatRupiah(b.revenue)}</TableCell>
                      <TableCell className="text-foreground/80 font-mono text-xs">{formatRupiah(b.cost)}</TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-600 font-mono text-sm">{formatRupiah(b.margin)}</span>
                        <span className="text-[11px] text-indigo-600 font-semibold ml-2">({marginPct.toFixed(1)}%)</span>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground/80 text-xs">{b.transactionCount} tx</TableCell>
                      <TableCell>
                        <span className={`font-semibold text-xs ${b.damagedCount > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
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
                <Card key={b.branchId} className="border-border shadow-sm rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-foreground text-base">{b.branchName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">Kode: {b.branchCode}</div>
                      </div>
                      <Badge variant="outline" className={`${b.damagedCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-muted/50 text-muted-foreground'} text-[10px]`}>
                        {b.damagedCount} Rusak
                      </Badge>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Total Omzet</span>
                        <span className="font-mono text-foreground font-bold">{formatRupiah(b.revenue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Modal (COGS)</span>
                        <span className="font-mono text-foreground/80">{formatRupiah(b.cost)}</span>
                      </div>
                      <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                        <span className="text-foreground/80 font-bold">Margin Kotor</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-700">{formatRupiah(b.margin)}</span>
                          <span className="text-[10px] text-indigo-600 ml-1">({marginPct.toFixed(1)}%)</span>
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
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-foreground/80" />
          Performa &amp; Sisa Stok Produk
        </h3>
        
        {/* Desktop Table */}
        <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">SKU</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Produk &amp; Varian</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Terjual (Qty)</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Sisa Stok Tersedia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.productPerformance.map((p) => (
                <TableRow key={p.masterProductId} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-mono font-medium text-foreground/80 text-xs py-4">{p.sku}</TableCell>
                  <TableCell>
                    <div className="font-bold text-foreground text-sm">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.variant}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-emerald-600 text-sm">{p.qtySold}</span> <span className="text-xs text-muted-foreground">unit</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold text-sm ${p.remainingStock > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {p.remainingStock}
                    </span> <span className="text-xs text-muted-foreground">unit</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {analytics.productPerformance.map((p) => (
            <Card key={p.masterProductId} className="border-border shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-foreground text-sm">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.variant}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">SKU: {p.sku}</div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-2 border border-border/50">
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Terjual</div>
                    <div className="font-bold text-emerald-600 text-sm">{p.qtySold} <span className="text-[10px] font-normal text-muted-foreground">unit</span></div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Sisa Stok</div>
                    <div className={`font-bold text-sm ${p.remainingStock > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {p.remainingStock} <span className="text-[10px] font-normal text-muted-foreground">unit</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

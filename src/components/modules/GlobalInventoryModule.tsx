'use client';

import React from 'react';
import { BranchInventory } from '@/types';
import { formatRupiah } from '@/constants';
import { Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface GlobalInventoryModuleProps {
  inventories: BranchInventory[];
}

const qtyBadge = (qty: number, tone: 'positive' | 'danger' | 'muted') => {
  const cls =
    tone === 'positive'
      ? 'border-transparent bg-emerald-100 text-emerald-700'
      : tone === 'danger'
        ? 'border-transparent bg-rose-100 text-rose-700'
        : 'border-transparent bg-muted text-muted-foreground';
  return (
    <Badge className={`${cls} font-mono tabular-nums`}>{qty}</Badge>
  );
};

export const GlobalInventoryModule: React.FC<GlobalInventoryModuleProps> = ({ inventories }) => {
  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Visibilitas Stok Opname (HQ View)"
        description="Pantau persediaan barang layak jual dan catatan barang rusak di seluruh cabang secara realtime tanpa perlu sinkronisasi manual."
        icon={Layers}
      />

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cabang</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Produk &amp; Varian</TableHead>
              <TableHead>Stok Jual</TableHead>
              <TableHead>Rusak/Hilang</TableHead>
              <TableHead>Modal (HQ)</TableHead>
              <TableHead>Harga (Off/Shopee/TikTok)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  Belum ada data stok cabang.
                </TableCell>
              </TableRow>
            ) : (
              inventories.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.branch?.name || 'Cabang Madiun'}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground/70">{inv.masterProduct.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.masterProduct.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{inv.masterProduct.variant}</div>
                  </TableCell>
                  <TableCell>{qtyBadge(inv.qtyAvailable, 'positive')}</TableCell>
                  <TableCell>{qtyBadge(inv.qtyDamaged, inv.qtyDamaged > 0 ? 'danger' : 'muted')}</TableCell>
                  <TableCell className="tabular-nums text-foreground/70">{formatRupiah(inv.masterProduct.costPrice)}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs font-medium tabular-nums">
                      <div className="text-emerald-600">{formatRupiah(inv.masterProduct.offlineSellingPrice)} (Off)</div>
                      <div className="text-orange-600">{formatRupiah(inv.masterProduct.shopeeSellingPrice)} (Shopee)</div>
                      <div className="text-cyan-600">{formatRupiah(inv.masterProduct.tiktokSellingPrice)} (TikTok)</div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden space-y-4">
        {inventories.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Belum ada data stok cabang"
            description="Stok dari setiap cabang akan tampil di sini setelah stok opname dilakukan."
          />
        ) : (
          inventories.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold leading-tight">{inv.masterProduct.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inv.masterProduct.variant} <span className="mx-1">·</span>
                      <span className="font-mono">{inv.masterProduct.sku}</span>
                    </div>
                  </div>
                  <Badge variant="secondary">{inv.branch?.name || 'Cabang Madiun'}</Badge>
                </div>

                <div className="divide-y divide-border/70 text-sm">
                  <div className="flex items-center justify-between py-1.5 first:pt-0">
                    <span className="text-muted-foreground">Stok Jual</span>
                    <span className="font-semibold tabular-nums text-emerald-600">{inv.qtyAvailable} unit</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Rusak/Hilang</span>
                    <span className={`font-semibold tabular-nums ${inv.qtyDamaged > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                      {inv.qtyDamaged} unit
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Offline</span>
                    <span className="font-medium tabular-nums text-emerald-600">{formatRupiah(inv.masterProduct.offlineSellingPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Shopee</span>
                    <span className="font-medium tabular-nums text-orange-600">{formatRupiah(inv.masterProduct.shopeeSellingPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 last:pb-0">
                    <span className="text-muted-foreground">TikTok</span>
                    <span className="font-medium tabular-nums text-cyan-600">{formatRupiah(inv.masterProduct.tiktokSellingPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
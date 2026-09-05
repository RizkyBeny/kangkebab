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

interface GlobalInventoryModuleProps {
  inventories: BranchInventory[];
}

export const GlobalInventoryModule: React.FC<GlobalInventoryModuleProps> = ({ inventories }) => {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-start gap-2 leading-tight">
            <Layers className="w-6 h-6 text-foreground/80 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Visibilitas Stok Opname (HQ View)</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-lg">
            Pantau persediaan barang layak jual dan catatan barang rusak di seluruh cabang secara realtime tanpa perlu sinkronisasi manual.
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">Cabang</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">SKU</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Produk &amp; Varian</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stok Jual</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Rusak/Hilang</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Modal (HQ)</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Harga (Off/Shopee/TikTok)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  Belum ada data stok cabang.
                </TableCell>
              </TableRow>
            ) : (
              inventories.map((inv) => (
                <TableRow key={inv.id} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-bold text-foreground text-sm py-4">{inv.branch?.name || 'Cabang Madiun'}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground/80 text-xs">{inv.masterProduct.sku}</TableCell>
                  <TableCell>
                    <div className="font-bold text-foreground text-sm">{inv.masterProduct.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{inv.masterProduct.variant}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-sm py-1 px-2 font-mono">
                      {inv.qtyAvailable}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-sm py-1 px-2 font-mono ${
                      inv.qtyDamaged > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-muted/50 text-muted-foreground border-border'
                    }`}>
                      {inv.qtyDamaged}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80 font-medium font-mono text-xs">
                    {formatRupiah(inv.masterProduct.costPrice)}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold space-y-1">
                      <div className="text-emerald-700">{formatRupiah(inv.masterProduct.offlineSellingPrice)} (Off)</div>
                      <div className="text-primary">{formatRupiah(inv.masterProduct.shopeeSellingPrice)} (Shopee)</div>
                      <div className="text-foreground/80">{formatRupiah(inv.masterProduct.tiktokSellingPrice)} (TikTok)</div>
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
          <div className="p-8 text-center text-muted-foreground text-sm bg-card rounded-xl border border-border">
            Belum ada data stok cabang.
          </div>
        ) : (
          inventories.map((inv) => (
            <Card key={inv.id} className="border-border shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-foreground text-base leading-tight">{inv.masterProduct.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{inv.masterProduct.variant}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="font-mono">{inv.masterProduct.sku}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-muted text-foreground/80 border-border text-[10px]">
                    {inv.branch?.name || 'Cabang Madiun'}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-border/60">
                    <span className="text-muted-foreground font-medium">Stok Jual</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{inv.qtyAvailable} unit</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 pb-1">
                    <span className="text-muted-foreground font-medium">Rusak/Hilang</span>
                    <span className={`font-mono font-bold text-sm ${inv.qtyDamaged > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                      {inv.qtyDamaged} unit
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-border/60 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Offline</span>
                      <span className="font-mono font-bold text-emerald-700">{formatRupiah(inv.masterProduct.offlineSellingPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Shopee</span>
                      <span className="font-mono font-bold text-primary">{formatRupiah(inv.masterProduct.shopeeSellingPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">TikTok</span>
                      <span className="font-mono font-bold text-foreground/80">{formatRupiah(inv.masterProduct.tiktokSellingPrice)}</span>
                    </div>
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

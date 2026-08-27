'use client';

import React from 'react';
import { BranchInventory } from '@/types';
import { formatRupiah } from '@/constants';
import { Layers, Store, PhoneIcon } from 'lucide-react';
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
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-start gap-2 leading-tight">
            <Layers className="w-6 h-6 text-slate-700 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Visibilitas Stok Opname (HQ View)</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 font-medium leading-relaxed max-w-lg">
            Pantau persediaan barang layak jual dan catatan barang rusak di seluruh cabang secara realtime tanpa perlu sinkronisasi manual.
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-slate-200 hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-4">Cabang</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SKU</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produk &amp; Varian</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stok Jual</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rusak/Hilang</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Modal (HQ)</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Harga (Off/On)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-sm">
                  Belum ada data stok cabang.
                </TableCell>
              </TableRow>
            ) : (
              inventories.map((inv) => (
                <TableRow key={inv.id} className="group transition-colors hover:bg-slate-50/50">
                  <TableCell className="font-bold text-slate-900 text-sm py-4">{inv.branch?.name || 'Cabang Madiun'}</TableCell>
                  <TableCell className="font-mono font-medium text-slate-600 text-xs">{inv.masterProduct.sku}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900 text-sm">{inv.masterProduct.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{inv.masterProduct.variant}</div>
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
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {inv.qtyDamaged}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium font-mono text-xs">
                    {formatRupiah(inv.masterProduct.costPrice)}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold space-y-1">
                      <div className="text-emerald-700">{formatRupiah(inv.masterProduct.offlineSellingPrice)} (Off)</div>
                      <div className="text-indigo-700">{formatRupiah(inv.masterProduct.onlineSellingPrice)} (On)</div>
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
          <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            Belum ada data stok cabang.
          </div>
        ) : (
          inventories.map((inv) => (
            <Card key={inv.id} className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900 text-base leading-tight">{inv.masterProduct.name}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{inv.masterProduct.variant}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="font-mono">{inv.masterProduct.sku}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                    {inv.branch?.name || 'Cabang Madiun'}
                  </Badge>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Stok Jual</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{inv.qtyAvailable} unit</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 pb-1">
                    <span className="text-slate-500 font-medium">Rusak/Hilang</span>
                    <span className={`font-mono font-bold text-sm ${inv.qtyDamaged > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {inv.qtyDamaged} unit
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Modal: <span className="font-mono font-bold text-slate-700">{formatRupiah(inv.masterProduct.costPrice)}</span></span>
                    <div className="text-right space-x-2 font-mono">
                      <span className="text-emerald-700 font-semibold">{formatRupiah(inv.masterProduct.offlineSellingPrice)}</span>
                      <span className="text-indigo-700 font-semibold">{formatRupiah(inv.masterProduct.onlineSellingPrice)}</span>
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

'use client';

import React, { useState } from 'react';
import { BranchInventory, User } from '@/types';
import { formatRupiah } from '@/constants';
import { Store, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LiveProductsModuleProps {
  inventories: BranchInventory[];
  currentUser: User;
  onRefresh?: () => void;
}

interface RecoveryTarget {
  inventory: BranchInventory;
}

export const LiveProductsModule: React.FC<LiveProductsModuleProps> = ({ inventories, currentUser, onRefresh }) => {
  const [recoveryTarget, setRecoveryTarget] = useState<RecoveryTarget | null>(null);
  const [recoveryQty, setRecoveryQty] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openRecovery = (inventory: BranchInventory) => {
    setRecoveryTarget({ inventory });
    setRecoveryQty(String(inventory.qtyDamaged));
    setErrorMsg('');
  };

  const handleRecover = async () => {
    if (!recoveryTarget) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const { inventory } = recoveryTarget;
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: inventory.branchId,
          masterProductId: inventory.masterProductId,
          qty: Number(recoveryQty),
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setRecoveryTarget(null);
      onRefresh?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengembalikan stok');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-start gap-2 leading-tight">
            <Store className="w-6 h-6 text-foreground/80 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Katalog Live Product &amp; Stok Opname</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-lg">
            Daftar stok produk siap jual di {currentUser.branch?.name || 'Cabang Madiun'} beserta perbandingan harga Offline &amp; Online. Barang yang salah tercatat rusak/hilang dapat dikembalikan ke stok jual.
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">SKU</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Produk &amp; Varian</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stok Jual</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Rusak/Hilang</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Harga Offline</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Harga Online</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  Belum ada stok produk di cabang ini.
                </TableCell>
              </TableRow>
            ) : (
              inventories.map((inv) => (
                <TableRow key={inv.id} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-mono font-medium text-foreground/80 text-xs py-4">{inv.masterProduct.sku}</TableCell>
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
                  <TableCell className="font-bold text-emerald-700 text-sm font-mono">
                    {formatRupiah(inv.masterProduct.offlineSellingPrice)}
                  </TableCell>
                  <TableCell className="font-bold text-indigo-700 text-sm font-mono">
                    {formatRupiah(inv.masterProduct.onlineSellingPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.qtyDamaged > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRecovery(inv)}
                        className="h-8 text-xs font-bold bg-card px-2"
                        title="Kembalikan ke Stok Jual"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Perbaiki
                      </Button>
                    )}
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
            Belum ada stok produk di cabang ini.
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

                  <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Offline <span className="font-mono font-bold text-emerald-700 ml-1">{formatRupiah(inv.masterProduct.offlineSellingPrice)}</span></span>
                    <span className="text-muted-foreground">Online <span className="font-mono font-bold text-indigo-700 ml-1">{formatRupiah(inv.masterProduct.onlineSellingPrice)}</span></span>
                  </div>
                </div>

                {inv.qtyDamaged > 0 && (
                  <Button
                    variant="outline"
                    className="w-full h-10 text-xs font-bold"
                    onClick={() => openRecovery(inv)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2 text-emerald-600" />
                    Perbaiki (Kembalikan ke Stok Jual)
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {recoveryTarget && (
        <ResponsiveModal
          open={true}
          onOpenChange={(open) => !open && !loading && setRecoveryTarget(null)}
          title="Perbaiki Stok Rusak/Hilang"
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        >
          <div className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Produk</span>
                <span className="text-sm font-bold text-foreground">{recoveryTarget.inventory.masterProduct.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">SKU</span>
                <span className="font-mono text-xs font-bold text-foreground/80">{recoveryTarget.inventory.masterProduct.sku}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Rusak/Hilang Sekarang</span>
                <span className="font-mono text-sm font-bold text-rose-600">{recoveryTarget.inventory.qtyDamaged} unit</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground/80">Jumlah yang dikembalikan ke Stok Jual</Label>
              <Input
                type="number"
                min={1}
                max={recoveryTarget.inventory.qtyDamaged}
                value={recoveryQty}
                onChange={(e) => setRecoveryQty(e.target.value)}
                className="h-10 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Pindahkan barang yang tidak rusak dari kolom rusak/hilang ke stok jual. Maksimum {recoveryTarget.inventory.qtyDamaged} unit.
              </p>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRecoveryTarget(null)} disabled={loading} className="h-9 text-xs font-semibold px-4">
                Batal
              </Button>
              <Button onClick={handleRecover} disabled={loading} className="h-9 text-xs font-semibold px-6">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Kembalikan ke Stok Jual
              </Button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
};

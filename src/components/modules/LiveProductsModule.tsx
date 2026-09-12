'use client';

import React, { useState } from 'react';
import { BranchInventory, User } from '@/types';
import { formatRupiah } from '@/constants';
import { RefreshCw, Store } from 'lucide-react';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

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
      <PageHeader
        title="Katalog Live Product & Stok Opname"
        description={`Daftar stok produk siap jual di ${currentUser.branch?.name || 'Cabang Madiun'} beserta perbandingan harga Offline, Shopee & TikTok. Barang yang salah tercatat rusak/hilang dapat dikembalikan ke stok jual.`}
        icon={Store}
      />

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Produk &amp; Varian</TableHead>
              <TableHead>Stok Jual</TableHead>
              <TableHead>Rusak/Hilang</TableHead>
              <TableHead>Harga Offline</TableHead>
              <TableHead>Harga Shopee</TableHead>
              <TableHead>Harga TikTok</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  Belum ada stok produk di cabang ini.
                </TableCell>
              </TableRow>
            ) : (
              inventories.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs text-foreground/70">{inv.masterProduct.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.masterProduct.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{inv.masterProduct.variant}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className="border-transparent bg-emerald-100 text-emerald-700 font-mono tabular-nums">
                      {inv.qtyAvailable}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.qtyDamaged > 0 ? (
                      <Badge className="border-transparent bg-rose-100 text-rose-700 font-mono tabular-nums">
                        {inv.qtyDamaged}
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-muted text-muted-foreground font-mono tabular-nums">
                        0
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums text-emerald-600">
                    {formatRupiah(inv.masterProduct.offlineSellingPrice)}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums text-orange-600">
                    {formatRupiah(inv.masterProduct.shopeeSellingPrice)}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums text-cyan-600">
                    {formatRupiah(inv.masterProduct.tiktokSellingPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.qtyDamaged > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRecovery(inv)}
                        className="text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
                        title="Kembalikan ke Stok Jual"
                      >
                        <RefreshCw /> Perbaiki
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
          <EmptyState
            icon={Store}
            title="Belum ada stok produk di cabang ini"
            description="Stok akan muncul setelah HQ mengirim barang ke cabang."
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
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge className="border-transparent bg-emerald-100 text-emerald-700 font-mono tabular-nums">
                    {inv.qtyAvailable} jual
                  </Badge>
                  {inv.qtyDamaged > 0 && (
                    <Badge className="border-transparent bg-rose-100 text-rose-700 font-mono tabular-nums">
                      {inv.qtyDamaged} rusak
                    </Badge>
                  )}
                </div>

                <div className="divide-y divide-border/70 text-sm">
                  <div className="flex items-center justify-between py-1.5 first:pt-0">
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

                {inv.qtyDamaged > 0 && (
                  <Button variant="outline" className="w-full text-emerald-700 hover:bg-emerald-50" onClick={() => openRecovery(inv)}>
                    <RefreshCw /> Perbaiki (Kembalikan ke Stok Jual)
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
        >
          <div className="space-y-5">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="divide-y divide-border/70 rounded-lg border border-border px-4 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Produk</span>
                <span className="font-medium">{recoveryTarget.inventory.masterProduct.name}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">SKU</span>
                <span className="font-mono text-xs">{recoveryTarget.inventory.masterProduct.sku}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Rusak/Hilang Sekarang</span>
                <span className="font-semibold tabular-nums text-rose-600">{recoveryTarget.inventory.qtyDamaged} unit</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jumlah yang dikembalikan ke Stok Jual</Label>
              <Input
                type="number"
                min={1}
                max={recoveryTarget.inventory.qtyDamaged}
                value={recoveryQty}
                onChange={(e) => setRecoveryQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pindahkan barang yang tidak rusak dari kolom rusak/hilang ke stok jual. Maksimum {recoveryTarget.inventory.qtyDamaged} unit.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRecoveryTarget(null)} disabled={loading}>
                Batal
              </Button>
              <Button onClick={handleRecover} disabled={loading}>
                {loading ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                Kembalikan ke Stok Jual
              </Button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
};
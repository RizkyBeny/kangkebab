'use client';

import React, { useState } from 'react';
import { Branch, BranchInventory, User } from '@/types';
import { formatRupiah } from '@/constants';
import { Percent, RotateCcw, Save, Search, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface ResellerPricingModuleProps {
  inventories: BranchInventory[];
  branches: Branch[];
  currentUser: User;
  onRefresh: () => void;
}

export const ResellerPricingModule: React.FC<ResellerPricingModuleProps> = ({
  inventories,
  branches,
  currentUser,
  onRefresh,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  const effectiveBranchId = selectedBranchId || branches[0]?.id || '';
  const branchInventories = effectiveBranchId ? inventories.filter((i) => i.branchId === effectiveBranchId) : [];

  const filteredBranchInventories = branchInventories.filter((inv) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      inv.masterProduct.name.toLowerCase().includes(q) ||
      inv.masterProduct.sku.toLowerCase().includes(q) ||
      inv.masterProduct.variant.toLowerCase().includes(q)
    );
  });

  const draftPrice = (inv: BranchInventory): string => {
    return drafts[inv.id] ?? (inv.resellerSellingPrice != null ? String(inv.resellerSellingPrice) : '');
  };

  const handleSave = async (inv: BranchInventory, clear: boolean) => {
    const raw = clear ? '' : draftPrice(inv);
    const trimmed = raw.trim();
    const price = trimmed === '' ? null : Number(trimmed);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setErrorMsg('Harga reseller harus berupa angka >= 0');
      return;
    }

    setErrorMsg('');
    setSavingId(inv.id);
    try {
      const res = await fetch('/api/inventory/reseller-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: inv.branchId,
          masterProductId: inv.masterProductId,
          price,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan harga reseller');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Harga Reseller per Cabang"
        description="Atur harga jual khusus reseller per produk untuk setiap cabang. Kosongkan harga untuk memakai harga Offline setempat."
        icon={Percent}
        actions={
          <div className="w-full sm:w-64">
            <Select value={effectiveBranchId || undefined} onValueChange={(val) => setSelectedBranchId(val || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih cabang" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-md">
        <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Cari nama, SKU, atau varian..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!effectiveBranchId ? (
        <EmptyState
          title="Belum ada cabang terdaftar"
          description="Hubungi tim HQ untuk menambahkan cabang."
        />
      ) : filteredBranchInventories.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Belum ada produk di cabang ini"
          description="Lakukan pengiriman stok dari HQ terlebih dahulu."
        />
      ) : (
        <>
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produk &amp; Varian</TableHead>
                  <TableHead>Jual Offline</TableHead>
                  <TableHead>Harga Reseller</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranchInventories.map((inv) => {
                  const hasResellerPrice = inv.resellerSellingPrice != null;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{inv.masterProduct.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{inv.masterProduct.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{inv.masterProduct.variant}</div>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums text-emerald-600">
                        {formatRupiah(inv.masterProduct.offlineSellingPrice)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rp</span>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={draftPrice(inv)}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                            placeholder="Masukkan harga"
                            className="h-8 w-36 font-mono"
                          />
                          {hasResellerPrice && (
                            <Badge className="border-transparent bg-emerald-100 text-emerald-700">Aktif</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSave(inv, true)}
                            disabled={savingId === inv.id}
                            className="text-muted-foreground hover:text-destructive hover:border-destructive"
                          >
                            <RotateCcw /> Offline
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(inv, false)}
                            disabled={savingId === inv.id}
                          >
                            <Save /> {savingId === inv.id ? 'Menyimpan...' : 'Simpan'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="md:hidden space-y-3">
            {filteredBranchInventories.map((inv) => {
              const hasResellerPrice = inv.resellerSellingPrice != null;
              return (
                <Card key={inv.id}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold leading-tight">{inv.masterProduct.name}</h4>
                        <div className="text-xs text-muted-foreground mt-1">
                          {inv.masterProduct.variant} <span className="mx-1">·</span>
                          <span className="font-mono">{inv.masterProduct.sku}</span>
                        </div>
                      </div>
                      {hasResellerPrice && (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-700 shrink-0">
                          Reseller Aktif
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3 border-t border-border/70 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Store className="size-3.5" /> Offline
                        </span>
                        <span className="font-semibold tabular-nums text-emerald-600">
                          {formatRupiah(inv.masterProduct.offlineSellingPrice)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Harga Reseller (kosong = Offline)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={draftPrice(inv)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                          placeholder="Masukkan harga"
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                        onClick={() => handleSave(inv, true)}
                        disabled={savingId === inv.id}
                      >
                        <RotateCcw /> Pakai Offline
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => handleSave(inv, false)}
                        disabled={savingId === inv.id}
                      >
                        <Save /> {savingId === inv.id ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
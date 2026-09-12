'use client';

import React, { useState } from 'react';
import { MasterProduct, User } from '@/types';
import { formatRupiah } from '@/constants';
import {
  Download,
  Edit2,
  Music2,
  Plus,
  Percent,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';
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
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface HQMasterModuleProps {
  products: MasterProduct[];
  currentUser: User;
  onRefresh: () => void;
}

export const HQMasterModule: React.FC<HQMasterModuleProps> = ({
  products,
  currentUser,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [variant, setVariant] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [offlineSellingPrice, setOfflineSellingPrice] = useState<number>(0);
  const [shopeeSellingPrice, setShopeeSellingPrice] = useState<number>(0);
  const [tiktokSellingPrice, setTiktokSellingPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setVariant('');
    setCostPrice(0);
    setOfflineSellingPrice(0);
    setShopeeSellingPrice(0);
    setTiktokSellingPrice(0);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (prod: MasterProduct) => {
    setEditingProduct(prod);
    setSku(prod.sku);
    setName(prod.name);
    setVariant(prod.variant);
    setCostPrice(prod.costPrice);
    setOfflineSellingPrice(prod.offlineSellingPrice);
    setShopeeSellingPrice(prod.shopeeSellingPrice);
    setTiktokSellingPrice(prod.tiktokSellingPrice);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const url = '/api/products';
      const payload = {
        sku,
        name,
        variant,
        costPrice: Number(costPrice),
        offlineSellingPrice: Number(offlineSellingPrice),
        shopeeSellingPrice: Number(shopeeSellingPrice),
        tiktokSellingPrice: Number(tiktokSellingPrice),
        userId: currentUser.id,
        userName: currentUser.name,
      };

      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct ? { id: editingProduct.id, ...payload } : payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowModal(false);
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan produk');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}&userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus produk');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.variant.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['SKU', 'Nama Produk', 'Varian', 'Modal (COGS)', 'Jual Offline', 'Jual Shopee', 'Jual TikTok'];
    const rows = filteredProducts.map(p => [
      p.sku,
      `"${p.name}"`,
      `"${p.variant}"`,
      p.costPrice,
      p.offlineSellingPrice,
      p.shopeeSellingPrice,
      p.tiktokSellingPrice
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Katalog_Produk_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Master Data & Pricing"
        description="Kelola katalog master produk, harga modal, serta penetapan harga jual Offline, Shopee & TikTok secara terpusat untuk seluruh cabang."
        icon={Tag}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download />
              Export CSV
            </Button>
            <Button onClick={openCreateModal}>
              <Plus />
              Tambah Produk
            </Button>
          </>
        }
      />

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

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Produk &amp; Varian</TableHead>
              <TableHead>Modal (COGS)</TableHead>
              <TableHead>Jual Offline</TableHead>
              <TableHead>Jual Shopee</TableHead>
              <TableHead>Jual TikTok</TableHead>
              <TableHead>Margin (%)</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  Belum ada master produk. Tambahkan melalui tombol Tambah Produk.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => {
                const offMargin = p.offlineSellingPrice > 0 ? ((p.offlineSellingPrice - p.costPrice) / p.offlineSellingPrice) * 100 : 0;
                const shopeeMargin = p.shopeeSellingPrice > 0 ? ((p.shopeeSellingPrice - p.costPrice) / p.shopeeSellingPrice) * 100 : 0;
                const tiktokMargin = p.tiktokSellingPrice > 0 ? ((p.tiktokSellingPrice - p.costPrice) / p.tiktokSellingPrice) * 100 : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.variant}</div>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground/70">{formatRupiah(p.costPrice)}</TableCell>
                    <TableCell className="font-semibold tabular-nums text-emerald-600">{formatRupiah(p.offlineSellingPrice)}</TableCell>
                    <TableCell className="font-semibold tabular-nums text-orange-600">{formatRupiah(p.shopeeSellingPrice)}</TableCell>
                    <TableCell className="font-semibold tabular-nums text-cyan-600">{formatRupiah(p.tiktokSellingPrice)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Store className="size-3.5" /> {offMargin.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1.5 text-orange-600">
                          <ShoppingBag className="size-3.5" /> {shopeeMargin.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1.5 text-cyan-600">
                          <Music2 className="size-3.5" /> {tiktokMargin.toFixed(1)}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(p)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <EmptyState
            title="Belum ada master produk"
            description="Tambah produk pertama melalui tombol Tambah Produk."
          />
        ) : (
          filteredProducts.map((p) => {
            const offMargin = p.offlineSellingPrice > 0 ? ((p.offlineSellingPrice - p.costPrice) / p.offlineSellingPrice) * 100 : 0;
            const shopeeMargin = p.shopeeSellingPrice > 0 ? ((p.shopeeSellingPrice - p.costPrice) / p.shopeeSellingPrice) * 100 : 0;
            const tiktokMargin = p.tiktokSellingPrice > 0 ? ((p.tiktokSellingPrice - p.costPrice) / p.tiktokSellingPrice) * 100 : 0;
            return (
              <Card key={p.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold leading-tight">{p.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.variant} <span className="mx-1">·</span>
                        <span className="font-mono">{p.sku}</span>
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border/70 text-sm">
                    <div className="flex items-center justify-between py-1.5 first:pt-0">
                      <span className="text-muted-foreground">Modal (COGS)</span>
                      <span className="tabular-nums text-foreground/80">{formatRupiah(p.costPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Store className="size-3.5" /> Offline
                      </span>
                      <span className="font-semibold tabular-nums text-emerald-600">
                        {formatRupiah(p.offlineSellingPrice)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">({offMargin.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShoppingBag className="size-3.5" /> Shopee
                      </span>
                      <span className="font-semibold tabular-nums text-orange-600">
                        {formatRupiah(p.shopeeSellingPrice)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">({shopeeMargin.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 last:pb-0">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Music2 className="size-3.5" /> TikTok
                      </span>
                      <span className="font-semibold tabular-nums text-cyan-600">
                        {formatRupiah(p.tiktokSellingPrice)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">({tiktokMargin.toFixed(0)}%)</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => openEditModal(p)}>
                      <Edit2 /> Edit
                    </Button>
                    <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(p.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <ResponsiveModal
        open={showModal}
        onOpenChange={setShowModal}
        title={editingProduct ? 'Edit Master Produk' : 'Tambah Master Produk Baru'}
      >
        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SKU Produk</Label>
              <Input
                required
                placeholder="mis. KB-OR-SM"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Varian</Label>
              <Input
                required
                placeholder="mis. Small"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nama Produk</Label>
            <Input
              required
              placeholder="mis. Kebab Original Beef"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Percent className="size-4 text-muted-foreground" /> Penetapan Harga &amp; Margin
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Harga Modal (HQ Cost)</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-emerald-700">Harga Jual Offline</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={offlineSellingPrice || ''}
                  onChange={(e) => setOfflineSellingPrice(Number(e.target.value))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-orange-700">Harga Jual Shopee</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={shopeeSellingPrice || ''}
                  onChange={(e) => setShopeeSellingPrice(Number(e.target.value))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-cyan-700">Harga Jual TikTok</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={tiktokSellingPrice || ''}
                  onChange={(e) => setTiktokSellingPrice(Number(e.target.value))}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Menyimpan...' : 'Simpan Produk'}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};
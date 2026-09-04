'use client';

import React, { useState } from 'react';
import { MasterProduct, User } from '@/types';
import { formatRupiah } from '@/constants';
import { Plus, Search, Edit2, Trash2, Tag, ShieldCheck, Percent, Download } from 'lucide-react';
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
import { StoreIcon, PhoneIcon } from '@/components/shared/icons';

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
  const [onlineSellingPrice, setOnlineSellingPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setVariant('');
    setCostPrice(0);
    setOfflineSellingPrice(0);
    setOnlineSellingPrice(0);
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
    setOnlineSellingPrice(prod.onlineSellingPrice);
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
        onlineSellingPrice: Number(onlineSellingPrice),
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
    const headers = ['SKU', 'Nama Produk', 'Varian', 'Modal (COGS)', 'Jual Offline', 'Jual Online'];
    const rows = filteredProducts.map(p => [
      p.sku,
      `"${p.name}"`,
      `"${p.variant}"`,
      p.costPrice,
      p.offlineSellingPrice,
      p.onlineSellingPrice
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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-start gap-2 leading-tight">
            <Tag className="w-6 h-6 text-primary flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Master Data &amp; Pricing</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-lg">
            Kelola katalog master produk, harga modal, serta penetapan harga jual Offline &amp; Online secara terpusat untuk seluruh cabang.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExportCSV} className="h-11 md:h-10 text-xs md:text-sm font-bold shadow-sm flex-1 sm:flex-none">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={openCreateModal} className="h-11 md:h-10 text-xs md:text-sm font-bold shadow-sm flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Produk
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Cari nama, SKU, atau varian..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 md:h-10 text-xs md:text-sm bg-background shadow-sm border-border rounded-xl md:rounded-lg focus-visible:ring-primary/30 transition-all"
        />
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-border hidden md:block overflow-hidden rounded-xl bg-card">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">SKU</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Produk &amp; Varian</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Modal (COGS)</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Jual Offline</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Jual Online</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Margin (%)</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  Belum ada master produk yang tersimpan.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => {
                const offMargin = p.offlineSellingPrice > 0 ? ((p.offlineSellingPrice - p.costPrice) / p.offlineSellingPrice) * 100 : 0;
                const onMargin = p.onlineSellingPrice > 0 ? ((p.onlineSellingPrice - p.costPrice) / p.onlineSellingPrice) * 100 : 0;
                return (
                  <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-muted-foreground font-medium text-xs py-4">{p.sku}</TableCell>
                    <TableCell>
                      <div className="font-bold text-foreground text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.variant}</div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground font-medium text-xs">
                      {formatRupiah(p.costPrice)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-emerald-600 text-sm">{formatRupiah(p.offlineSellingPrice)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary text-sm">{formatRupiah(p.onlineSellingPrice)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-[11px] font-semibold space-y-1">
                        <div className="text-emerald-600 flex items-center gap-1.5"><StoreIcon className="w-3 h-3"/> {offMargin.toFixed(1)}%</div>
                        <div className="text-primary flex items-center gap-1.5"><PhoneIcon className="w-3 h-3"/> {onMargin.toFixed(1)}%</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(p)} className="h-8 text-xs font-semibold hover:border-primary hover:text-primary transition-colors">
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
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
          <div className="p-8 text-center text-muted-foreground text-sm bg-card rounded-xl border border-border">
            Belum ada produk.
          </div>
        ) : (
          filteredProducts.map((p) => {
            const offMargin = p.offlineSellingPrice > 0 ? ((p.offlineSellingPrice - p.costPrice) / p.offlineSellingPrice) * 100 : 0;
            const onMargin = p.onlineSellingPrice > 0 ? ((p.onlineSellingPrice - p.costPrice) / p.onlineSellingPrice) * 100 : 0;
            return (
              <Card key={p.id} className="border-border shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-foreground text-base leading-tight">{p.name}</h4>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{p.variant}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="font-mono">{p.sku}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Modal (COGS)</span>
                      <span className="font-mono text-foreground/80 font-medium">{formatRupiah(p.costPrice)}</span>
                    </div>
                    <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                      <span className="text-foreground/80 font-bold flex items-center gap-1.5"><StoreIcon className="w-3.5 h-3.5"/> Offline</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-700">{formatRupiah(p.offlineSellingPrice)}</span>
                        <span className="text-[10px] text-emerald-600 ml-1">({offMargin.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="pt-1 flex justify-between items-center text-xs">
                      <span className="text-foreground/80 font-bold flex items-center gap-1.5"><PhoneIcon className="w-3.5 h-3.5"/> Online</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-indigo-700">{formatRupiah(p.onlineSellingPrice)}</span>
                        <span className="text-[10px] text-indigo-600 ml-1">({onMargin.toFixed(0)}%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 h-9 text-xs font-semibold" onClick={() => openEditModal(p)}>
                      <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" className="h-9 px-3 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-4 h-4" />
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
        icon={<ShieldCheck className="w-5 h-5" />}
      >
        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">SKU Produk</Label>
              <Input
                required
                placeholder="mis. KB-OR-SM"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="h-11 md:h-10 text-sm md:text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Varian</Label>
              <Input
                required
                placeholder="mis. Small"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="h-11 md:h-10 text-sm md:text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Nama Produk</Label>
            <Input
              required
              placeholder="mis. Kebab Original Beef"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 md:h-10 text-sm md:text-xs"
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-4">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-foreground/80" /> Penetapan Harga &amp; Margin
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground/80">Harga Modal (HQ Cost)</Label>
              <Input
                type="number"
                required
                min={0}
                value={costPrice || ''}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="h-11 md:h-10 text-sm md:text-xs font-mono bg-card"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-emerald-700">Harga Jual Offline</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={offlineSellingPrice || ''}
                  onChange={(e) => setOfflineSellingPrice(Number(e.target.value))}
                  className="h-11 md:h-10 text-sm md:text-xs font-mono bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-indigo-700">Harga Jual Online</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={onlineSellingPrice || ''}
                  onChange={(e) => setOnlineSellingPrice(Number(e.target.value))}
                  className="h-11 md:h-10 text-sm md:text-xs font-mono bg-card"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 h-11 md:h-10 text-xs font-bold">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11 md:h-10 text-xs font-bold bg-primary text-white hover:bg-primary/90">
              {loading ? 'Menyimpan...' : 'Simpan Produk'}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};



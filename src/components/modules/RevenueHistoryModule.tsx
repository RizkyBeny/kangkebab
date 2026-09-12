'use client';

import React, { useState } from 'react';
import { SalesTransaction, Branch, User } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { AlertTriangle, DollarSign, Download, History, Loader2, Music2, Pencil, ShoppingBag, Smartphone, Store, Trash2 } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { EditTransactionModal } from './EditTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface RevenueHistoryModuleProps {
  transactions: SalesTransaction[];
  branches: Branch[];
  currentUser: User;
  onRefresh?: () => void;
}

const channelBadge = (channel: SalesTransaction['channel'], platform?: string | null) => {
  const isOnline = channel === 'ONLINE';
  return (
    <Badge
      className={
        isOnline
          ? 'border-transparent bg-sky-100 text-sky-700'
          : 'border-transparent bg-emerald-100 text-emerald-700'
      }
    >
      {isOnline ? <Smartphone /> : <Store />}
      {channel} {platform && platform !== 'NONE' ? `(${platform})` : ''}
    </Badge>
  );
};

const paymentBadge = (status?: string | null) => (
  <Badge
    className={
      status === 'PAID'
        ? 'border-transparent bg-emerald-100 text-emerald-700'
        : 'border-transparent bg-amber-100 text-amber-700'
    }
  >
    {status || '-'}
  </Badge>
);

export const RevenueHistoryModule: React.FC<RevenueHistoryModuleProps> = ({
  transactions,
  branches,
  currentUser,
  onRefresh,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [activeReceipt, setActiveReceipt] = useState<SalesTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SalesTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<SalesTransaction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState('');

  const [localTransactions, setLocalTransactions] = useState<SalesTransaction[]>(transactions);

  // Sync with props if transactions change from outside (e.g. initial load)
  React.useEffect(() => {
    setLocalTransactions(transactions);
  }, [transactions]);

  const filteredTransactions = localTransactions.filter((t) => {
    if (selectedChannel !== 'ALL' && t.channel !== selectedChannel) return false;
    if (selectedChannel === 'ONLINE' && selectedPlatform !== 'ALL' && t.platform !== selectedPlatform)
      return false;
    if (currentUser.role === 'CABANG_STAFF' && t.branchId !== currentUser.branchId) return false;
    if (currentUser.role === 'HQ_ADMIN' && selectedBranchId !== 'ALL' && t.branchId !== selectedBranchId)
      return false;
    return true;
  });

  const historyTotals = {
    total: filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0),
    offline: filteredTransactions
      .filter((t) => t.channel === 'OFFLINE')
      .reduce((sum, t) => sum + t.totalAmount, 0),
    shopee: filteredTransactions
      .filter((t) => t.platform === 'SHOPEE')
      .reduce((sum, t) => sum + t.totalAmount, 0),
    tiktok: filteredTransactions
      .filter((t) => t.platform === 'TIKTOK')
      .reduce((sum, t) => sum + t.totalAmount, 0),
  };

  const handleExportCSV = () => {
    const headers = [
      'No. Struk',
      'Waktu',
      'Cabang',
      'Channel',
      'Platform',
      'Reseller',
      'Diskon (%)',
      'Diskon (Rp)',
      'Customer',
      'No. HP',
      'Metode Pembayaran',
      'Status Pembayaran',
      'Total Omzet (Rp)',
      'Total Modal (Rp)',
      'Item Terjual'
    ];
    
    const rows = filteredTransactions.map(t => {
      const itemsStr = t.items.map(i => `${i.masterProduct.name} (${i.qty}x)`).join('; ');
      return [
        t.transactionNumber,
        formatDate(t.createdAt),
        `"${t.branch.name}"`,
        t.channel,
        t.platform || '-',
        t.isReseller ? 'YA' : 'TIDAK',
        t.discountPercent > 0 ? t.discountPercent : 0,
        t.discountAmount > 0 ? t.discountAmount : 0,
        `"${t.customerName || '-'}"`,
        `"${t.customerPhone || '-'}"`,
        t.paymentMethod || '-',
        t.paymentStatus || '-',
        t.totalAmount,
        t.totalCost,
        `"${itemsStr}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Riwayat_Transaksi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/pos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deletingTransaction.id,
          branchId: deletingTransaction.branchId,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const deletedId = deletingTransaction.id;
      setLocalTransactions((prev) => prev.filter((t) => t.id !== deletedId));
      setDeletingTransaction(null);
      if (editingTransaction?.id === deletedId) setEditingTransaction(null);
      onRefresh?.();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus transaksi');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredIds = filteredTransactions.map((t) => t.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = filteredIds;
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const openBulkDelete = () => {
    setBulkError('');
    setConfirmedIds(Array.from(selectedIds));
  };

  const handleBulkDelete = async () => {
    if (confirmedIds.length === 0) return;
    setDeleteLoading(true);
    setBulkError('');

    try {
      const res = await fetch('/api/pos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: confirmedIds,
          branchId: currentUser.branchId || undefined,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const deletedSet = new Set(confirmedIds);
      setLocalTransactions((prev) => prev.filter((t) => !deletedSet.has(t.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        confirmedIds.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmedIds([]);
      if (editingTransaction && deletedSet.has(editingTransaction.id)) setEditingTransaction(null);
      onRefresh?.();
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : 'Gagal menghapus transaksi terpilih');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Riwayat Pendapatan & Transaksi"
        description="Pantau seluruh riwayat transaksi omzet secara terperinci (Online & Offline). Anda juga bisa mengunduh ulang struk PDF kapan saja."
        icon={History}
        actions={
          <>
            {currentUser.role === 'HQ_ADMIN' && (
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val || '')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={selectedChannel}
              onValueChange={(val) => {
                setSelectedChannel(val || '');
                if (val !== 'ONLINE') setSelectedPlatform('ALL');
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Semua Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Channel</SelectItem>
                <SelectItem value="OFFLINE">Offline Toko</SelectItem>
                <SelectItem value="ONLINE">Online (Shopee/TikTok)</SelectItem>
              </SelectContent>
            </Select>

            {selectedChannel === 'ONLINE' && (
              <Select value={selectedPlatform} onValueChange={(val) => setSelectedPlatform(val || '')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Semua Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Platform</SelectItem>
                  <SelectItem value="SHOPEE">Shopee</SelectItem>
                  <SelectItem value="TIKTOK">TikTok</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button variant="outline" onClick={handleExportCSV}>
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      {/* Channel Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Omzet</CardTitle>
            <CardAction>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">{formatRupiah(historyTotals.total)}</div>
            <p className="text-xs text-muted-foreground">{filteredTransactions.length} transaksi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Channel Offline</CardTitle>
            <CardAction>
              <Store className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">{formatRupiah(historyTotals.offline)}</div>
            <p className="text-xs text-muted-foreground">Penjualan langsung di kasir toko fisik</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Channel Shopee</CardTitle>
            <CardAction>
              <ShoppingBag className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">{formatRupiah(historyTotals.shopee)}</div>
            <p className="text-xs text-muted-foreground">Penjualan via Shopee Marketplace</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Channel TikTok</CardTitle>
            <CardAction>
              <Music2 className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight tabular-nums">{formatRupiah(historyTotals.tiktok)}</div>
            <p className="text-xs text-muted-foreground">Penjualan via TikTok Shop</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Selection Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 select-none">
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={toggleSelectAll}
              disabled={filteredTransactions.length === 0}
            />
            <span className="text-sm font-medium">Pilih Semua ({filteredTransactions.length})</span>
          </label>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} transaksi dipilih` : 'Tidak ada yang dipilih'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
              Batalkan Pilihan
            </Button>
          )}
          <Button
            variant="outline"
            onClick={openBulkDelete}
            disabled={selectedIds.size === 0}
            className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-40"
          >
            <Trash2 />
            Hapus Terpilih
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={filteredTransactions.length === 0}
                />
              </TableHead>
              <TableHead>No. Struk</TableHead>
              <TableHead>Cabang &amp; Waktu</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Produk Terjual</TableHead>
              <TableHead>Total Omzet</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  Tidak ada transaksi yang cocok dengan filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((t) => (
                <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-muted/50' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-semibold">{t.transactionNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.branch.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDate(t.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {channelBadge(t.channel, t.platform)}
                      {t.isReseller && <Badge className="border-transparent bg-amber-100 text-amber-800">Reseller</Badge>}
                    </div>
                    {t.isReseller && t.discountPercent > 0 && (
                      <div className="mt-1 text-xs text-rose-600 font-medium">
                        -{t.discountPercent}% ({formatRupiah(t.discountAmount)})
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-1 max-w-[200px]">
                      {t.items.map((i) => (
                        <div key={i.id} className="truncate" title={`${i.masterProduct.name} (${i.qty}x)`}>
                          {i.masterProduct.name} <span className="text-muted-foreground">({i.qty}x)</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatRupiah(t.totalAmount)}</TableCell>
                  <TableCell>
                    <div className="text-xs font-medium">{t.paymentMethod || '-'}</div>
                    <div className="mt-1">{paymentBadge(t.paymentStatus)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditingTransaction(t)} title="Edit Transaksi">
                        <Pencil /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setActiveReceipt(t)} title="Unduh Struk PDF">
                        <Download />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDeleteError(''); setDeletingTransaction(t); }}
                        className="text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                        title="Hapus Transaksi"
                      >
                        <Trash2 />
                      </Button>
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
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon={History}
            title="Tidak ada transaksi"
            description="Tidak ada transaksi yang cocok dengan filter saat ini."
          />
        ) : (
          filteredTransactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-mono font-semibold">{t.transactionNumber}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatDate(t.createdAt)}</div>
                    </div>
                  </div>
                  {channelBadge(t.channel, t.platform)}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{t.branch.name}</Badge>
                  {t.isReseller && <Badge className="border-transparent bg-amber-100 text-amber-800">Reseller</Badge>}
                  {t.isReseller && t.discountPercent > 0 && (
                    <span className="text-xs text-rose-600 font-medium">
                      Diskon -{t.discountPercent}% ({formatRupiah(t.discountAmount)})
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border/70 text-sm">
                  <div className="py-1.5 first:pt-0">
                    <div className="text-xs text-muted-foreground mb-1">Item Terjual ({t.items.length})</div>
                    <div className="space-y-1">
                      {t.items.map((i) => (
                        <div key={i.id} className="flex justify-between text-xs">
                          <span className="truncate pr-2">{i.masterProduct.name}</span>
                          <span className="tabular-nums">{i.qty}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="font-medium">Total Omzet</span>
                    <span className="font-semibold tabular-nums">{formatRupiah(t.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 last:pb-0">
                    <span className="text-muted-foreground">Pembayaran</span>
                    <div className="flex items-center gap-1.5">
                      <span>{t.paymentMethod || '-'}</span>
                      {paymentBadge(t.paymentStatus)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingTransaction(t)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setActiveReceipt(t)}>
                    <Download /> Struk
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setDeleteError(''); setDeletingTransaction(t); }}
                    className="text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                    title="Hapus Transaksi"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {activeReceipt && <ReceiptModal transaction={activeReceipt} onClose={() => setActiveReceipt(null)} />}
      
      {editingTransaction && (
        <EditTransactionModal 
          transaction={editingTransaction} 
          onClose={() => setEditingTransaction(null)}
          onSuccess={(updatedTx) => {
            setLocalTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
            setEditingTransaction(null);
          }}
        />
      )}

      {/* Delete Single */}
      <ResponsiveModal
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && !deleteLoading && setDeletingTransaction(null)}
        title="Hapus Transaksi"
      >
        {deletingTransaction && (
          <div className="space-y-5">
            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{deleteError}</AlertDescription>
              </Alert>
            )}

            <div className="divide-y divide-border/70 rounded-lg border border-border px-4 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">No. Struk</span>
                <span className="font-mono font-medium">{deletingTransaction.transactionNumber}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Cabang</span>
                <span className="font-medium">{deletingTransaction.branch.name}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Total Omzet</span>
                <span className="font-semibold tabular-nums">{formatRupiah(deletingTransaction.totalAmount)}</span>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                Transaksi ini akan dihapus permanen. Stok sebanyak {deletingTransaction.items.reduce((acc, i) => acc + i.qty, 0)} unit ({deletingTransaction.items.length} item) akan dikembalikan ke stok jual cabang.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeletingTransaction(null)} disabled={deleteLoading}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Hapus Transaksi
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Delete Bulk */}
      <ResponsiveModal
        open={confirmedIds.length > 0}
        onOpenChange={(open) => !open && !deleteLoading && setConfirmedIds([])}
        title="Hapus Transaksi Terpilih"
      >
        {confirmedIds.length > 0 && (
          <div className="space-y-5">
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{bulkError}</AlertDescription>
              </Alert>
            )}

            <div className="divide-y divide-border/70 rounded-lg border border-border px-4 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Jumlah Transaksi</span>
                <span className="font-medium tabular-nums">{confirmedIds.length} transaksi</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Total Omzet</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(confirmedIds.reduce((acc, id) => {
                    const tx = localTransactions.find((t) => t.id === id);
                    return acc + (tx?.totalAmount || 0);
                  }, 0))}
                </span>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                {confirmedIds.length} transaksi terpilih akan dihapus permanen. Seluruh stok produk yang terjual akan dikembalikan ke stok jual cabang. Tindakan ini tidak dapat dibatalkan.
              </AlertDescription>
            </Alert>

            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border">
              {localTransactions
                .filter((t) => confirmedIds.includes(t.id))
                .map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-border/70 px-4 py-2 text-xs last:border-0">
                    <span className="font-mono font-medium truncate pr-2">{t.transactionNumber}</span>
                    <span className="font-semibold tabular-nums">{formatRupiah(t.totalAmount)}</span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmedIds([])} disabled={deleteLoading}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={deleteLoading}>
                {deleteLoading ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Hapus {confirmedIds.length} Transaksi
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
};
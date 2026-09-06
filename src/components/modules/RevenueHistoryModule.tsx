'use client';

import React, { useState } from 'react';
import { SalesTransaction, Branch, User } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { History, Download, Filter, Eye, Store, Smartphone, Trash2, Loader2, AlertTriangle, DollarSign, ShoppingBag, Music2 } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { EditTransactionModal } from './EditTransactionModal';
import { Button } from '@/components/ui/button';
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
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RevenueHistoryModuleProps {
  transactions: SalesTransaction[];
  branches: Branch[];
  currentUser: User;
  onRefresh?: () => void;
}

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-start gap-2 leading-tight">
            <History className="w-6 h-6 text-foreground/80 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Riwayat Pendapatan &amp; Transaksi</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-lg">
            Pantau seluruh riwayat transaksi omzet secara terperinci (Online &amp; Offline). Anda juga bisa mengunduh ulang struk PDF kapan saja.
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {currentUser.role === 'HQ_ADMIN' && (
            <div className="flex items-center space-x-1.5">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val || '')}>
                <SelectTrigger className="w-40 h-10 md:h-9 text-xs font-semibold bg-card shadow-sm border-border">
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Semua Cabang</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-1.5">
            <Select
              value={selectedChannel}
              onValueChange={(val) => {
                setSelectedChannel(val || '');
                if (val !== 'ONLINE') setSelectedPlatform('ALL');
              }}
            >
              <SelectTrigger className="w-40 h-10 md:h-9 text-xs font-semibold bg-card shadow-sm border-border">
                <SelectValue placeholder="Semua Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Channel</SelectItem>
                <SelectItem value="OFFLINE" className="text-xs">Offline Toko</SelectItem>
                <SelectItem value="ONLINE" className="text-xs">Online (Shopee/TikTok)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedChannel === 'ONLINE' && (
            <div className="flex items-center space-x-1.5">
              <Select value={selectedPlatform} onValueChange={(val) => setSelectedPlatform(val || '')}>
                <SelectTrigger className="w-40 h-10 md:h-9 text-xs font-semibold bg-card shadow-sm border-border">
                  <SelectValue placeholder="Semua Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Semua Platform</SelectItem>
                  <SelectItem value="SHOPEE" className="text-xs">Shopee</SelectItem>
                  <SelectItem value="TIKTOK" className="text-xs">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Button variant="outline" onClick={handleExportCSV} className="h-10 md:h-9 text-xs font-bold bg-card shadow-sm border-border">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Channel Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Omzet</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(historyTotals.total)}
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-emerald-600 font-bold mt-1">
              <span>{filteredTransactions.length} Transaksi</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Channel Offline</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(historyTotals.offline)}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1">
              Penjualan langsung di kasir toko fisik
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Channel Shopee</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(historyTotals.shopee)}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1">
              Penjualan via Shopee Marketplace
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Channel TikTok</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Music2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-foreground font-mono tracking-tight">
              {formatRupiah(historyTotals.tiktok)}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1">
              Penjualan via TikTok Shop
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Selection Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border accent-rose-600"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              disabled={filteredTransactions.length === 0}
            />
            <span className="text-xs font-bold text-foreground/80">Pilih Semua ({filteredTransactions.length})</span>
          </label>
          <span className="text-xs text-muted-foreground font-medium">
            {selectedIds.size > 0 ? `${selectedIds.size} transaksi dipilih` : 'Tidak ada yang dipilih'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              className="h-9 text-xs font-bold bg-card border-border hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
              onClick={() => setSelectedIds(new Set())}
            >
              Batalkan Pilihan
            </Button>
          )}
          <Button
            variant="outline"
            onClick={openBulkDelete}
            disabled={selectedIds.size === 0}
            className="h-9 text-xs font-bold bg-card border-border text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Hapus Terpilih
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border accent-rose-600"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filteredTransactions.length === 0}
                />
              </TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">No. Struk</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cabang &amp; Waktu</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Channel</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Produk Terjual</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Omzet</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Pembayaran</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  Tidak ada transaksi yang cocok dengan filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((t) => (
                <TableRow key={t.id} className={`group transition-colors ${selectedIds.has(t.id) ? 'bg-rose-50/40' : 'hover:bg-muted/30'}`}>
                  <TableCell className="py-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border accent-rose-600"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold text-foreground text-sm py-4">{t.transactionNumber}</TableCell>
                  <TableCell>
                    <div className="font-bold text-foreground text-sm">{t.branch.name}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">{formatDate(t.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold py-1 px-2 ${
                        t.channel === 'ONLINE'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {t.channel === 'ONLINE' ? <Smartphone className="w-3.5 h-3.5 mr-1" /> : <Store className="w-3.5 h-3.5 mr-1" />}
                      {t.channel} {t.platform && t.platform !== 'NONE' ? `(${t.platform})` : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-1">
                      {t.items.map((i) => (
                        <div key={i.id} className="text-foreground/80 font-medium truncate max-w-[200px]" title={`${i.masterProduct.name} (${i.qty}x)`}>
                          • {i.masterProduct.name} <span className="text-muted-foreground">({i.qty}x)</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-foreground font-mono text-sm">
                    {formatRupiah(t.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-foreground/80">{t.paymentMethod || '-'}</div>
                    <Badge variant="outline" className={`mt-1 text-[10px] ${t.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {t.paymentStatus || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTransaction(t)}
                        className="h-8 text-xs font-bold bg-card px-2"
                        title="Edit Transaksi"
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveReceipt(t)}
                        className="h-8 text-xs font-bold bg-card px-2"
                        title="Unduh Struk PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-foreground/80" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDeleteError(''); setDeletingTransaction(t); }}
                        className="h-8 text-xs font-bold bg-card px-2 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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
          <div className="p-8 text-center text-muted-foreground text-sm bg-card rounded-xl border border-border">
            Tidak ada transaksi.
          </div>
        ) : (
          filteredTransactions.map((t) => (
            <Card key={t.id} className="border-border shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 rounded border-border accent-rose-600"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                    <div>
                      <div className="font-mono font-bold text-foreground text-sm">{t.transactionNumber}</div>
                      <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{formatDate(t.createdAt)}</div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      t.channel === 'ONLINE'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {t.channel} {t.platform && t.platform !== 'NONE' ? `(${t.platform})` : ''}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-border/60">
                    <span className="text-muted-foreground font-medium">Cabang</span>
                    <span className="font-bold text-foreground/80">{t.branch.name}</span>
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Item Terjual ({t.items.length})</div>
                    <div className="space-y-1">
                      {t.items.map((i) => (
                        <div key={i.id} className="flex justify-between text-[11px] font-medium text-foreground/80">
                          <span className="truncate pr-2">{i.masterProduct.name}</span>
                          <span className="whitespace-nowrap">{i.qty}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/60 flex justify-between items-center text-sm">
                    <span className="text-foreground/80 font-bold">Total Omzet</span>
                    <span className="font-mono font-bold text-foreground">{formatRupiah(t.totalAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                    <span className="text-foreground/80 font-medium">Pembayaran</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground/80">{t.paymentMethod || '-'}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${t.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {t.paymentStatus || '-'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 text-xs font-bold" onClick={() => setEditingTransaction(t)}>
                    ✏️ Edit
                  </Button>
                  <Button variant="outline" className="flex-1 h-10 text-xs font-bold" onClick={() => setActiveReceipt(t)}>
                    <Eye className="w-4 h-4 mr-2" /> Struk
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 w-10 px-0 text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                    title="Hapus Transaksi"
                    onClick={() => { setDeleteError(''); setDeletingTransaction(t); }}
                  >
                    <Trash2 className="w-4 h-4" />
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

      {deletingTransaction && (
        <ResponsiveModal
          open={true}
          onOpenChange={(open) => !open && !deleteLoading && setDeletingTransaction(null)}
          title="Hapus Transaksi"
          icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        >
          <div className="space-y-4">
            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{deleteError}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">No. Struk</span>
                <span className="font-mono text-sm font-bold text-foreground">{deletingTransaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Cabang</span>
                <span className="text-sm font-bold text-foreground/80">{deletingTransaction.branch.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Total Omzet</span>
                <span className="font-mono text-sm font-bold text-foreground">{formatRupiah(deletingTransaction.totalAmount)}</span>
              </div>
            </div>

            <Alert variant="destructive" className="text-xs">
              <AlertDescription className="text-xs">
                Transaksi ini akan dihapus permanen. Stok sebanyak {deletingTransaction.items.reduce((acc, i) => acc + i.qty, 0)} unit ({deletingTransaction.items.length} item) akan dikembalikan ke stok jual cabang.
              </AlertDescription>
            </Alert>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingTransaction(null)} disabled={deleteLoading} className="h-9 text-xs font-semibold px-4">
                Batal
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="h-9 text-xs font-semibold px-6 bg-rose-600 text-white hover:bg-rose-700"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Hapus Transaksi
              </Button>
            </div>
          </div>
        </ResponsiveModal>
      )}

      {confirmedIds.length > 0 && (
        <ResponsiveModal
          open={true}
          onOpenChange={(open) => !open && !deleteLoading && setConfirmedIds([])}
          title="Hapus Transaksi Terpilih"
          icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        >
          <div className="space-y-4">
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{bulkError}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Jumlah Transaksi</span>
                <span className="font-mono text-sm font-bold text-foreground">{confirmedIds.length} transaksi</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Total Omzet</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {formatRupiah(confirmedIds.reduce((acc, id) => {
                    const tx = localTransactions.find((t) => t.id === id);
                    return acc + (tx?.totalAmount || 0);
                  }, 0))}
                </span>
              </div>
            </div>

            <Alert variant="destructive" className="text-xs">
              <AlertDescription className="text-xs">
                {confirmedIds.length} transaksi terpilih akan dihapus permanen. Seluruh stok produk yang terjual akan dikembalikan ke stok jual cabang. Tindakan ini tidak dapat dibatalkan.
              </AlertDescription>
            </Alert>

            <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border bg-muted/30">
              {localTransactions
                .filter((t) => confirmedIds.includes(t.id))
                .map((t) => (
                  <div key={t.id} className="flex justify-between items-center px-4 py-2 border-b border-border/60 last:border-0">
                    <span className="font-mono text-[11px] font-bold text-foreground/80 truncate pr-2">{t.transactionNumber}</span>
                    <span className="font-mono text-[11px] font-bold text-foreground whitespace-nowrap">{formatRupiah(t.totalAmount)}</span>
                  </div>
                ))}
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmedIds([])} disabled={deleteLoading} className="h-9 text-xs font-semibold px-4">
                Batal
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="h-9 text-xs font-semibold px-6 bg-rose-600 text-white hover:bg-rose-700"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Hapus {confirmedIds.length} Transaksi
              </Button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { SalesTransaction, Branch, User } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { History, Download, Filter, Eye, Store, Smartphone } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { EditTransactionModal } from './EditTransactionModal';
import { Button } from '@/components/ui/button';
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
}

export const RevenueHistoryModule: React.FC<RevenueHistoryModuleProps> = ({
  transactions,
  branches,
  currentUser,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [activeReceipt, setActiveReceipt] = useState<SalesTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SalesTransaction | null>(null);

  const [localTransactions, setLocalTransactions] = useState<SalesTransaction[]>(transactions);

  // Sync with props if transactions change from outside (e.g. initial load)
  React.useEffect(() => {
    setLocalTransactions(transactions);
  }, [transactions]);

  const filteredTransactions = localTransactions.filter((t) => {
    if (selectedChannel !== 'ALL' && t.channel !== selectedChannel) return false;
    if (currentUser.role === 'CABANG_STAFF' && t.branchId !== currentUser.branchId) return false;
    if (currentUser.role === 'HQ_ADMIN' && selectedBranchId !== 'ALL' && t.branchId !== selectedBranchId)
      return false;
    return true;
  });

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

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-start gap-2 leading-tight">
            <History className="w-6 h-6 text-slate-700 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Riwayat Pendapatan &amp; Transaksi</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 font-medium leading-relaxed max-w-lg">
            Pantau seluruh riwayat transaksi omzet secara terperinci (Online &amp; Offline). Anda juga bisa mengunduh ulang struk PDF kapan saja.
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {currentUser.role === 'HQ_ADMIN' && (
            <div className="flex items-center space-x-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val || '')}>
                <SelectTrigger className="w-40 h-10 md:h-9 text-xs font-semibold bg-white shadow-sm border-slate-200">
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
            <Select value={selectedChannel} onValueChange={(val) => setSelectedChannel(val || '')}>
              <SelectTrigger className="w-40 h-10 md:h-9 text-xs font-semibold bg-white shadow-sm border-slate-200">
                <SelectValue placeholder="Semua Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Semua Channel</SelectItem>
                <SelectItem value="OFFLINE" className="text-xs">Offline Toko</SelectItem>
                <SelectItem value="ONLINE" className="text-xs">Online (Shopee/TikTok)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={handleExportCSV} className="h-10 md:h-9 text-xs font-bold bg-white shadow-sm border-slate-200">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-slate-200 hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-4">No. Struk</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cabang &amp; Waktu</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Channel</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produk Terjual</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Omzet</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pembayaran</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-sm">
                  Tidak ada transaksi yang cocok dengan filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((t) => (
                <TableRow key={t.id} className="group transition-colors hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold text-slate-900 text-sm py-4">{t.transactionNumber}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900 text-sm">{t.branch.name}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">{formatDate(t.createdAt)}</div>
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
                        <div key={i.id} className="text-slate-700 font-medium truncate max-w-[200px]" title={`${i.masterProduct.name} (${i.qty}x)`}>
                          • {i.masterProduct.name} <span className="text-slate-400">({i.qty}x)</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 font-mono text-sm">
                    {formatRupiah(t.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-slate-700">{t.paymentMethod || '-'}</div>
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
                        className="h-8 text-xs font-bold bg-white px-2"
                        title="Edit Transaksi"
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveReceipt(t)}
                        className="h-8 text-xs font-bold bg-white px-2"
                        title="Unduh Struk PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
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
          <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            Tidak ada transaksi.
          </div>
        ) : (
          filteredTransactions.map((t) => (
            <Card key={t.id} className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{t.transactionNumber}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">{formatDate(t.createdAt)}</div>
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

                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Cabang</span>
                    <span className="font-bold text-slate-700">{t.branch.name}</span>
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Item Terjual ({t.items.length})</div>
                    <div className="space-y-1">
                      {t.items.map((i) => (
                        <div key={i.id} className="flex justify-between text-[11px] font-medium text-slate-700">
                          <span className="truncate pr-2">{i.masterProduct.name}</span>
                          <span className="whitespace-nowrap">{i.qty}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-bold">Total Omzet</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(t.totalAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">Pembayaran</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">{t.paymentMethod || '-'}</span>
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
    </div>
  );
};

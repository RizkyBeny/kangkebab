'use client';

import React, { useState } from 'react';
import { MasterProduct, Shipment, Branch, User } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { Truck, Send, Plus, Trash2, CheckCircle2, Clock, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HQDispatchModuleProps {
  products: MasterProduct[];
  shipments: Shipment[];
  branches: Branch[];
  currentUser: User;
  onRefresh: () => void;
}

export const HQDispatchModule: React.FC<HQDispatchModuleProps> = ({
  products,
  shipments,
  branches,
  currentUser,
  onRefresh,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  
  const [targetBranchId, setTargetBranchId] = useState('');
  const [dispatchItems, setDispatchItems] = useState<{ masterProductId: string; qtySent: number; costPrice: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetBranches = branches.filter((b) => b.code !== 'HQ');

  const openModal = () => {
    setTargetBranchId(targetBranches[0]?.id || '');
    setDispatchItems([]);
    setErrorMsg('');
    setShowModal(true);
  };

  const addDispatchItemRow = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setDispatchItems([
      ...dispatchItems,
      { masterProductId: defaultProd.id, qtySent: 10, costPrice: defaultProd.costPrice },
    ]);
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    const updated = [...dispatchItems];
    if (field === 'masterProductId') {
      const selectedProd = products.find((p) => p.id === value);
      updated[index].masterProductId = value;
      if (selectedProd) {
        updated[index].costPrice = selectedProd.costPrice;
      }
    } else if (field === 'qtySent') {
      updated[index].qtySent = Number(value);
    }
    setDispatchItems(updated);
  };

  const removeItemRow = (index: number) => {
    setDispatchItems(dispatchItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      setErrorMsg('Pilih cabang tujuan');
      return;
    }
    if (dispatchItems.length === 0) {
      setErrorMsg('Tambahkan minimal 1 jenis barang yang dikirim');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: targetBranchId,
          items: dispatchItems,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim barang');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-start gap-2 leading-tight">
            <Truck className="w-6 h-6 text-slate-700 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Pengiriman Barang (HQ ke Cabang)</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 font-medium leading-relaxed max-w-lg">
            Catat alokasi pengiriman barang ke cabang. Cabang akan menerima notifikasi real-time (&lt;5 detik) untuk melakukan validasi penerimaan.
          </p>
        </div>
        <Button onClick={openModal} className="h-11 md:h-10 text-xs md:text-sm font-bold shadow-sm w-full sm:w-auto">
          <Send className="w-4 h-4 mr-2" />
          Kirim Stok Baru
        </Button>
      </div>

      {/* Desktop Table View */}
      <Card className="shadow-sm border-slate-200 hidden md:block rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-4">No. Pengiriman</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cabang Tujuan</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Waktu Dikirim</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status &amp; Diterima</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400 text-sm">
                  Belum ada riwayat pengiriman barang.
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((s) => (
                <TableRow key={s.id} className="group transition-colors hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold text-slate-900 text-sm py-4">{s.shipmentNumber}</TableCell>
                  <TableCell className="font-bold text-slate-900 text-sm">{s.branch.name}</TableCell>
                  <TableCell className="text-slate-500 text-sm font-medium">{formatDate(s.sentAt)}</TableCell>
                  <TableCell>
                    {s.status === 'DIKIRIM' ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs py-1 px-2">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Menunggu Cabang
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-2">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Divalidasi
                        </Badge>
                        <div className="text-xs text-slate-500 ml-1">
                          {s.receivedAt ? formatDate(s.receivedAt) : '-'}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setSelectedShipment(s)} className="h-8 text-xs font-semibold">
                      <Eye className="w-3.5 h-3.5 mr-2" /> Lihat Rincian
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden space-y-4">
        {shipments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            Belum ada pengiriman.
          </div>
        ) : (
          shipments.map((s) => (
            <Card key={s.id} className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{s.shipmentNumber}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Tujuan: <span className="font-bold text-slate-700">{s.branch.name}</span></div>
                  </div>
                  {s.status === 'DIKIRIM' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                      DIKIRIM
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      DITERIMA
                    </Badge>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Waktu Kirim</span>
                    <span className="text-slate-700">{formatDate(s.sentAt)}</span>
                  </div>
                  {s.status === 'DITERIMA' && s.receivedAt && (
                    <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Waktu Terima</span>
                      <span className="text-slate-700">{formatDate(s.receivedAt)}</span>
                    </div>
                  )}
                </div>

                <Button variant="outline" className="w-full h-10 text-xs font-bold" onClick={() => setSelectedShipment(s)}>
                  <Eye className="w-4 h-4 mr-2" /> Lihat Rincian Barang
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Shipment Details Modal */}
      <ResponsiveModal
        open={!!selectedShipment}
        onOpenChange={(open) => !open && setSelectedShipment(null)}
        title="Rincian Pengiriman"
        icon={<Info className="w-5 h-5" />}
      >
        {selectedShipment && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">No. Pengiriman</span>
              <span className="font-mono font-bold text-lg text-slate-900 mt-1">{selectedShipment.shipmentNumber}</span>
              <span className="text-sm font-semibold text-slate-700 mt-1">Ke: {selectedShipment.branch.name}</span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Daftar Barang ({selectedShipment.items.length})</div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {selectedShipment.items.map((item) => (
                  <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{item.masterProduct.name}</div>
                        <div className="text-[11px] text-slate-500">Varian: {item.masterProduct.variant}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-400 font-medium block">Dikirim</span>
                        <span className="font-bold text-slate-900 text-sm">{item.qtySent} unit</span>
                      </div>
                    </div>
                    {selectedShipment.status === 'DITERIMA' && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-500">Diterima Baik: </span>
                          <span className="font-bold text-emerald-600">{item.qtyReceived - item.qtyDamaged} unit</span>
                        </div>
                        {item.qtyDamaged > 0 && (
                          <div>
                            <span className="text-slate-500">Rusak: </span>
                            <span className="font-bold text-rose-600">{item.qtyDamaged} unit</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={() => setSelectedShipment(null)} className="w-full h-11 md:h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
                Tutup Rincian
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* Create Shipment Modal */}
      <ResponsiveModal
        open={showModal}
        onOpenChange={setShowModal}
        title="Input Pengiriman Barang"
        icon={<Send className="w-5 h-5" />}
      >
        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Pilih Cabang Tujuan</Label>
            <Select value={targetBranchId} onValueChange={(val) => setTargetBranchId(val || '')}>
              <SelectTrigger className="w-full text-sm md:text-xs h-11 md:h-10 bg-slate-50">
                <SelectValue placeholder="Pilih cabang..." />
              </SelectTrigger>
              <SelectContent>
                {targetBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-sm md:text-xs">
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-900">Daftar Barang Dikirim</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDispatchItemRow} className="h-8 text-xs font-bold">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
              </Button>
            </div>

            {dispatchItems.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center text-xs text-slate-500">
                Klik &quot;Tambah&quot; untuk memilih produk yang akan dikirim.
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {dispatchItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm"
                  >
                    <Select
                      value={item.masterProductId}
                      onValueChange={(val) => updateItemRow(idx, 'masterProductId', val || '')}
                    >
                      <SelectTrigger className="w-full h-11 md:h-10 text-sm md:text-xs bg-white">
                        <SelectValue placeholder="Pilih produk..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-sm md:text-xs">
                            {p.name} ({p.variant})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.qtySent}
                        onChange={(e) => updateItemRow(idx, 'qtySent', e.target.value)}
                        className="h-11 md:h-10 text-sm md:text-xs font-mono text-center bg-white flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeItemRow(idx)}
                        className="h-11 md:h-10 w-11 md:w-10 px-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 h-11 md:h-10 text-xs font-bold">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11 md:h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
              {loading ? 'Memproses...' : 'Kirim Barang'}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};

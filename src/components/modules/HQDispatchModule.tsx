'use client';

import React, { useState } from 'react';
import { MasterProduct, Shipment, ShipmentItem, Branch, User } from '@/types';
import { formatDate } from '@/constants';
import { CheckCircle2, Clock, Edit, Eye, Plus, Send, Trash2, Truck } from 'lucide-react';
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
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface HQDispatchModuleProps {
  products: MasterProduct[];
  shipments: Shipment[];
  branches: Branch[];
  currentUser: User;
  onRefresh: () => void;
}

const statusBadge = (status: Shipment['status']) => {
  if (status === 'DIKIRIM') {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-700">
        <Clock />
        Menunggu Cabang
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-emerald-100 text-emerald-700">
      <CheckCircle2 />
      Divalidasi
    </Badge>
  );
};

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

  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingShipmentId(null);
    setTargetBranchId(targetBranches[0]?.id || '');
    setDispatchItems([]);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (shipment: Shipment) => {
    setEditingShipmentId(shipment.id);
    setTargetBranchId(shipment.branchId);
    setDispatchItems(
      shipment.items.map((i: ShipmentItem) => ({
        masterProductId: i.masterProductId,
        qtySent: i.qtySent,
        costPrice: i.costPrice,
      }))
    );
    setErrorMsg('');
    setShowModal(true);
  };

  const addDispatchItemRow = () => {
    setDispatchItems([
      ...dispatchItems,
      { masterProductId: '', qtySent: 1, costPrice: 0 },
    ]);
  };

  const updateItemRow = (index: number, field: string, value: string) => {
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
    if (dispatchItems.some(item => !item.masterProductId)) {
      setErrorMsg('Mohon pilih produk untuk semua baris barang');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const url = '/api/shipments';
      const method = editingShipmentId ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: editingShipmentId,
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim barang';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Pengiriman Barang (HQ ke Cabang)"
        description="Catat alokasi pengiriman barang ke cabang. Cabang akan menerima notifikasi real-time (<5 detik) untuk melakukan validasi penerimaan."
        icon={Truck}
        actions={
          <Button onClick={openCreateModal}>
            <Send />
            Kirim Stok Baru
          </Button>
        }
      />

      {/* Desktop Table View */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pengiriman</TableHead>
              <TableHead>Cabang Tujuan</TableHead>
              <TableHead>Waktu Dikirim</TableHead>
              <TableHead>Status &amp; Diterima</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                  Belum ada riwayat pengiriman barang.
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-semibold">{s.shipmentNumber}</TableCell>
                  <TableCell className="font-medium">{s.branch.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.sentAt)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {statusBadge(s.status)}
                      {s.status === 'DITERIMA' && s.receivedAt && (
                        <div className="text-xs text-muted-foreground">{formatDate(s.receivedAt)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setSelectedShipment(s)}>
                        <Eye /> Lihat Rincian
                      </Button>
                      {s.status === 'DIKIRIM' && (
                        <Button variant="outline" size="sm" onClick={() => openEditModal(s)}>
                          <Edit /> Edit
                        </Button>
                      )}
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
        {shipments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Belum ada pengiriman"
            description="Kirim stok ke cabang melalui tombol Kirim Stok Baru."
          />
        ) : (
          shipments.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-semibold">{s.shipmentNumber}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Tujuan: <span className="font-medium text-foreground">{s.branch.name}</span>
                    </div>
                  </div>
                  {s.status === 'DIKIRIM' ? (
                    <Badge variant="outline">DIKIRIM</Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-700">DITERIMA</Badge>
                  )}
                </div>

                <div className="divide-y divide-border/70 text-sm">
                  <div className="flex items-center justify-between py-1.5 first:pt-0">
                    <span className="text-muted-foreground">Waktu Kirim</span>
                    <span>{formatDate(s.sentAt)}</span>
                  </div>
                  {s.status === 'DITERIMA' && s.receivedAt && (
                    <div className="flex items-center justify-between py-1.5 last:pb-0">
                      <span className="text-muted-foreground">Waktu Terima</span>
                      <span>{formatDate(s.receivedAt)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedShipment(s)}>
                    <Eye /> Rincian
                  </Button>
                  {s.status === 'DIKIRIM' && (
                    <Button variant="outline" className="flex-1" onClick={() => openEditModal(s)}>
                      <Edit /> Edit
                    </Button>
                  )}
                </div>
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
      >
        {selectedShipment && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/30 px-4 py-6 text-center">
              <span className="text-xs text-muted-foreground">No. Pengiriman</span>
              <span className="font-mono text-lg font-semibold">{selectedShipment.shipmentNumber}</span>
              <span className="text-sm text-muted-foreground">Ke: {selectedShipment.branch.name}</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Daftar Barang ({selectedShipment.items.length})</p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {selectedShipment.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{item.masterProduct.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Varian: {item.masterProduct.variant}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-xs text-muted-foreground mb-0.5">Dikirim</div>
                        <span className="font-semibold tabular-nums">{item.qtySent} unit</span>
                      </div>
                    </div>
                    {selectedShipment.status === 'DITERIMA' && (
                      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Diterima Baik: </span>
                          <span className="font-semibold text-emerald-600 tabular-nums">{item.qtyReceived - item.qtyDamaged} unit</span>
                        </div>
                        {item.qtyDamaged > 0 && (
                          <div>
                            <span className="text-muted-foreground">Rusak: </span>
                            <span className="font-semibold text-rose-600 tabular-nums">{item.qtyDamaged} unit</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => setSelectedShipment(null)} className="w-full">
              Tutup Rincian
            </Button>
          </div>
        )}
      </ResponsiveModal>

      {/* Create / Edit Shipment Modal */}
      <ResponsiveModal
        open={showModal}
        onOpenChange={setShowModal}
        title={editingShipmentId ? 'Edit Pengiriman Barang' : 'Input Pengiriman Barang'}
      >
        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Pilih Cabang Tujuan</Label>
            <Select value={targetBranchId} onValueChange={(val) => setTargetBranchId(val || '')} disabled={!!editingShipmentId}>
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left">
                  {targetBranchId 
                    ? (() => {
                        const b = targetBranches.find((x) => x.id === targetBranchId);
                        return b ? `${b.name} (${b.code})` : "Pilih cabang...";
                      })()
                    : "Pilih cabang..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                {targetBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {`${b.name} (${b.code})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingShipmentId && (
              <p className="text-xs text-amber-600">Cabang tujuan tidak dapat diubah pada mode edit.</p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Daftar Barang Dikirim</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDispatchItemRow}>
                <Plus /> Tambah
              </Button>
            </div>

            {dispatchItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Klik &quot;Tambah&quot; untuk memilih produk yang akan dikirim.
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {dispatchItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-lg border border-border p-3"
                  >
                    <Select
                      value={item.masterProductId}
                      onValueChange={(val) => updateItemRow(idx, 'masterProductId', val || '')}
                    >
                      <SelectTrigger className="w-full">
                        <span className="flex flex-1 text-left line-clamp-1">
                          {item.masterProductId
                            ? (() => {
                                const p = products.find((x) => x.id === item.masterProductId);
                                return p ? `${p.name} (${p.variant})` : "Pilih produk...";
                              })()
                            : "Pilih produk..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {`${p.name} (${p.variant})`}
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
                        className="font-mono text-center flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeItemRow(idx)}
                        className="shrink-0 px-3 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Memproses...' : editingShipmentId ? 'Simpan Perubahan' : 'Kirim Barang'}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};
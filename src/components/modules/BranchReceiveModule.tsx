'use client';

import React, { useState } from 'react';
import { Shipment, User } from '@/types';
import { formatDate } from '@/constants';
import { AlertTriangle, CheckCircle2, Clock, Eye, PackageCheck, RefreshCw } from 'lucide-react';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface BranchReceiveModuleProps {
  shipments: Shipment[];
  currentUser: User;
  onRefresh: () => void;
  sseConnected: boolean;
}

export const BranchReceiveModule: React.FC<BranchReceiveModuleProps> = ({
  shipments,
  currentUser,
  onRefresh,
}) => {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [viewOnlyShipment, setViewOnlyShipment] = useState<Shipment | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<{ itemId: string; qtyReceived: number; qtyDamaged: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openValidationModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setConfirmedItems(
      shipment.items.map((i) => ({
        itemId: i.id,
        qtyReceived: i.qtySent,
        qtyDamaged: 0,
      }))
    );
    setErrorMsg('');
  };

  const updateQuantity = (itemId: string, field: 'qtyReceived' | 'qtyDamaged', value: number) => {
    setConfirmedItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          return {
            ...item,
            [field]: Math.max(0, value),
          };
        }
        return item;
      })
    );
  };

  const handleConfirmReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: selectedShipment.id,
          itemsConfirmed: confirmedItems,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSelectedShipment(null);
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengonfirmasi penerimaan barang');
    } finally {
      setLoading(false);
    }
  };

  const pendingShipments = shipments.filter((s) => s.status === 'DIKIRIM');
  const completedShipments = shipments.filter((s) => s.status === 'DITERIMA');

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={`Penerimaan Stok (${currentUser.branch?.name || 'Cabang Madiun'})`}
        description="Validasi fisik barang kiriman HQ. Konfirmasi jumlah barang fisik & catat barang rusak/hilang agar stok tercatat dengan akurat."
        icon={PackageCheck}
        actions={
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw />
            Refresh Data
          </Button>
        }
      />

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Clock className="size-4 text-amber-600" />
          Pengiriman Masuk Menunggu Validasi ({pendingShipments.length})
        </h3>

        {pendingShipments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </span>
              <p className="text-sm font-medium">Tidak Ada Pengiriman Menunggu</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Semua pengiriman dari HQ ke Cabang telah divalidasi. Notifikasi real-time (&lt;5 detik) akan muncul begitu HQ membuat kiriman baru.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingShipments.map((s) => (
              <Card key={s.id} className="ring-1 ring-amber-300/60">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge className="border-transparent bg-amber-100 text-amber-700">DIKIRIM DARI HQ</Badge>
                      <h4 className="mt-2 font-mono text-lg font-semibold">{s.shipmentNumber}</h4>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" /> {formatDate(s.sentAt)}
                      </p>
                    </div>
                    <span className="mt-1 size-2 rounded-full bg-amber-500" />
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
                    <div className="mb-1.5 flex items-center justify-between border-b border-border/70 pb-1.5">
                      <span className="font-medium">Rincian Barang</span>
                      <span className="text-muted-foreground">{s.items.length} jenis</span>
                    </div>
                    {s.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="truncate pr-2">{item.masterProduct.name}</span>
                        <span className="font-medium tabular-nums whitespace-nowrap">{item.qtySent} unit</span>
                      </div>
                    ))}
                  </div>

                  <Button onClick={() => openValidationModal(s)} className="w-full">
                    <PackageCheck />
                    Validasi Fisik &amp; Terima
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t border-border/70">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Riwayat Pengiriman Selesai ({completedShipments.length})
        </h3>

        {/* Desktop Table View */}
        <Card className="hidden md:block overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Pengiriman</TableHead>
                <TableHead>Waktu Diterima</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rincian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedShipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                    Belum ada pengiriman yang dikonfirmasi.
                  </TableCell>
                </TableRow>
              ) : (
                completedShipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-semibold">{s.shipmentNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{s.receivedAt ? formatDate(s.receivedAt) : '-'}</TableCell>
                    <TableCell>
                      <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                        <CheckCircle2 /> Selesai Divalidasi
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setViewOnlyShipment(s)}>
                        <Eye /> Lihat Rincian
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {completedShipments.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="Belum ada pengiriman yang dikonfirmasi"
              description="Pengiriman yang sudah divalidasi akan tampil di sini."
            />
          ) : (
            completedShipments.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-semibold">{s.shipmentNumber}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {s.receivedAt ? formatDate(s.receivedAt) : '-'}
                      </div>
                    </div>
                    <Badge className="border-transparent bg-emerald-100 text-emerald-700">DITERIMA</Badge>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setViewOnlyShipment(s)}>
                    <Eye /> Lihat Rincian Barang
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Validation Modal */}
      <ResponsiveModal
        open={!!selectedShipment}
        onOpenChange={(open) => !open && setSelectedShipment(null)}
        title="Konfirmasi Penerimaan Fisik"
      >
        {selectedShipment && (
          <form onSubmit={handleConfirmReception} className="space-y-5">
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-muted/30 px-4 py-4 text-center">
              <span className="font-mono font-semibold">{selectedShipment.shipmentNumber}</span>
              <span className="text-xs text-muted-foreground mt-0.5">Dikirim: {formatDate(selectedShipment.sentAt)}</span>
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Cek Kondisi Fisik Barang</p>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {selectedShipment.items.map((item) => {
                  const conf = confirmedItems.find((c) => c.itemId === item.id) || {
                    qtyReceived: item.qtySent,
                    qtyDamaged: 0,
                  };

                  const qtyLayakJual = Math.max(0, conf.qtyReceived - conf.qtyDamaged);

                  return (
                    <div key={item.id} className="space-y-3 rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{item.masterProduct.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Varian: {item.masterProduct.variant}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground mb-0.5">Target HQ</div>
                          <span className="font-semibold tabular-nums">{item.qtySent} unit</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Total Fisik Diterima</Label>
                          <Input
                            type="number"
                            min={0}
                            value={conf.qtyReceived}
                            onChange={(e) => updateQuantity(item.id, 'qtyReceived', Number(e.target.value))}
                            className="font-mono text-center"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-rose-600">Jumlah Rusak/Hilang</Label>
                          <Input
                            type="number"
                            min={0}
                            value={conf.qtyDamaged}
                            onChange={(e) => updateQuantity(item.id, 'qtyDamaged', Number(e.target.value))}
                            className="font-mono text-center text-rose-600"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Hasil Stok Siap Jual</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">{qtyLayakJual} unit</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>
                Barang rusak/hilang yang dicatat tidak akan masuk stok siap jual, namun tercatat dalam sistem untuk audit HQ.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedShipment(null)} className="flex-1">
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Memproses...' : 'Konfirmasi Penerimaan'}
              </Button>
            </div>
          </form>
        )}
      </ResponsiveModal>

      {/* View Details Modal for Completed Shipments */}
      <ResponsiveModal
        open={!!viewOnlyShipment}
        onOpenChange={(open) => !open && setViewOnlyShipment(null)}
        title="Rincian Pengiriman Selesai"
      >
        {viewOnlyShipment && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-4 text-center">
              <span className="text-xs text-emerald-600">No. Pengiriman</span>
              <span className="font-mono text-lg font-semibold text-emerald-900 mt-0.5">{viewOnlyShipment.shipmentNumber}</span>
              <span className="text-sm text-emerald-700 mt-0.5">Diterima: {viewOnlyShipment.receivedAt ? formatDate(viewOnlyShipment.receivedAt) : '-'}</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Rincian Barang ({viewOnlyShipment.items.length})</p>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {viewOnlyShipment.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{item.masterProduct.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Varian: {item.masterProduct.variant}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-xs text-muted-foreground mb-0.5">Dikirim HQ</div>
                        <span className="font-semibold tabular-nums">{item.qtySent} unit</span>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between border-t border-border/70 pt-3 text-sm">
                      <div className="space-y-0.5">
                        <span className="block text-xs text-muted-foreground">Diterima Baik</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">{item.qtyReceived - item.qtyDamaged} unit</span>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <span className="block text-xs text-muted-foreground">Rusak/Hilang</span>
                        <span className={`font-semibold tabular-nums ${item.qtyDamaged > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                          {item.qtyDamaged} unit
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => setViewOnlyShipment(null)} className="w-full">
              Tutup Rincian
            </Button>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
};
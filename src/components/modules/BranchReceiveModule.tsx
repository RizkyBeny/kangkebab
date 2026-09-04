'use client';

import React, { useState } from 'react';
import { Shipment, User } from '@/types';
import { formatDate } from '@/constants';
import { PackageCheck, CheckCircle, AlertTriangle, Clock, RefreshCw, Info, CheckCircle2, Eye } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-start gap-2 leading-tight">
            <PackageCheck className="w-6 h-6 text-foreground/80 flex-shrink-0 mt-0.5 md:mt-1" />
            <span>Penerimaan Stok ({currentUser.branch?.name || 'Cabang Madiun'})</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed max-w-lg">
            Validasi fisik barang kiriman HQ. Konfirmasi jumlah barang fisik &amp; catat barang rusak/hilang agar stok tercatat dengan akurat.
          </p>
        </div>
        <Button onClick={onRefresh} variant="outline" className="h-11 md:h-10 text-xs md:text-sm font-bold shadow-sm bg-card w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Pengiriman Masuk Menunggu Validasi ({pendingShipments.length})
        </h3>

        {pendingShipments.length === 0 ? (
          <Card className="p-8 text-center space-y-2 border-border shadow-sm border-dashed rounded-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto text-xl font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Tidak Ada Pengiriman Menunggu</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Semua pengiriman dari HQ ke Cabang telah divalidasi. Notifikasi real-time (&lt;5 detik) akan muncul begitu HQ membuat kiriman baru.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingShipments.map((s) => (
              <Card key={s.id} className="border-amber-300 shadow-sm hover:border-amber-400 transition-all rounded-xl">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] tracking-wider font-bold">
                        DIKIRIM DARI HQ
                      </Badge>
                      <h4 className="text-lg font-mono font-bold text-foreground mt-2">{s.shipmentNumber}</h4>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {formatDate(s.sentAt)}
                      </p>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping mt-1" />
                  </div>

                  <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-1 text-xs">
                    <div className="font-bold text-foreground/90 mb-2 flex justify-between">
                      <span>Rincian Barang</span>
                      <span className="text-muted-foreground font-medium">{s.items.length} jenis</span>
                    </div>
                    {s.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-foreground/80 font-medium">
                        <span className="truncate pr-2">• {item.masterProduct.name}</span>
                        <span className="font-bold text-foreground whitespace-nowrap">{item.qtySent} unit</span>
                      </div>
                    ))}
                  </div>

                  <Button onClick={() => openValidationModal(s)} className="w-full text-xs font-bold h-11 md:h-10 shadow-sm bg-slate-900 text-white hover:bg-slate-800">
                    <PackageCheck className="w-4 h-4 mr-2" />
                    Validasi Fisik &amp; Terima
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t border-border">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          Riwayat Pengiriman Selesai ({completedShipments.length})
        </h3>

        {/* Desktop Table View */}
        <Card className="shadow-sm border-border hidden md:block rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">No. Pengiriman</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Waktu Diterima</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Rincian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedShipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-sm">
                    Belum ada pengiriman yang dikonfirmasi.
                  </TableCell>
                </TableRow>
              ) : (
                completedShipments.map((s) => (
                  <TableRow key={s.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono font-bold text-foreground text-sm py-4">{s.shipmentNumber}</TableCell>
                    <TableCell className="text-foreground/80 text-sm font-medium">{s.receivedAt ? formatDate(s.receivedAt) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-2">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Selesai Divalidasi
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setViewOnlyShipment(s)} className="h-8 text-xs font-semibold">
                        <Eye className="w-3.5 h-3.5 mr-2" /> Lihat Rincian
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
            <Card className="p-8 text-center text-muted-foreground text-sm border-border rounded-xl">
              Belum ada pengiriman yang dikonfirmasi.
            </Card>
          ) : (
            completedShipments.map((s) => (
              <Card key={s.id} className="border-border shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-mono font-bold text-foreground text-base">{s.shipmentNumber}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {s.receivedAt ? formatDate(s.receivedAt) : '-'}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      DITERIMA
                    </Badge>
                  </div>

                  <Button variant="outline" className="w-full h-10 text-xs font-bold" onClick={() => setViewOnlyShipment(s)}>
                    <Eye className="w-4 h-4 mr-2" /> Lihat Rincian Barang
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
        icon={<PackageCheck className="w-5 h-5 text-emerald-600" />}
      >
        {selectedShipment && (
          <form onSubmit={handleConfirmReception} className="space-y-4">
            <div className="flex flex-col items-center justify-center p-3 bg-muted/50 rounded-xl border border-border/50 mb-2">
              <span className="font-mono font-bold text-base text-foreground">{selectedShipment.shipmentNumber}</span>
              <span className="text-xs text-muted-foreground mt-0.5">Dikirim: {formatDate(selectedShipment.sentAt)}</span>
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="text-xs font-bold text-foreground">Cek Kondisi Fisik Barang:</div>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {selectedShipment.items.map((item) => {
                  const conf = confirmedItems.find((c) => c.itemId === item.id) || {
                    qtyReceived: item.qtySent,
                    qtyDamaged: 0,
                  };

                  const qtyLayakJual = Math.max(0, conf.qtyReceived - conf.qtyDamaged);

                  return (
                    <div key={item.id} className="p-4 bg-muted/50 rounded-xl border border-border space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-foreground text-sm">{item.masterProduct.name}</div>
                          <div className="text-[11px] text-muted-foreground">Varian: {item.masterProduct.variant}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-muted-foreground font-medium">Target HQ:</span>
                          <div className="font-bold text-foreground text-sm">{item.qtySent} unit</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-foreground/80">Total Fisik Diterima</Label>
                          <Input
                            type="number"
                            min={0}
                            value={conf.qtyReceived}
                            onChange={(e) => updateQuantity(item.id, 'qtyReceived', Number(e.target.value))}
                            className="h-11 md:h-10 text-sm md:text-xs font-mono text-center bg-card"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-rose-600">Jumlah Rusak/Hilang</Label>
                          <Input
                            type="number"
                            min={0}
                            value={conf.qtyDamaged}
                            onChange={(e) => updateQuantity(item.id, 'qtyDamaged', Number(e.target.value))}
                            className="h-11 md:h-10 text-sm md:text-xs text-rose-600 font-mono text-center bg-card focus-visible:ring-rose-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-muted-foreground font-medium">Hasil Stok Siap Jual:</span>
                        <span className="font-bold text-emerald-700 text-xs">{qtyLayakJual} unit</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <span className="leading-relaxed">
                Barang rusak/hilang yang dicatat tidak akan masuk stok siap jual, namun tercatat dalam sistem untuk audit HQ.
              </span>
            </div>

            <div className="pt-2 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setSelectedShipment(null)} className="flex-1 h-11 md:h-10 text-xs font-bold">
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 h-11 md:h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
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
        icon={<Info className="w-5 h-5 text-foreground/80" />}
      >
        {viewOnlyShipment && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">No. Pengiriman</span>
              <span className="font-mono font-bold text-lg text-emerald-900 mt-1">{viewOnlyShipment.shipmentNumber}</span>
              <span className="text-sm font-semibold text-emerald-700 mt-1">Diterima: {viewOnlyShipment.receivedAt ? formatDate(viewOnlyShipment.receivedAt) : '-'}</span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Rincian Barang ({viewOnlyShipment.items.length})</div>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {viewOnlyShipment.items.map((item) => (
                  <div key={item.id} className="p-4 bg-card border border-border rounded-xl shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-sm text-foreground">{item.masterProduct.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Varian: {item.masterProduct.variant}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium block">Dikirim HQ</span>
                        <span className="font-bold text-foreground text-sm">{item.qtySent} unit</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-border/50 text-xs bg-muted/30 -mx-4 px-4 pb-1">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block">Diterima Baik</span>
                        <span className="font-bold text-emerald-600 text-sm">{item.qtyReceived - item.qtyDamaged} unit</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-muted-foreground block">Rusak/Hilang</span>
                        <span className={`font-bold text-sm ${item.qtyDamaged > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{item.qtyDamaged} unit</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={() => setViewOnlyShipment(null)} className="w-full h-11 md:h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
                Tutup Rincian
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
};

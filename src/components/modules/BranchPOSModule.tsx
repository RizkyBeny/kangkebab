'use client';

import React, { useState } from 'react';
import { BranchInventory, SalesTransaction, SalesChannel, OnlinePlatform, User } from '@/types';
import { formatRupiah } from '@/constants';
import { ShoppingBag, ShoppingCart, Plus, Minus, Trash2, Store, Smartphone, AlertCircle, X, Settings2 } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface BranchPOSModuleProps {
  inventories: BranchInventory[];
  currentUser: User;
  onRefresh: () => void;
}

export const BranchPOSModule: React.FC<BranchPOSModuleProps> = ({
  inventories,
  currentUser,
  onRefresh,
}) => {
  const [isChannelSelected, setIsChannelSelected] = useState(false);
  const [channel, setChannel] = useState<SalesChannel>('OFFLINE');
  const [platform, setPlatform] = useState<OnlinePlatform>('SHOPEE');
  
  const [cart, setCart] = useState<{ masterProductId: string; qty: number }[]>([]);
  const [completedTx, setCompletedTx] = useState<SalesTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const availableInventories = inventories.filter((inv) => inv.qtyAvailable > 0);

  const handleConfirmChannel = () => {
    setIsChannelSelected(true);
    setCart([]); // Reset cart when channel changes
  };

  const addToCart = (masterProductId: string) => {
    const existing = cart.find((c) => c.masterProductId === masterProductId);
    const inv = inventories.find((i) => i.masterProductId === masterProductId);
    const maxQty = inv?.qtyAvailable || 0;

    if (existing) {
      if (existing.qty >= maxQty) return;
      setCart(cart.map((c) => (c.masterProductId === masterProductId ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      if (maxQty < 1) return;
      setCart([...cart, { masterProductId, qty: 1 }]);
    }
  };

  const updateCartQty = (masterProductId: string, delta: number) => {
    const inv = inventories.find((i) => i.masterProductId === masterProductId);
    const maxQty = inv?.qtyAvailable || 0;

    setCart(
      cart
        .map((c) => {
          if (c.masterProductId === masterProductId) {
            const nextQty = c.qty + delta;
            if (nextQty > maxQty) return c;
            return { ...c, qty: nextQty };
          }
          return c;
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (masterProductId: string) => {
    setCart(cart.filter((c) => c.masterProductId !== masterProductId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const inv = inventories.find((i) => i.masterProductId === item.masterProductId);
      if (!inv) return sum;
      const price = channel === 'ONLINE' ? inv.masterProduct.onlineSellingPrice : inv.masterProduct.offlineSellingPrice;
      return sum + price * item.qty;
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentUser.branchId) {
      setErrorMsg('User tidak terhubung ke cabang manapun');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: currentUser.branchId,
          channel,
          platform: channel === 'ONLINE' ? platform : 'NONE',
          items: cart,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setCart([]);
      setMobileCartOpen(false);
      setCompletedTx(data.data);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses transaksi POS');
    } finally {
      setLoading(false);
    }
  };

  const cartItemsCount = cart.reduce((a, b) => a + b.qty, 0);

  const cartContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-slate-700" />
          Keranjang POS ({cartItemsCount})
        </h3>
        {cart.length > 0 && (
          <Button variant="link" size="sm" onClick={() => setCart([])} className="h-auto p-0 text-[11px] text-rose-600 font-bold">
            Kosongkan
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="py-2 px-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs font-medium ml-2">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {cart.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 space-y-1">
          <p className="font-bold text-slate-600">Keranjang masih kosong.</p>
          <p className="text-[11px]">Pilih produk dari katalog untuk memulai transaksi.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-slate-100">
          {cart.map((item) => {
            const inv = inventories.find((i) => i.masterProductId === item.masterProductId);
            if (!inv) return null;
            const prod = inv.masterProduct;
            const price = channel === 'ONLINE' ? prod.onlineSellingPrice : prod.offlineSellingPrice;

            return (
              <div key={item.masterProductId} className="pt-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-900">{prod.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {formatRupiah(price)} x {item.qty}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, -1)} className="h-6 w-6">
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs font-mono font-bold text-slate-900 w-5 text-center">
                    {item.qty}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, 1)} disabled={item.qty >= inv.qtyAvailable} className="h-6 w-6">
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.masterProductId)} className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Summary & Checkout */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">Channel Transaksi:</span>
          <span className="font-bold text-slate-900">
            {channel} {channel === 'ONLINE' ? `(${platform})` : ''}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm font-bold text-slate-900">
          <span>TOTAL BAYAR</span>
          <span className="text-base text-emerald-700 font-mono">{formatRupiah(calculateSubtotal())}</span>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={loading || cart.length === 0}
          className="w-full text-xs font-bold h-10 shadow-sm"
        >
          {loading ? 'Memproses POS...' : 'Selesaikan Transaksi & Terbitkan Struk'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Forced Channel Selection Modal */}
      <Dialog open={!isChannelSelected}>
        <DialogContent className="max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-slate-900">Mulai Transaksi Kasir</DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-xs">
              Pilih channel penjualan terlebih dahulu untuk menentukan harga produk yang berlaku.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={channel === 'OFFLINE' ? 'default' : 'outline'}
                onClick={() => setChannel('OFFLINE')}
                className={`h-24 flex flex-col items-center justify-center gap-2 ${channel === 'OFFLINE' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
              >
                <Store className="w-6 h-6" />
                <span className="font-bold">Offline (Toko)</span>
              </Button>
              <Button
                variant={channel === 'ONLINE' ? 'default' : 'outline'}
                onClick={() => setChannel('ONLINE')}
                className={`h-24 flex flex-col items-center justify-center gap-2 ${channel === 'ONLINE' ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
              >
                <Smartphone className="w-6 h-6" />
                <span className="font-bold">Online</span>
              </Button>
            </div>

            {channel === 'ONLINE' && (
              <div className="p-4 bg-indigo-50 rounded-xl space-y-3 animate-fadeIn">
                <Label className="text-xs font-bold text-indigo-900">Pilih Platform Online:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={platform === 'SHOPEE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('SHOPEE')}
                    className={`h-9 text-xs ${platform === 'SHOPEE' ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    Shopee
                  </Button>
                  <Button
                    variant={platform === 'TIKTOK' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('TIKTOK')}
                    className={`h-9 text-xs ${platform === 'TIKTOK' ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    TikTok Shop
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleConfirmChannel} className="w-full text-xs font-bold h-10">
              Lanjutkan ke Katalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-slate-700" />
            POS Kasir Multichannel ({currentUser.branch?.name || 'Cabang Madiun'})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Sesi penjualan aktif untuk: <strong className="text-slate-900">{channel} {channel === 'ONLINE' ? `(${platform})` : ''}</strong>
          </p>
        </div>

        {isChannelSelected && (
          <Button variant="outline" size="sm" onClick={() => setIsChannelSelected(false)} className="h-9 text-xs font-semibold bg-white shadow-sm">
            <Settings2 className="w-4 h-4 mr-2 text-slate-500" />
            Ubah Channel
          </Button>
        )}
      </div>

      {isChannelSelected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Katalog Live Product Cabang Madiun</h3>

            {availableInventories.length === 0 ? (
              <Card className="p-8 text-center text-xs text-slate-400">
                Belum ada stok barang yang tersedia untuk dijual. Lakukan validasi pengiriman dari HQ terlebih dahulu.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableInventories.map((inv) => {
                  const prod = inv.masterProduct;
                  const activePrice = channel === 'ONLINE' ? prod.onlineSellingPrice : prod.offlineSellingPrice;
                  const inCart = cart.find((c) => c.masterProductId === prod.id);

                  return (
                    <Card key={inv.id} className="shadow-sm border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between">
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-mono text-slate-900 font-bold">{prod.sku}</span>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                              Stok: {inv.qtyAvailable}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{prod.name}</h4>
                          <p className="text-xs text-slate-500">Varian: {prod.variant}</p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">Harga {channel}:</span>
                            <span className="text-sm font-bold text-slate-900">{formatRupiah(activePrice)}</span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => addToCart(prod.id)}
                            disabled={inv.qtyAvailable <= (inCart?.qty || 0)}
                            className="h-8 text-xs px-3 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {inCart ? `+ (${inCart.qty})` : 'Tambah'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden lg:block h-fit sticky top-20">
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-5">
                {cartContent}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {isChannelSelected && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <Button
            onClick={() => setMobileCartOpen(true)}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-between font-bold text-xs px-5"
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4" />
              <span>Keranjang POS ({cartItemsCount} item)</span>
            </div>
            <span className="font-mono text-sm text-emerald-400">{formatRupiah(calculateSubtotal())}</span>
          </Button>
        </div>
      )}

      {mobileCartOpen && isChannelSelected && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-4">
              <span className="font-bold text-sm text-slate-900">Ringkasan Keranjang POS</span>
              <button onClick={() => setMobileCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {cartContent}
          </div>
        </div>
      )}

      {completedTx && <ReceiptModal transaction={completedTx} onClose={() => setCompletedTx(null)} />}
    </div>
  );
};

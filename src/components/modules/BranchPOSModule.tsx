'use client';

import React, { useState, useRef } from 'react';
import { BranchInventory, SalesTransaction, SalesChannel, OnlinePlatform, User, MasterProduct } from '@/types';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Check } from 'lucide-react';

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
  
  const [cart, setCart] = useState<{ masterProductId: string; qty: number; customPrice?: number }[]>([]);
  const [completedTx, setCompletedTx] = useState<SalesTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const submittingRef = useRef(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [ecommerceActualPrice, setEcommerceActualPrice] = useState<number | ''>('');
  
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  const availableInventories = inventories.filter((inv) => inv.qtyAvailable > 0);

  const handleConfirmChannel = () => {
    setIsChannelSelected(true);
    setCart([]); // Reset cart when channel changes
    setCustomerName('');
    setCustomerPhone('');
    setEcommerceActualPrice('');
    setPaymentMethod(channel === 'ONLINE' ? 'ECOMMERCE' : 'CASH');
  };

  const saveCustomPrice = (masterProductId: string) => {
    const val = Number(editingPriceValue);
    setCart(cart.map(c => c.masterProductId === masterProductId ? { ...c, customPrice: isNaN(val) ? undefined : val } : c));
    setEditingPriceId(null);
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

  const resolveBasePrice = (prod: MasterProduct) => {
    if (channel === 'ONLINE') {
      return platform === 'SHOPEE' ? prod.shopeeSellingPrice : prod.tiktokSellingPrice;
    }
    return prod.offlineSellingPrice;
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const inv = inventories.find((i) => i.masterProductId === item.masterProductId);
      if (!inv) return sum;
      const price = item.customPrice ?? resolveBasePrice(inv.masterProduct);
      return sum + price * item.qty;
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (submittingRef.current) return;
    if (!currentUser.branchId) {
      setErrorMsg('User tidak terhubung ke cabang manapun');
      return;
    }

    if (!customerName || !customerPhone) {
      setErrorMsg('Nama dan No. Handphone customer wajib diisi');
      return;
    }

    if (channel === 'ONLINE' && (ecommerceActualPrice === '' || Number(ecommerceActualPrice) <= 0)) {
      setErrorMsg('Harga Actual Ecommerce wajib diisi untuk transaksi Online');
      return;
    }

    submittingRef.current = true;
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
          customerName,
          customerPhone,
          paymentStatus,
          paymentMethod: channel === 'ONLINE' ? 'ECOMMERCE' : paymentMethod,
          ecommerceActualPrice: ecommerceActualPrice === '' ? null : Number(ecommerceActualPrice)
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setCart([]);
      setMobileCartOpen(false);
      setCompletedTx(data.data);
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses transaksi POS');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const cartItemsCount = cart.reduce((a, b) => a + b.qty, 0);

  const cartContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
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
        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
          <p className="font-bold text-foreground/80">Keranjang masih kosong.</p>
          <p className="text-[11px]">Pilih produk dari katalog untuk memulai transaksi.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-border">
          {cart.map((item) => {
            const inv = inventories.find((i) => i.masterProductId === item.masterProductId);
            if (!inv) return null;
            const prod = inv.masterProduct;
            const price = item.customPrice ?? resolveBasePrice(prod);

            return (
              <div key={item.masterProductId} className="pt-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-foreground">{prod.name}</div>
                  <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
                    {editingPriceId === item.masterProductId ? (
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          value={editingPriceValue} 
                          onChange={(e) => setEditingPriceValue(e.target.value)} 
                          className="h-6 w-20 text-[10px] px-1" 
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" onClick={() => saveCustomPrice(item.masterProductId)} className="h-5 w-5 bg-primary/10 text-primary hover:bg-primary/20 rounded">
                           <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 cursor-pointer group" onClick={() => { setEditingPriceId(item.masterProductId); setEditingPriceValue(String(price)); }}>
                        <span>{formatRupiah(price)} x {item.qty}</span>
                        <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, -1)} className="h-6 w-6">
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs font-mono font-bold text-foreground w-5 text-center">
                    {item.qty}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, 1)} disabled={item.qty >= inv.qtyAvailable} className="h-6 w-6 border-border">
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.masterProductId)} className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Summary & Checkout */}
      <div className="pt-4 border-t border-border space-y-3">
        <div className="space-y-2 pb-2 border-b border-border">
           <Label className="text-[11px] font-bold">Nama Customer <span className="text-destructive">*</span></Label>
           <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama" className="h-8 text-xs" />
           <Label className="text-[11px] font-bold">No. Handphone <span className="text-destructive">*</span></Label>
           <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0812..." className="h-8 text-xs" />
        </div>

        {channel === 'ONLINE' && (
          <div className="space-y-2 pb-2 border-b border-border">
            <Label className="text-[11px] font-bold">Harga Actual Ecommerce <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={0}
              value={ecommerceActualPrice}
              onChange={e => setEcommerceActualPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Total dari platform"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground font-medium">
              Nilai ini menjadi total omzet utama transaksi online (menggantikan total item).
            </p>
          </div>
        )}

        {channel === 'OFFLINE' && (
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Metode</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Status</Label>
              <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val || 'PAID')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">LUNAS</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium">Channel Transaksi:</span>
          <span className="font-bold text-foreground">
            {channel} {channel === 'ONLINE' ? `(${platform})` : ''}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm font-bold text-foreground">
          <div>
            <span>TOTAL BAYAR</span>
            {channel === 'ONLINE' && ecommerceActualPrice !== '' && (
              <div className="text-[10px] text-muted-foreground font-medium">Harga aktual ecommerce (total utama)</div>
            )}
          </div>
          <span className="text-base text-primary font-mono">
            {channel === 'ONLINE' && ecommerceActualPrice !== ''
              ? formatRupiah(Number(ecommerceActualPrice))
              : formatRupiah(calculateSubtotal())}
          </span>
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
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-foreground">Mulai Transaksi Kasir</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-xs">
              Pilih channel penjualan terlebih dahulu untuk menentukan harga produk yang berlaku.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={channel === 'OFFLINE' ? 'default' : 'outline'}
                onClick={() => setChannel('OFFLINE')}
                className={`h-24 flex flex-col items-center justify-center gap-2 ${channel === 'OFFLINE' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'hover:bg-muted border-border'}`}
              >
                <Store className="w-6 h-6" />
                <span className="font-bold">Offline (Toko)</span>
              </Button>
              <Button
                variant={channel === 'ONLINE' ? 'default' : 'outline'}
                onClick={() => setChannel('ONLINE')}
                className={`h-24 flex flex-col items-center justify-center gap-2 ${channel === 'ONLINE' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'hover:bg-muted border-border'}`}
              >
                <Smartphone className="w-6 h-6" />
                <span className="font-bold">Online</span>
              </Button>
            </div>

            {channel === 'ONLINE' && (
              <div className="p-4 bg-primary/5 rounded-xl space-y-3 animate-fadeIn border border-primary/10">
                <Label className="text-xs font-bold text-primary">Pilih Platform Online:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={platform === 'SHOPEE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('SHOPEE')}
                    className={`h-9 text-xs transition-colors ${platform === 'SHOPEE' ? 'bg-[#ee4d2d] hover:bg-[#d74226] text-white border-[#ee4d2d]' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    Shopee
                  </Button>
                  <Button
                    variant={platform === 'TIKTOK' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('TIKTOK')}
                    className={`h-9 text-xs transition-colors ${platform === 'TIKTOK' ? 'bg-black hover:bg-gray-800 text-white border-black' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
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
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            POS Kasir Multichannel ({currentUser.branch?.name || 'Cabang Madiun'})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            Sesi penjualan aktif untuk: <strong className="text-foreground">{channel} {channel === 'ONLINE' ? `(${platform})` : ''}</strong>
          </p>
        </div>

        {isChannelSelected && (
          <Button variant="outline" size="sm" onClick={() => setIsChannelSelected(false)} className="h-9 text-xs font-semibold bg-card border-border shadow-sm hover:bg-muted">
            <Settings2 className="w-4 h-4 mr-2 text-muted-foreground" />
            Ubah Channel
          </Button>
        )}
      </div>

      {isChannelSelected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Katalog Live Product Cabang Madiun</h3>

            {availableInventories.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground border-border bg-card">
                Belum ada stok barang yang tersedia untuk dijual. Lakukan validasi pengiriman dari HQ terlebih dahulu.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableInventories.map((inv) => {
                  const prod = inv.masterProduct;
                  const activePrice = resolveBasePrice(prod);
                  const inCart = cart.find((c) => c.masterProductId === prod.id);

                  return (
                    <Card key={inv.id} className="shadow-sm border-border hover:border-primary/40 transition-all flex flex-col justify-between bg-card group">
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-mono text-foreground font-bold">{prod.sku}</span>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                              Stok: {inv.qtyAvailable}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{prod.name}</h4>
                          <p className="text-xs text-muted-foreground">Varian: {prod.variant}</p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-medium block">Harga {channel}:</span>
                            <span className="text-sm font-bold text-foreground">{formatRupiah(activePrice)}</span>
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
            <Card className="shadow-lg shadow-primary/5 border-border bg-card">
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
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-between font-bold text-xs px-5 hover:bg-primary/90 transition-all"
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4" />
              <span>Keranjang POS ({cartItemsCount} item)</span>
            </div>
            <span className="font-mono text-sm">{formatRupiah(channel === 'ONLINE' && ecommerceActualPrice !== '' ? Number(ecommerceActualPrice) : calculateSubtotal())}</span>
          </Button>
        </div>
      )}

      {mobileCartOpen && isChannelSelected && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)} />
          <div className="relative w-full bg-card rounded-t-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto border-t border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <span className="font-bold text-sm text-foreground">Ringkasan Keranjang POS</span>
              <button onClick={() => setMobileCartOpen(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
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

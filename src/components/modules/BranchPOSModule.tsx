'use client';

import React, { useState, useRef, useMemo } from 'react';
import { BranchInventory, MasterProduct, SalesTransaction, SalesChannel, OnlinePlatform, ForwardSource, User } from '@/types';
import { formatRupiah, FORWARD_SOURCE_LABELS } from '@/constants';
import { ShoppingBag, ShoppingCart, Plus, Minus, Trash2, Store, Smartphone, X, Settings2, ArrowLeftRight, Warehouse, PackageCheck } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pencil, Check } from 'lucide-react';

interface BranchPOSModuleProps {
  inventories: BranchInventory[];
  products: MasterProduct[];
  currentUser: User;
  onRefresh: () => void;
}

/** A sellable row in the POS catalog. `qtyAvailable` is 0 for products the branch has
 *  never received, which is fine when HQ supplies the goods. */
interface CatalogEntry {
  key: string;
  product: MasterProduct;
  qtyAvailable: number;
  resellerSellingPrice: number | null;
}

const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const BranchPOSModule: React.FC<BranchPOSModuleProps> = ({
  inventories,
  products,
  currentUser,
  onRefresh,
}) => {
  const [isChannelSelected, setIsChannelSelected] = useState(false);
  const [channel, setChannel] = useState<SalesChannel>('OFFLINE');
  const [platform, setPlatform] = useState<OnlinePlatform>('SHOPEE');
  // Resi Forward is a marker on an online sale, so it is chosen inside the Online branch and
  // is simply absent (null) for an ordinary marketplace sale.
  const [isForward, setIsForward] = useState(false);
  const [forwardSource, setForwardSource] = useState<ForwardSource | null>('HQ');
  
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
  const [isReseller, setIsReseller] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');
  
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  // HQ-supplied forward sales never touch branch stock, so for that direction the cart is
  // neither capped by nor limited to the local qtyAvailable.
  const stockIsConsumed = !isForward || forwardSource === 'CABANG';

  const catalog: CatalogEntry[] = useMemo(() => {
    if (stockIsConsumed) {
      return inventories
        .filter((inv) => inv.qtyAvailable > 0)
        .map((inv) => ({
          key: inv.id,
          product: inv.masterProduct,
          qtyAvailable: inv.qtyAvailable,
          resellerSellingPrice: inv.resellerSellingPrice ?? null,
        }));
    }
    // HQ supplies the goods: the whole master catalog is sellable, even for products the
    // branch holds none of.
    return products.map((product) => {
      const inv = inventories.find((i) => i.masterProductId === product.id);
      return {
        key: product.id,
        product,
        qtyAvailable: inv?.qtyAvailable ?? 0,
        resellerSellingPrice: inv?.resellerSellingPrice ?? null,
      };
    });
  }, [inventories, products, stockIsConsumed]);

  const availableInventories = catalog;

  const findCatalogEntry = (masterProductId: string) =>
    catalog.find((c) => c.product.id === masterProductId);

  const maxSelectable = (entry: CatalogEntry | undefined) =>
    stockIsConsumed ? entry?.qtyAvailable ?? 0 : UNLIMITED;

  const handleConfirmChannel = () => {
    setIsChannelSelected(true);
    setCart([]); // Reset cart when channel changes
    setCustomerName('');
    setCustomerPhone('');
    setEcommerceActualPrice('');
    setIsReseller(false);
    setDiscountPercent('');
    setPaymentMethod(channel === 'ONLINE' ? 'ECOMMERCE' : 'CASH');
  };

  // Switching to Offline leaves the forward marker behind: it only exists on an online sale.
  const handleChannelChange = (next: SalesChannel) => {
    setChannel(next);
    if (next !== 'ONLINE') {
      setIsForward(false);
      setForwardSource(null);
    }
  };

  const saveCustomPrice = (masterProductId: string) => {
    const val = Number(editingPriceValue);
    setCart(cart.map(c => c.masterProductId === masterProductId ? { ...c, customPrice: isNaN(val) ? undefined : val } : c));
    setEditingPriceId(null);
  };

  const addToCart = (masterProductId: string) => {
    const existing = cart.find((c) => c.masterProductId === masterProductId);
    const maxQty = maxSelectable(findCatalogEntry(masterProductId));

    if (existing) {
      if (existing.qty >= maxQty) return;
      setCart(cart.map((c) => (c.masterProductId === masterProductId ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      if (maxQty < 1) return;
      setCart([...cart, { masterProductId, qty: 1 }]);
    }
  };

  const updateCartQty = (masterProductId: string, delta: number) => {
    const maxQty = maxSelectable(findCatalogEntry(masterProductId));

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

  const resolveActivePrice = (entry: CatalogEntry) => {
    if (channel === 'ONLINE') {
      return platform === 'SHOPEE' ? entry.product.shopeeSellingPrice : entry.product.tiktokSellingPrice;
    }
    if (isReseller) {
      return entry.resellerSellingPrice ?? entry.product.offlineSellingPrice;
    }
    return entry.product.offlineSellingPrice;
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const entry = findCatalogEntry(item.masterProductId);
      if (!entry) return sum;
      const price = item.customPrice ?? resolveActivePrice(entry);
      return sum + price * item.qty;
    }, 0);
  };

  const calculateDiscount = () => {
    if (!isReseller || channel !== 'OFFLINE') return 0;
    const pct = Number(discountPercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return 0;
    const subtotal = calculateSubtotal();
    if (subtotal <= 0) return 0;
    return Math.min(Math.round((subtotal * pct) / 100), subtotal);
  };

  const calculatePayable = () => {
    if (channel === 'ONLINE' && ecommerceActualPrice !== '') return Number(ecommerceActualPrice);
    return Math.max(0, calculateSubtotal() - calculateDiscount());
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

    if (isReseller && channel !== 'OFFLINE') {
      setErrorMsg('Transaksi reseller hanya tersedia untuk penjualan Offline');
      return;
    }

    if (isForward && !forwardSource) {
      setErrorMsg('Wajib memilih sumber barang untuk transaksi Forward');
      return;
    }

    let parsedDiscount = 0;
    if (isReseller && discountPercent !== '') {
      parsedDiscount = Number(discountPercent);
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
        setErrorMsg('Diskon reseller harus antara 0% dan 100%');
        return;
      }
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
          forwardSource: isForward ? forwardSource : null,
          items: cart,
          userId: currentUser.id,
          userName: currentUser.name,
          customerName,
          customerPhone,
          paymentStatus,
          paymentMethod: channel === 'ONLINE' ? 'ECOMMERCE' : paymentMethod,
          ecommerceActualPrice: ecommerceActualPrice === '' ? null : Number(ecommerceActualPrice),
          isReseller,
          discountPercent: parsedDiscount,
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
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="size-4 text-muted-foreground" />
          Keranjang POS ({cartItemsCount})
        </h3>
        {cart.length > 0 && (
          <Button variant="link" size="sm" onClick={() => setCart([])} className="h-auto p-0 text-xs text-rose-600">
            Kosongkan
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="py-2.5 px-3">
          <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {cart.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">Keranjang masih kosong.</p>
          <p>Pilih produk dari katalog untuk memulai transaksi.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-border">
          {cart.map((item) => {
            const entry = findCatalogEntry(item.masterProductId);
            if (!entry) return null;
            const prod = entry.product;
            const price = item.customPrice ?? resolveActivePrice(entry);
            const qtyCeiling = maxSelectable(entry);

            return (
              <div key={item.masterProductId} className="pt-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">{prod.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
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
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, 1)} disabled={item.qty >= qtyCeiling} className="h-6 w-6 border-border">
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
           {channel === 'OFFLINE' && (
             <div className="flex items-center justify-between pb-1">
               <Label className="text-xs font-medium">Transaksi Reseller</Label>
               <Switch
                 checked={isReseller}
                 onCheckedChange={(checked) => {
                   setIsReseller(checked);
                   setDiscountPercent('');
                 }}
               />
             </div>
           )}
           {isReseller ? (
             <>
               <Label>Nama Reseller <span className="text-destructive">*</span></Label>
               <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama Reseller" />
               <Label>No. Handphone Reseller <span className="text-destructive">*</span></Label>
               <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0812..." />
               <div className="pt-1 space-y-1">
                 <Label>Diskon Penjualan (%)</Label>
                 <Input
                   type="number"
                   min={0}
                   max={100}
                   step="0.1"
                   value={discountPercent}
                   onChange={e => setDiscountPercent(e.target.value)}
                   placeholder="cth: 10"
                 />
                 <p className="text-xs text-muted-foreground">
                   Diskon dihitung dari subtotal transaksi (diterapkan otomatis).
                 </p>
               </div>
             </>
           ) : (
             <>
               <Label>Nama Customer <span className="text-destructive">*</span></Label>
               <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama" />
               <Label>No. Handphone <span className="text-destructive">*</span></Label>
               <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0812..." />
             </>
           )}
        </div>

        {channel === 'ONLINE' && (
          <div className="space-y-2 pb-2 border-b border-border">
            <Label>Harga Actual Ecommerce <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={0}
              value={ecommerceActualPrice}
              onChange={e => setEcommerceActualPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Total dari platform"
            />
            <p className="text-xs text-muted-foreground">
              Nilai ini menjadi total omzet utama transaksi online (menggantikan total item).
            </p>
          </div>
        )}

        {channel === 'OFFLINE' && (
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
            <div className="space-y-1">
              <Label>Metode</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val || 'PAID')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">LUNAS</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Channel Transaksi</span>
          <span className="font-semibold">
            {channel} {channel === 'ONLINE' ? `(${platform})` : ''}
            {isForward && forwardSource ? `(${FORWARD_SOURCE_LABELS[forwardSource]})` : ''}
          </span>
        </div>

        {isForward && (
          <Alert className="border-violet-200 bg-violet-50 text-violet-800 py-2.5 px-3">
            <ArrowLeftRight className="size-4" />
            <AlertDescription className="text-[11px] font-medium text-violet-800">
              {stockIsConsumed
                ? 'Barang diambil dari stok cabang — stok cabang akan berkurang sejumlah yang dijual.'
                : 'Barang disuplai HQ — stok cabang TIDAK akan berkurang, dan omzet serta modal transaksi ini dikurangi dari sisi cabang pada laporan perhitungan.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          {isReseller && channel === 'OFFLINE' && calculateDiscount() > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">{formatRupiah(calculateSubtotal())}</span>
            </div>
          )}
          {isReseller && channel === 'OFFLINE' && calculateDiscount() > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Diskon ({discountPercent}%)</span>
              <span className="font-semibold tabular-nums text-rose-600">-{formatRupiah(calculateDiscount())}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-semibold">
            <div>
              <span>TOTAL BAYAR</span>
              {channel === 'ONLINE' && ecommerceActualPrice !== '' && (
                <div className="text-[10px] text-muted-foreground font-normal">Harga aktual ecommerce (total utama)</div>
              )}
              {isReseller && channel === 'OFFLINE' && (
                <div className="text-[10px] text-muted-foreground font-normal">Transaksi reseller{calculateDiscount() > 0 ? ` - diskon ${discountPercent}%` : ''}</div>
              )}
            </div>
            <span className="text-base tabular-nums">
              {formatRupiah(calculatePayable())}
            </span>
          </div>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={loading || cart.length === 0}
          className="w-full"
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
        {/* `max-h` + `overflow-y` is required: the popup is vertically centred with a transform,
            so without a scroll cap a tall channel (Forward adds a sub-selector) gets clipped at
            both ends and the confirm button ends up off-screen on short viewports. */}
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-border">
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
                onClick={() => handleChannelChange('OFFLINE')}
                className="flex h-24 flex-col items-center justify-center gap-2"
              >
                <Store className="size-6" />
                <span className="font-semibold text-xs">Offline (Toko)</span>
              </Button>
              <Button
                variant={channel === 'ONLINE' ? 'default' : 'outline'}
                onClick={() => handleChannelChange('ONLINE')}
                className="flex h-24 flex-col items-center justify-center gap-2"
              >
                <Smartphone className="size-6" />
                <span className="font-semibold text-xs">Online</span>
              </Button>
            </div>

            {channel === 'ONLINE' && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <Label className="text-sm font-medium">Pilih Platform Online</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={platform === 'SHOPEE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('SHOPEE')}
                    className={platform === 'SHOPEE' ? 'bg-[#ee4d2d] text-white hover:bg-[#d74226]' : 'text-muted-foreground'}
                  >
                    Shopee
                  </Button>
                  <Button
                    variant={platform === 'TIKTOK' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatform('TIKTOK')}
                    className={platform === 'TIKTOK' ? 'bg-black text-white hover:bg-gray-800' : 'text-muted-foreground'}
                  >
                    TikTok Shop
                  </Button>
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <Button
                    variant={isForward ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setIsForward((prev) => !prev);
                      // Turning forward back on always restores a direction, so the confirm
                      // button can never be reached with the source left unset.
                      if (!isForward) setForwardSource((prev) => prev ?? 'HQ');
                    }}
                    className={`w-full ${
                      isForward ? 'bg-violet-600 text-white hover:bg-violet-700' : 'text-muted-foreground'
                    }`}
                  >
                    <ArrowLeftRight className="size-4" />
                    Resi Forward
                  </Button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Buyer di luar wilayah cabang, dikirim dari HQ lalu dicatat pada cabang ini.
                  </p>
                </div>

                {isForward && (
                  <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                    <Label className="text-sm font-medium">Dari mana barangnya?</Label>
                    <Button
                      variant={forwardSource === 'HQ' ? 'default' : 'outline'}
                      onClick={() => setForwardSource('HQ')}
                      className={`w-full h-auto items-start justify-start gap-3 whitespace-normal py-3 text-left ${
                        forwardSource === 'HQ' ? 'bg-violet-600 text-white hover:bg-violet-700' : ''
                      }`}
                    >
                      <Warehouse className="size-5 shrink-0" />
                      <span className="flex flex-col gap-0.5">
                        <span className="block text-sm font-semibold">Barang dari HQ</span>
                        <span className="block text-[11px] font-normal opacity-80">
                          Buyer di luar wilayah cabang, dikirim dari HQ. Stok cabang tidak
                          berkurang, dan omzet serta modal dikurangi dari sisi cabang.
                        </span>
                      </span>
                    </Button>
                    <Button
                      variant={forwardSource === 'CABANG' ? 'default' : 'outline'}
                      onClick={() => setForwardSource('CABANG')}
                      className={`w-full h-auto items-start justify-start gap-3 whitespace-normal py-3 text-left ${
                        forwardSource === 'CABANG' ? 'bg-violet-600 text-white hover:bg-violet-700' : ''
                      }`}
                    >
                      <PackageCheck className="size-5 shrink-0" />
                      <span className="flex flex-col gap-0.5">
                        <span className="block text-sm font-semibold">Barang dari Stok Cabang</span>
                        <span className="block text-[11px] font-normal opacity-80">
                          HQ meneruskan order ke cabang. Stok cabang berkurang dan omzet masuk
                          penuh ke cabang.
                        </span>
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleConfirmChannel} className="w-full">
              Lanjutkan ke Katalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title={`POS Kasir Multichannel (${currentUser.branch?.name || 'Cabang Madiun'})`}
        description={
          <>
            Sesi penjualan aktif untuk:{' '}
            <strong className="text-foreground">
              {channel} {channel === 'ONLINE' ? `(${platform})` : ''}
              {isForward && forwardSource ? `(${FORWARD_SOURCE_LABELS[forwardSource]})` : ''}
            </strong>
          </>
        }
        icon={ShoppingBag}
        actions={
          isChannelSelected && (
            <Button variant="outline" size="sm" onClick={() => setIsChannelSelected(false)}>
              <Settings2 /> Ubah Channel
            </Button>
          )
        }
      />

      {isChannelSelected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-semibold">
              Katalog {isForward && !stockIsConsumed ? 'Produk (disuplai HQ)' : 'Live Product Cabang'}
            </h3>

            {availableInventories.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada stok barang yang tersedia untuk dijual. Lakukan validasi pengiriman dari HQ terlebih dahulu.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableInventories.map((entry) => {
                  const prod = entry.product;
                  const activePrice = resolveActivePrice(entry);
                  const inCart = cart.find((c) => c.masterProductId === prod.id);
                  const isResellerPriced = isReseller && channel === 'OFFLINE' && entry.resellerSellingPrice != null;

                  return (
                    <Card key={entry.key} className="hover:border-primary/40 transition-colors">
                      <CardContent className="flex flex-col justify-between p-4 h-full">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{prod.sku}</span>
                            <div className="flex items-center gap-1">
                              {isResellerPriced && (
                                <Badge className="border-transparent bg-amber-100 text-amber-700">Reseller</Badge>
                              )}
                              <Badge variant="outline" className="font-mono tabular-nums">
                                {stockIsConsumed ? `Stok: ${entry.qtyAvailable}` : 'Stok: —'}
                              </Badge>
                            </div>
                          </div>
                          <h4 className="font-semibold">{prod.name}</h4>
                          <p className="text-xs text-muted-foreground">Varian: {prod.variant}</p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                          <div>
                            <span className="block text-xs text-muted-foreground">
                              {isResellerPriced
                                ? 'Harga Reseller'
                                : channel === 'ONLINE'
                                  ? `Harga ${platform === 'TIKTOK' ? 'TikTok Shop' : 'Shopee'}`
                                  : 'Harga Offline'}
                            </span>
                            <span className="font-semibold tabular-nums">{formatRupiah(activePrice)}</span>
                            {isResellerPriced && prod.offlineSellingPrice !== activePrice && (
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                Offline: {formatRupiah(prod.offlineSellingPrice)}
                              </span>
                            )}
                          </div>

                          <Button
                            size="sm"
                            onClick={() => addToCart(prod.id)}
                            disabled={inCart ? inCart.qty >= maxSelectable(entry) : maxSelectable(entry) < 1}
                          >
                            <Plus /> {inCart ? `+ (${inCart.qty})` : 'Tambah'}
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
            <Card>
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
            className="w-full h-14 flex items-center justify-between px-5 font-semibold text-xs"
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4" />
              <span>Keranjang POS ({cartItemsCount} item)</span>
            </div>
            <span className="font-mono text-sm">{formatRupiah(calculatePayable())}</span>
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

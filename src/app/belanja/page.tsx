'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatRupiah } from '@/constants';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Store,
  Truck,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface KatalogProduct {
  masterProductId: string;
  sku: string;
  name: string;
  variant: string;
  unitPrice: number;
  offlinePrice: number;
  isResellerPriced: boolean;
  qtyAvailable: number;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

type Fulfillment = 'PICKUP' | 'COURIER';

export default function BelanjaPage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [products, setProducts] = useState<KatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [cart, setCart] = useState<{ masterProductId: string; qty: number }[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('PICKUP');
  const [address, setAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; transactionNumber: string; totalAmount: number } | null>(null);
  const submittingRef = useRef(false);

  const loadCatalog = useCallback(async (branchId?: string) => {
    try {
      const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const res = await fetch(`/api/katalog${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBranches(data.data.branches);
      setProducts(data.data.products);
      setSelectedBranchId(data.data.selectedBranchId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat katalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial one-time catalog load
    loadCatalog();
  }, [loadCatalog]);

  const handleBranchChange = (val: string | null) => {
    if (!val) return;
    setSelectedBranchId(val);
    setCart([]);
    setErrorMsg('');
    setLoading(true);
    loadCatalog(val);
  };

  const addToCart = (masterProductId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.masterProductId === masterProductId);
      const inv = products.find((p) => p.masterProductId === masterProductId);
      const maxQty = inv?.qtyAvailable || 0;
      const currentQty = existing?.qty || 0;
      if (currentQty >= maxQty) return prev;
      if (existing) {
        return prev.map((c) => (c.masterProductId === masterProductId ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { masterProductId, qty: 1 }];
    });
  };

  const updateCartQty = (masterProductId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.masterProductId !== masterProductId) return c;
          const inv = products.find((p) => p.masterProductId === masterProductId);
          const maxQty = inv?.qtyAvailable || 0;
          const nextQty = c.qty + delta;
          if (nextQty > maxQty || nextQty < 1) return c;
          return { ...c, qty: nextQty };
        })
    );
  };

  const removeFromCart = (masterProductId: string) => {
    setCart((prev) => prev.filter((c) => c.masterProductId !== masterProductId));
  };

  const productById = (id: string) => products.find((p) => p.masterProductId === id);

  const subtotal = cart.reduce((sum, item) => {
    const prod = productById(item.masterProductId);
    return prod ? sum + prod.unitPrice * item.qty : sum;
  }, 0);

  const parsedDeliveryFee = fulfillment === 'PICKUP' ? 0 : Math.max(0, Number(deliveryFee) || 0);
  const grandTotal = subtotal + parsedDeliveryFee;
  const cartItemsCount = cart.reduce((a, b) => a + b.qty, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (submittingRef.current) return;
    if (!selectedBranchId) {
      setCheckoutError('Cabang tujuan belum dipilih');
      return;
    }
    if (!customerName || !customerPhone) {
      setCheckoutError('Nama dan No. Handphone wajib diisi');
      return;
    }
    if (fulfillment === 'COURIER' && !address.trim()) {
      setCheckoutError('Alamat pengiriman wajib diisi untuk pengiriman kurir');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setCheckoutError('');

    try {
      const res = await fetch('/api/belanja/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranchId,
          customerName,
          customerPhone,
          fulfillment,
          address: fulfillment === 'COURIER' ? address : null,
          deliveryFee: parsedDeliveryFee,
          notes: notes || null,
          paymentMethod,
          items: cart,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setCart([]);
      setCheckoutOpen(false);
      setMobileCartOpen(false);
      setOrderSuccess({
        orderNumber: data.data.orderNumber,
        transactionNumber: data.data.transactionNumber,
        totalAmount: data.data.totalAmount,
      });
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal mengirim pesanan');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  const cartContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="size-4 text-muted-foreground" />
          Keranjang Belanja ({cartItemsCount})
        </h3>
        {cart.length > 0 && (
          <Button variant="link" size="sm" onClick={() => setCart([])} className="h-auto p-0 text-xs text-rose-600">
            Kosongkan
          </Button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">Keranjang masih kosong.</p>
          <p>Pilih produk dari katalog untuk mulai belanja.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-border">
          {cart.map((item) => {
            const prod = productById(item.masterProductId);
            if (!prod) return null;
            return (
              <div key={item.masterProductId} className="pt-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">{prod.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {formatRupiah(prod.unitPrice)} x {item.qty}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={() => updateCartQty(item.masterProductId, -1)} className="h-6 w-6">
                    <Minus className="size-3" />
                  </Button>
                  <span className="text-xs font-mono font-bold text-foreground w-5 text-center">{item.qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateCartQty(item.masterProductId, 1)}
                    disabled={item.qty >= prod.qtyAvailable}
                    className="h-6 w-6 border-border"
                  >
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCart(item.masterProductId)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-border space-y-3">
        <div className="space-y-1.5">
          {fulfillment === 'COURIER' && parsedDeliveryFee > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Ongkos Kirim</span>
              <span className="font-semibold tabular-nums">{formatRupiah(parsedDeliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-semibold">
            <span>TOTAL BAYAR</span>
            <span className="text-base tabular-nums">{formatRupiah(grandTotal)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Harga menggunakan harga khusus katalog ({fulfillment === 'PICKUP' ? 'ambil di cabang' : 'diantar kurir'}).
            Pesanan diproses otomatis dan langsung tercatat sebagai transaksi.
          </p>
        </div>

        <Button onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0} className="w-full">
          Lanjut ke Checkout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
              KK
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">KangKebab</p>
              <p className="text-[11px] text-muted-foreground">Portal Belanja Reseller</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="w-48 md:w-60">
              {branches.length > 0 ? (
                <Select value={selectedBranchId ?? undefined} onValueChange={handleBranchChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-9 w-48" />
              )}
            </div>

            <Button variant="outline" size="sm" className="relative" onClick={() => setMobileCartOpen(true)}>
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">Keranjang</span>
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full px-1 text-[10px] tabular-nums">
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 md:px-6 py-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Katalog Belanja</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Belanja langsung dari stok cabang dengan{' '}
              <span className="font-semibold text-foreground">harga khusus katalog</span>. Pesanan diproses dan
              dikonfirmasi oleh tim kami.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 font-medium">
            <Store className="size-3.5" />
            {selectedBranch?.name || 'Pilih cabang'}
          </Badge>
        </div>

        {errorMsg && (
          <Alert variant="destructive" className="py-2.5 px-3">
            <AlertDescription className="text-xs font-medium">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-9 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada produk tersedia di cabang ini. Coba pilih cabang lain.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((prod) => {
                  const inCart = cart.find((c) => c.masterProductId === prod.masterProductId);
                  return (
                    <Card key={prod.masterProductId} className="hover:border-primary/40 transition-colors">
                      <CardContent className="flex flex-col justify-between p-4 h-full">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-xs text-muted-foreground">{prod.sku}</span>
                            <div className="flex items-center gap-1">
                              {prod.isResellerPriced && (
                                <Badge className="border-transparent bg-amber-100 text-amber-700">Katalog</Badge>
                              )}
                              <Badge variant="outline" className="font-mono tabular-nums">
                                Stok: {prod.qtyAvailable}
                              </Badge>
                            </div>
                          </div>
                          <h4 className="font-semibold">{prod.name}</h4>
                          <p className="text-xs text-muted-foreground">Varian: {prod.variant}</p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                          <div>
                            <span className="block text-xs text-muted-foreground">Harga Katalog</span>
                            <span className="font-semibold tabular-nums">{formatRupiah(prod.unitPrice)}</span>
                            {prod.isResellerPriced && (
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                Offline: {formatRupiah(prod.offlinePrice)}
                              </span>
                            )}
                          </div>

                          <Button
                            size="sm"
                            onClick={() => addToCart(prod.masterProductId)}
                            disabled={prod.qtyAvailable <= (inCart?.qty || 0)}
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
              <CardContent className="p-5">{cartContent}</CardContent>
            </Card>
          </div>
        </div>
      </main>

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <Button
          onClick={() => setMobileCartOpen(true)}
          className="w-full h-14 flex items-center justify-between px-5 font-semibold text-xs"
        >
          <div className="flex items-center space-x-2">
            <ShoppingCart className="size-4" />
            <span>Keranjang ({cartItemsCount} item)</span>
          </div>
          <span className="font-mono text-sm">{formatRupiah(grandTotal)}</span>
        </Button>
      </div>

      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)} />
          <div className="relative w-full bg-card rounded-t-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto border-t border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <span className="font-bold text-sm text-foreground">Ringkasan Keranjang</span>
              <button onClick={() => setMobileCartOpen(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="size-5" />
              </button>
            </div>
            {cartContent}
          </div>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={(open) => !submitting && setCheckoutOpen(open)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Checkout Belanja</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Lengkapi data pemesan. Pesanan diproses otomatis dan langsung tercatat sebagai transaksi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {checkoutError && (
              <Alert variant="destructive" className="py-2.5 px-3">
                <AlertDescription className="text-xs font-medium">{checkoutError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="blj-name">Nama Pemesan <span className="text-destructive">*</span></Label>
              <Input id="blj-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama lengkap" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blj-phone">No. Handphone <span className="text-destructive">*</span></Label>
              <Input id="blj-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0812..." inputMode="tel" />
            </div>

            <div className="space-y-2">
              <Label>Metode Penerimaan</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={fulfillment === 'PICKUP' ? 'default' : 'outline'}
                  onClick={() => { setFulfillment('PICKUP'); setAddress(''); }}
                  className="flex h-16 flex-col items-center justify-center gap-1"
                >
                  <Store className="size-5" />
                  <span className="text-xs font-semibold">Ambil di Toko</span>
                </Button>
                <Button
                  type="button"
                  variant={fulfillment === 'COURIER' ? 'default' : 'outline'}
                  onClick={() => setFulfillment('COURIER')}
                  className="flex h-16 flex-col items-center justify-center gap-1"
                >
                  <Truck className="size-5" />
                  <span className="text-xs font-semibold">Diantar Kurir</span>
                </Button>
              </div>
            </div>

            {fulfillment === 'PICKUP' ? (
              <p className="text-xs text-muted-foreground">
                Pesanan akan disiapkan di <strong className="text-foreground">{selectedBranch?.name || 'cabang pilihan'}</strong>.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="blj-address">Alamat Pengiriman <span className="text-destructive">*</span></Label>
                  <Input id="blj-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap tujuan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blj-fee">Ongkos Kirim (opsional)</Label>
                  <Input
                    id="blj-fee"
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="blj-notes">Catatan (opsional)</Label>
              <Input id="blj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan untuk pesanan / kurir" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blj-pay">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                <SelectTrigger id="blj-pay" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH (Tunai)</SelectItem>
                  <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pembayaran diselesaikan saat pesanan diambil/diterima.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal Produk</span>
                <span className="font-semibold tabular-nums">{formatRupiah(subtotal)}</span>
              </div>
              {fulfillment === 'COURIER' && parsedDeliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ongkos Kirim</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(parsedDeliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 mt-1 text-sm">
                <span className="font-semibold">TOTAL BAYAR</span>
                <span className="font-bold tabular-nums">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCheckout} disabled={submitting || cart.length === 0} className="w-full">
              {submitting ? 'Mengirim Pesanan...' : 'Kirim Pesanan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderSuccess != null} onOpenChange={(open) => !open && setOrderSuccess(null)}>
        <DialogContent className="max-w-md bg-card border-border text-center">
          <DialogHeader>
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-6 text-emerald-600" />
            </span>
            <DialogTitle className="text-xl font-bold text-foreground pt-2">Pesanan Berhasil Dibuat</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Terima kasih! Pesanan Anda telah kami terima.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="rounded-lg border border-border/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nomor Pesanan</span>
                <span className="font-mono font-semibold">{orderSuccess?.orderNumber}</span>
              </div>
              {orderSuccess?.transactionNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-semibold">{orderSuccess.transactionNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">{formatRupiah(orderSuccess?.totalAmount || 0)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pesanan Anda telah diproses otomatis dan tercatat sebagai transaksi. Selesaikan pembayaran saat
              pesanan diambil/diterima.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setOrderSuccess(null)} className="w-full">
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { SalesTransaction } from '@/types';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditTransactionModalProps {
  transaction: SalesTransaction;
  onClose: () => void;
  onSuccess: (updatedTx: SalesTransaction) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ transaction, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [ecommerceActualPrice, setEcommerceActualPrice] = useState<string>(
    transaction.ecommerceActualPrice !== null && transaction.ecommerceActualPrice !== undefined
      ? String(transaction.ecommerceActualPrice)
      : ''
  );
  const [paymentMethod, setPaymentMethod] = useState(transaction.paymentMethod || 'CASH');
  const [paymentStatus, setPaymentStatus] = useState(transaction.paymentStatus || 'PAID');

  const isResellerDiscount = transaction.channel === 'OFFLINE' && transaction.isReseller;
  const [discountPercent, setDiscountPercent] = useState<string>(
    isResellerDiscount && transaction.discountPercent > 0 ? String(transaction.discountPercent) : ''
  );
  
  // Clone items for editing
  const [items, setItems] = useState(
    transaction.items.map(item => ({
      id: item.id,
      name: item.masterProduct.name,
      qty: String(item.qty),
      sellingPrice: String(item.sellingPrice),
    }))
  );

  const handleUpdateItem = (id: string, field: 'qty' | 'sellingPrice', value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg('');

    if (transaction.channel === 'ONLINE' && (ecommerceActualPrice === '' || Number(ecommerceActualPrice) <= 0)) {
      setErrorMsg('Harga Actual Ecommerce wajib diisi untuk transaksi Online');
      setLoading(false);
      return;
    }

    let parsedDiscount = null;
    if (isResellerDiscount) {
      if (discountPercent === '') {
        parsedDiscount = 0;
      } else {
        parsedDiscount = Number(discountPercent);
        if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
          setErrorMsg('Diskon reseller harus antara 0% dan 100%');
          setLoading(false);
          return;
        }
      }
    }

    try {
      const payload = {
        id: transaction.id,
        ecommerceActualPrice: ecommerceActualPrice === '' ? null : Number(ecommerceActualPrice),
        paymentMethod,
        paymentStatus,
        discountPercent: parsedDiscount,
        items: items.map(i => ({
          id: i.id,
          qty: Number(i.qty),
          sellingPrice: Number(i.sellingPrice),
        })),
      };

      const res = await fetch('/api/pos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      onSuccess(data.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={`Edit Transaksi: ${transaction.transactionNumber}`}
    >
      <div className="space-y-5">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Item Produk</Label>
            <div className="space-y-3 rounded-lg border border-border p-3">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-5 text-xs font-medium truncate self-center" title={item.name}>
                    {item.name}
                  </div>
                  <div className="col-span-4 md:col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      value={item.qty}
                      onChange={e => handleUpdateItem(item.id, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="col-span-8 md:col-span-5 space-y-1">
                    <Label className="text-xs text-muted-foreground">Harga Jual (Rp)</Label>
                    <Input
                      type="number"
                      value={item.sellingPrice}
                      onChange={e => handleUpdateItem(item.id, 'sellingPrice', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Overwrite Total Omzet (Harga Aktual Ecommerce)
              {transaction.channel === 'ONLINE' && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              type="number"
              placeholder="Kosongkan jika ingin mengikuti total per item"
              value={ecommerceActualPrice}
              onChange={e => setEcommerceActualPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Jika diisi, nilai ini akan menggantikan Total Omzet struk ini.</p>
          </div>

          {isResellerDiscount && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Diskon Reseller (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder="cth: 10"
                value={discountPercent}
                onChange={e => setDiscountPercent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Diskon dihitung dari subtotal item dan menggantikan Total Omzet.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="ECOMMERCE">ECOMMERCE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status Pembayaran</Label>
              <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val || 'PAID')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">LUNAS</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Check />}
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};
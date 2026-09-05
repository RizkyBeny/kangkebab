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

    try {
      const payload = {
        id: transaction.id,
        ecommerceActualPrice: ecommerceActualPrice === '' ? null : Number(ecommerceActualPrice),
        paymentMethod,
        paymentStatus,
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
      <div className="space-y-4">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground/80">Item Produk</Label>
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/50">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 md:col-span-5 text-xs font-medium truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Qty</Label>
                    <Input 
                      type="number" 
                      value={item.qty} 
                      onChange={e => handleUpdateItem(item.id, 'qty', e.target.value)} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div className="col-span-8 md:col-span-5">
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Harga Jual (Rp)</Label>
                    <Input 
                      type="number" 
                      value={item.sellingPrice} 
                      onChange={e => handleUpdateItem(item.id, 'sellingPrice', e.target.value)} 
                      className="h-8 text-xs" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground/80">
              Overwrite Total Omzet (Harga Aktual Ecommerce)
              {transaction.channel === 'ONLINE' && <span className="text-destructive"> *</span>}
            </Label>
            <Input 
              type="number" 
              placeholder="Kosongkan jika ingin mengikuti total per item" 
              value={ecommerceActualPrice} 
              onChange={e => setEcommerceActualPrice(e.target.value)} 
              className="h-9 text-xs" 
            />
            <p className="text-[10px] text-muted-foreground">Jika diisi, nilai ini akan menggantikan Total Omzet struk ini.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground/80">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                <SelectTrigger className="h-9 text-xs">
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
              <Label className="text-xs font-bold text-foreground/80">Status Pembayaran</Label>
              <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val || 'PAID')}>
                <SelectTrigger className="h-9 text-xs">
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

        <div className="pt-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs font-semibold px-4">
            Batal
          </Button>
          <Button onClick={handleSave} disabled={loading} className="h-9 text-xs font-semibold px-6">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};

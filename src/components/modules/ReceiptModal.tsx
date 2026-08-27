'use client';

import React from 'react';
import { SalesTransaction } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { Download, CheckCircle2, Receipt } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';

interface ReceiptModalProps {
  transaction: SalesTransaction;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const downloadPDFReceipt = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160], // Thermal receipt paper format
    });

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('KANGKEBAB POS', 40, 10, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.branch.name, 40, 15, { align: 'center' });
    if (transaction.branch.address) {
      doc.text(transaction.branch.address, 40, 19, { align: 'center' });
    }

    doc.line(5, 23, 75, 23);

    // Transaction Details
    doc.setFontSize(7);
    doc.text(`No. Struk: ${transaction.transactionNumber}`, 5, 27);
    doc.text(`Tanggal  : ${formatDate(transaction.createdAt)}`, 5, 31);
    doc.text(`Channel  : ${transaction.channel} (${transaction.platform || 'OFFLINE'})`, 5, 35);

    doc.line(5, 38, 75, 38);

    // Table of items
    const tableBody = transaction.items.map((item) => [
      `${item.masterProduct.name} (${item.masterProduct.variant})`,
      `${item.qty} x ${formatRupiah(item.sellingPrice)}`,
      formatRupiah(item.qty * item.sellingPrice),
    ]);

    autoTable(doc, {
      startY: 41,
      margin: { left: 5, right: 5 },
      body: tableBody,
      styles: { fontSize: 7, cellPadding: 1 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20, halign: 'right' },
        2: { cellWidth: 15, halign: 'right' },
      },
      theme: 'plain',
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;

    doc.line(5, finalY + 2, 75, finalY + 2);

    // Total Amount
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, finalY + 8);
    doc.text(formatRupiah(transaction.totalAmount), 75, finalY + 8, { align: 'right' });

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Terima kasih atas kunjungan Anda!', 40, finalY + 16, { align: 'center' });
    doc.text('Powered by KangKebab Multichannel', 40, finalY + 20, { align: 'center' });

    doc.save(`Struk_${transaction.transactionNumber.replace(/\//g, '_')}.pdf`);
  };

  return (
    <ResponsiveModal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Rincian Transaksi"
      icon={<Receipt className="w-5 h-5 text-slate-700" />}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-2">
          <div className="w-10 h-10 rounded-full bg-white text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-sm mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="font-mono font-bold text-lg text-emerald-900">{transaction.transactionNumber}</span>
          <span className="text-xs font-semibold text-emerald-700 mt-1">Transaksi Berhasil Disimpan</span>
        </div>

        {/* Receipt Preview Box */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 font-mono text-xs shadow-inner">
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Channel</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-sans font-bold">
              {transaction.channel}
            </span>
          </div>

          <div className="space-y-1 text-slate-600 text-[11px]">
            <div className="flex justify-between">
              <span>Cabang:</span>
              <span className="font-bold text-slate-900">{transaction.branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span className="font-bold text-slate-900">{formatDate(transaction.createdAt)}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            {transaction.items.map((item) => (
              <div key={item.id} className="flex justify-between text-[11px]">
                <span>
                  {item.masterProduct.name} ({item.qty}x)
                </span>
                <span className="font-bold text-slate-900">{formatRupiah(item.qty * item.sellingPrice)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3 mt-2 flex justify-between text-xs font-bold text-slate-900">
            <span>TOTAL PEMBAYARAN</span>
            <span className="text-emerald-700 text-sm font-mono">{formatRupiah(transaction.totalAmount)}</span>
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 md:h-10 text-xs font-bold">
            Tutup
          </Button>
          <Button onClick={downloadPDFReceipt} className="flex-1 h-11 md:h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            Unduh Struk PDF
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};

'use client';

import React from 'react';
import { SalesTransaction } from '@/types';
import { formatRupiah, formatDate } from '@/constants';
import { CheckCircle2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';

interface ReceiptModalProps {
  transaction: SalesTransaction;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const downloadPDFReceipt = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200], // Increased length for additional fields and logo
    });

    let currentY = 10;

    try {
      const img = new Image();
      img.src = '/logo.jpg';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      doc.addImage(img, 'JPEG', 30, currentY, 20, 20);
      currentY += 25;
    } catch (e) {
      console.warn('Failed to load logo', e);
    }

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('KANGKEBAB POS', 40, currentY, { align: 'center' });
    currentY += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.branch.name, 40, currentY, { align: 'center' });
    currentY += 4;
    if (transaction.branch.address) {
      doc.text(transaction.branch.address, 40, currentY, { align: 'center' });
      currentY += 4;
    }

    doc.line(5, currentY, 75, currentY);
    currentY += 4;

    // Transaction Details
    doc.setFontSize(7);
    doc.text(`No. Struk: ${transaction.transactionNumber}`, 5, currentY);
    currentY += 4;
    doc.text(`Tanggal  : ${formatDate(transaction.createdAt)}`, 5, currentY);
    currentY += 4;
    doc.text(`Channel  : ${transaction.channel} (${transaction.platform || 'OFFLINE'})`, 5, currentY);
    currentY += 4;
    if (transaction.isReseller) {
      doc.text(`Reseller : YA`, 5, currentY);
      currentY += 4;
    }
    doc.text(`Customer : ${transaction.customerName || '-'} (${transaction.customerPhone || '-'})`, 5, currentY);
    currentY += 4;
    doc.text(`Payment  : ${transaction.paymentMethod || '-'} (${transaction.paymentStatus || '-'})`, 5, currentY);
    currentY += 3;

    doc.line(5, currentY, 75, currentY);
    currentY += 3;

    // Table of items
    const tableBody = transaction.items.map((item) => [
      `${item.masterProduct.name} (${item.masterProduct.variant})`,
      `${item.qty} x ${formatRupiah(item.sellingPrice)}`,
      formatRupiah(item.qty * item.sellingPrice),
    ]);

    autoTable(doc, {
      startY: currentY,
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

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 80;

    doc.line(5, finalY + 2, 75, finalY + 2);

    // Discount (reseller) line before total
    let totalY = finalY + 8;
    if (transaction.isReseller && transaction.discountPercent > 0) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Diskon ${transaction.discountPercent}%:`, 5, finalY + 7);
      doc.text(`-${formatRupiah(transaction.discountAmount)}`, 75, finalY + 7, { align: 'right' });
      totalY = finalY + 11;
    }

    // Total Amount
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, totalY);
    doc.text(formatRupiah(transaction.totalAmount), 75, totalY, { align: 'right' });

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Terima kasih atas kunjungan Anda!', 40, totalY + 8, { align: 'center' });
    doc.text('Powered by KangKebab Multichannel', 40, totalY + 12, { align: 'center' });

    doc.save(`Struk_${transaction.transactionNumber.replace(/\//g, '_')}.pdf`);
  };

  return (
    <ResponsiveModal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Rincian Transaksi"
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-card text-emerald-600">
            <CheckCircle2 className="size-5" />
          </span>
          <span className="mt-2 font-mono text-lg font-semibold text-emerald-900">{transaction.transactionNumber}</span>
          <span className="text-xs text-emerald-700 mt-0.5">Transaksi Berhasil Disimpan</span>
        </div>

        {/* Receipt Preview Box */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-sans font-medium text-muted-foreground">Channel</span>
            <span className="flex items-center gap-1">
              {transaction.isReseller && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-800">
                  Reseller
                </span>
              )}
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-sans font-semibold text-emerald-800">
                {transaction.channel}
              </span>
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-foreground/80">
            <div className="flex justify-between">
              <span>Cabang</span>
              <span className="font-semibold text-foreground">{transaction.branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu</span>
              <span className="font-semibold text-foreground">{formatDate(transaction.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer</span>
              <span className="font-semibold text-foreground">{transaction.customerName || '-'} ({transaction.customerPhone || '-'})</span>
            </div>
            <div className="flex justify-between">
              <span>Pembayaran</span>
              <span className="font-semibold text-foreground">{transaction.paymentMethod || '-'} - {transaction.paymentStatus || '-'}</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            {transaction.items.map((item) => (
              <div key={item.id} className="flex justify-between text-[11px]">
                <span>{item.masterProduct.name} ({item.qty}x)</span>
                <span className="font-semibold text-foreground tabular-nums">{formatRupiah(item.qty * item.sellingPrice)}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1 border-t border-border pt-3">
            {transaction.isReseller && transaction.discountPercent > 0 && (
              <div className="flex justify-between text-[11px]">
                <span>Diskon ({transaction.discountPercent}%)</span>
                <span className="font-semibold tabular-nums text-rose-600">-{formatRupiah(transaction.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-semibold text-foreground">
              <span>TOTAL PEMBAYARAN</span>
              <span className="font-semibold tabular-nums text-emerald-700">{formatRupiah(transaction.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Tutup
          </Button>
          <Button onClick={downloadPDFReceipt} className="flex-1">
            <Download />
            Unduh Struk PDF
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};
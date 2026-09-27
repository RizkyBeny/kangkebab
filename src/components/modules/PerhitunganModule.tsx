'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  Receipt,
  Warehouse,
} from 'lucide-react';
import { Branch, PerhitunganReport, PerhitunganTableRow, User } from '@/types';
import { formatRupiah, parseLocalDate } from '@/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface PerhitunganModuleProps {
  currentUser: User;
  branches: Branch[];
}

const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Defaults to the 1st of the current month through today. */
function defaultPeriod(): { startDate: string; endDate: string } {
  const now = new Date();
  return { startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toISODate(now) };
}

const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const RevenueLine: React.FC<{ label: string; value: number; bold?: boolean; accent?: string }> = ({
  label,
  value,
  bold,
  accent,
}) => (
  <div className={`flex items-center justify-between gap-4 ${bold ? 'font-bold' : ''}`}>
    <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    <span className={`tabular-nums ${accent ?? (bold ? 'text-foreground' : 'text-foreground/80')}`}>
      Rp {rupiah(value)}
    </span>
  </div>
);

const StatCard: React.FC<{
  label: string;
  value: number;
  hint?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative';
}> = ({ label, value, hint, tone }) => (
  <Card size="sm">
    <CardContent className="px-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === 'negative'
            ? 'text-rose-600'
            : tone === 'positive'
              ? 'text-emerald-600'
              : 'text-foreground'
        }`}
      >
        Rp {rupiah(value)}
      </p>
      {hint && <p className="text-[11px] tabular-nums text-muted-foreground">{hint}</p>}    </CardContent>
  </Card>
);

const ProductTable: React.FC<{
  rows: PerhitunganTableRow[];
  /** Netted sum of the table's own lines. On the Forward table this can differ from
   *  `channelModal` when one product sold in both directions, because the signed Qty cancels. */
  modalTotal: number;
  /** Modal for the whole channel — always matches the summary panel. Used for the margin row
   *  so the margin is never computed off a netted table total. */
  channelModal: number;
  revenue: number;
  signed?: boolean;
}> = ({ rows, modalTotal, channelModal, revenue, signed }) => {
  const margin = revenue - channelModal;
  const ties = Math.abs(modalTotal - channelModal) < 1;
  return (
    <>
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">No</TableHead>
              <TableHead>Nama Produk</TableHead>
              <TableHead className="text-right">Harga Modal</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Jumlah Modal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                  Tidak ada data pada periode ini.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {row.name.split('.')[0]}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{row.name.replace(/^\d+\.\s*/, '')}</div>
                    <div className="text-muted-foreground">{row.variant}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {rupiah(row.hargaModal)}
                    {row.mixedPrice && (
                      <span
                        className="ml-1 text-amber-600"
                        title="Modal produk berubah di tengah periode, jadi Harga Modal x Qty tidak sama dengan Jumlah"
                      >
                        *
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs font-semibold tabular-nums ${
                      signed && row.qty < 0 ? 'text-rose-600' : ''
                    }`}
                  >
                    {row.qty}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs font-medium tabular-nums ${
                      signed && row.jumlah < 0 ? 'text-rose-600' : ''
                    }`}
                  >
                    {rupiah(row.jumlah)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-right text-xs font-semibold">
                Total Modal tabel
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums">
                {rows.reduce((s, r) => s + r.qty, 0)}
              </TableCell>
              <TableCell className="text-right text-xs font-bold tabular-nums">
                {rupiah(modalTotal)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/40">
              <TableCell colSpan={4} className="text-right text-[11px] font-medium text-muted-foreground">
                Margin channel · omzet {rupiah(revenue)} − modal {rupiah(channelModal)}
              </TableCell>
              <TableCell
                className={`text-right text-xs font-bold tabular-nums ${
                  margin < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {rupiah(margin)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {!ties && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
          Total tabel ({rupiah(modalTotal)}) tidak sama dengan modal channel ({rupiah(channelModal)}) karena
          ada produk yang terjual Resi Forward dari HQ sekaligus dari stok cabang, sehingga Qty positif dan
          negatif saling meniadakan. Yang dipakai untuk margin tetap modal channel.
        </p>
      )}
    </>
  );
};

type ExpenseKey = 'packingFee' | 'ads' | 'utility' | 'sharesBenny' | 'sharesRiyan';

const EXPENSE_FIELDS: [ExpenseKey, string][] = [
  ['packingFee', 'Packing fee'],
  ['ads', 'Ads'],
  ['utility', 'Utility, Etc'],
  ['sharesBenny', 'Shares Benny'],
  ['sharesRiyan', 'Shares Riyan'],
];

/** The profit-sharing view: per-channel omzet, modal, margin and margin %, with the Resi
 *  Forward deduction sitting between the gross invoiced and the branch's net figures.
 *
 *  The channel rows are GROSS, matching their product tables. The HQ deduction is its own row so
 *  the statement reads as arithmetic the reader can follow: gross invoiced, less what HQ
 *  supplied, equals the branch's net sales. Netting the channel rows instead would hide the
 *  deduction inside a channel and make the product tables disagree with the summary. */
const ChannelCostTable: React.FC<{ report: PerhitunganReport }> = ({ report }) => {
  const channelRows = [
    { label: 'Shopee', revenue: report.revenue.shopee, modal: report.modal.shopee },
    { label: 'Tiktok', revenue: report.revenue.tiktok, modal: report.modal.tiktok },
    { label: 'Toko (Offline)', revenue: report.revenue.offline, modal: report.modal.offline },
  ];
  const gross = {
    revenue: channelRows.reduce((s, r) => s + r.revenue, 0),
    modal: channelRows.reduce((s, r) => s + r.modal, 0),
  };
  const deduction = {
    revenue: -report.revenue.lessForwardFromHq,
    modal: -report.modal.lessForwardFromHq,
  };
  const deductionMargin = deduction.revenue - deduction.modal;

  const tone = (value: number) => (value < 0 ? 'text-rose-600' : 'text-emerald-600');

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Omzet</TableHead>
            <TableHead className="text-right">Modal (COGS)</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead className="text-right">Margin %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {channelRows.map((r) => {
            const margin = r.revenue - r.modal;
            return (
              <TableRow key={r.label}>
                <TableCell className="text-xs font-medium">{r.label}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{rupiah(r.revenue)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{rupiah(r.modal)}</TableCell>
                <TableCell className={`text-right text-xs font-semibold tabular-nums ${tone(margin)}`}>
                  {rupiah(margin)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {r.revenue > 0 ? `${((margin / r.revenue) * 100).toFixed(1)}%` : '—'}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Gross subtotal, so the deduction below reads as a subtraction rather than a
              fourth channel. */}
          <TableRow className="border-t-2 border-foreground/20">
            <TableCell className="text-xs font-semibold text-foreground">
              Total Terinvoice (Gross)
            </TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums">
              {rupiah(gross.revenue)}
            </TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums">
              {rupiah(gross.modal)}
            </TableCell>
            <TableCell
              className={`text-right text-xs font-semibold tabular-nums ${tone(gross.revenue - gross.modal)}`}
            >
              {rupiah(gross.revenue - gross.modal)}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
              {gross.revenue > 0
                ? `${(((gross.revenue - gross.modal) / gross.revenue) * 100).toFixed(1)}%`
                : '—'}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="text-xs font-medium text-violet-700">
              Dikurangi: Resi Forward dari HQ
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-violet-700">
              {rupiah(deduction.revenue)}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-violet-700">
              {rupiah(deduction.modal)}
            </TableCell>
            <TableCell
              className={`text-right text-xs font-semibold tabular-nums ${tone(deductionMargin)}`}
            >
              {rupiah(deductionMargin)}
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted/40">
            <TableCell className="text-xs font-bold">Net Sales (Cabang)</TableCell>
            <TableCell className="text-right text-xs font-bold tabular-nums">
              {rupiah(report.revenue.netSales)}
            </TableCell>
            <TableCell className="text-right text-xs font-bold tabular-nums">
              {rupiah(report.modal.net)}
            </TableCell>
            <TableCell
              className={`text-right text-xs font-bold tabular-nums ${tone(report.totals.margin)}`}
            >
              {rupiah(report.totals.margin)}
            </TableCell>
            <TableCell className="text-right text-xs font-bold tabular-nums text-muted-foreground">
              {report.totals.marginPercentage.toFixed(1)}%
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export const PerhitunganModule: React.FC<PerhitunganModuleProps> = ({ currentUser, branches }) => {
  const [branchId, setBranchId] = useState<string>(currentUser.branchId || branches[0]?.id || '');
  // Both bounds default to the current month-to-date; `defaultPeriod` is pure so the two
  // lazy initializers always agree.
  const [startDate, setStartDate] = useState<string>(() => defaultPeriod().startDate);
  const [endDate, setEndDate] = useState<string>(() => defaultPeriod().endDate);
  const [report, setReport] = useState<PerhitunganReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [exporting, setExporting] = useState(false);

  // "Pengeluaran" has no table in the database, so — exactly like the printed report — it is
  // typed in per report and never persisted. The panel stays collapsed until asked for, so the
  // default view carries no expense chrome. Reset whenever the period or branch changes so a
  // figure can never silently carry over to a different settlement.
  const [showExpenses, setShowExpenses] = useState(false);
  const [expenses, setExpenses] = useState<Record<ExpenseKey, string>>({
    packingFee: '',
    ads: '',
    utility: '',
    sharesBenny: '',
    sharesRiyan: '',
  });

  const isHq = currentUser.role === 'HQ_ADMIN';
  const effectiveBranchId = isHq ? branchId : currentUser.branchId || '';

  const setExpense = (key: ExpenseKey, value: string) =>
    setExpenses((prev) => ({ ...prev, [key]: value }));

  const expenseTotal = useMemo(
    () => Object.values(expenses).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [expenses]
  );

  // Gross margin net of the hand-entered expenses — the figure the profit share is based on.
  const netMargin = report ? report.totals.margin - expenseTotal : 0;

  const loadReport = useCallback(async () => {
    if (!effectiveBranchId || !startDate || !endDate) return;
    setLoading(true);
    setErrorMsg('');
    // A new period/branch is a new settlement: never carry hand-typed expenses across.
    setExpenses({ packingFee: '', ads: '', utility: '', sharesBenny: '', sharesRiyan: '' });
    setShowExpenses(false);
    try {
      const params = new URLSearchParams({ branchId: effectiveBranchId, startDate, endDate });
      const res = await fetch(`/api/reports/perhitungan?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setReport(data.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat laporan perhitungan');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportPDF = () => {
    if (!report) return;
    setExporting(true);

    try {
      // A4 landscape (297 x 210mm) to match the printed "Hari Perhitungan" report.
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Kang Kebab - ${report.branch.name} - Hari Perhitungan`, 10, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Sales Tgl ${report.periodLabel}`, 10, 20);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `Dicetak ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`,
        pageWidth - 10,
        20,
        { align: 'right' }
      );
      doc.setTextColor(0);

      // ---- Left column: revenue summary ----
      let y = 32;
      doc.setFontSize(8);
      const summaryX = 10;
      const valueX = 72;

      const summaryLine = (label: string, value: number, opts?: { bold?: boolean; color?: [number, number, number] }) => {
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
        if (opts?.color) doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
        doc.text(label, summaryX, y);
        doc.text(`Rp ${rupiah(value)}`, valueX, y, { align: 'right' });
        doc.setTextColor(0);
        y += 5;
      };

      summaryLine('Shopee', report.revenue.shopee);
      summaryLine('Tiktok', report.revenue.tiktok);
      summaryLine('Toko (Offline)', report.revenue.offline);
      doc.setLineWidth(0.3);
      doc.line(summaryX, y - 3, valueX, y - 3);
      summaryLine('GROSS SALES (Terinvoice)', report.revenue.totalInvoiced, { bold: true });
      if (report.revenue.lessForwardFromHq > 0) {
        summaryLine('Dikurangi Resi Forward dari HQ', -report.revenue.lessForwardFromHq, {
          color: [124, 58, 237],
        });
        doc.setLineWidth(0.3);
        doc.line(summaryX, y - 3, valueX, y - 3);
      }
      summaryLine('NET SALES (Gross Sales Cabang)', report.revenue.netSales, { bold: true });

      y += 4;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Modal (COGS)', summaryX, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      // Labels match the revenue lines above so the two blocks read as one list.
      const modalLines: [string, number][] = [
        ['Shopee', report.modal.shopee],
        ['Tiktok', report.modal.tiktok],
        ['Toko (Offline)', report.modal.offline],
      ];
      for (const [label, value] of modalLines) {
        doc.text(label, summaryX + 2, y);
        doc.text(`Rp ${rupiah(value)}`, valueX, y, { align: 'right' });
        y += 4;
      }
      doc.setLineWidth(0.3);
      doc.line(summaryX, y - 3, valueX, y - 3);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Modal (COGS)', summaryX, y);
      doc.text(`Rp ${rupiah(report.modal.total)}`, valueX, y, { align: 'right' });
      if (report.modal.lessForwardFromHq > 0) {
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(124, 58, 237);
        doc.text('Dikurangi dari HQ', summaryX + 2, y);
        doc.text(`- Rp ${rupiah(report.modal.lessForwardFromHq)}`, valueX, y, { align: 'right' });
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
      }
      y += 4;
      doc.text('Total Modal (COGS) Cabang', summaryX, y);
      doc.text(`Rp ${rupiah(report.modal.net)}`, valueX, y, { align: 'right' });
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text('Gross Margin', summaryX, y);
      const gm = report.totals.margin;
      const gmp = report.totals.marginPercentage;
      doc.text(`Rp ${rupiah(gm)} (${gmp.toFixed(2)}%)`, valueX, y, { align: 'right' });
      if (expenseTotal !== 0) {
        y += 4;
        doc.text('Pengeluaran (manual)', summaryX, y);
        doc.text(`- Rp ${rupiah(expenseTotal)}`, valueX, y, { align: 'right' });
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.text('Net Margin (Stlh Pengeluaran)', summaryX, y);
        doc.text(`Rp ${rupiah(netMargin)} (${(netMargin / Math.max(report.revenue.netSales, 1) * 100).toFixed(2)}%)`, valueX, y, { align: 'right' });
      }
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text('Jumlah Transaksi', summaryX, y);
      doc.text(`${report.totals.transactionCount} transaksi`, valueX, y, { align: 'right' });

      // ---- Right: two product tables side by side, via one two-level-header table ----
      // Four tables no longer fit on one A4 landscape page (12 rows each, two stacked runs
      // past the 210mm page height once headers and footnotes are added), so the report is
      // split: page 1 carries the summary with the online channels, page 2 the rest.
      type PdfTable = {
        title: string;
        rows: PerhitunganTableRow[];
        modalTotal: number;
        channelModal: number;
        revenue: number;
        signed?: boolean;
      };

      const drawPair = (left: PdfTable, right: PdfTable, startY: number) => {
        const rowCount = Math.max(left.rows.length, right.rows.length, 1);
        const body: string[][] = [];
        for (let i = 0; i < rowCount; i++) {
          const a = left.rows[i];
          const b = right.rows[i];
          body.push([
            a ? a.name.split('.')[0] : '',
            a ? a.name.replace(/^\d+\.\s*/, '') : '',
            a ? rupiah(a.hargaModal) : '',
            a ? String(a.qty) : '',
            a ? rupiah(a.jumlah) : '',
            b ? b.name.split('.')[0] : '',
            b ? b.name.replace(/^\d+\.\s*/, '') : '',
            b ? rupiah(b.hargaModal) : '',
            b ? String(b.qty) : '',
            b ? rupiah(b.jumlah) : '',
          ]);
        }

        // The margin row uses each channel's modal, never the netted table total — on the
        // Forward table the signed Qty cancels when one product sold in both directions, so
        // the table total understates the real modal. The forward figure is its netted
        // contribution, since the statement deducts the HQ half elsewhere.
        const marginOf = (t: PdfTable) => t.revenue - t.channelModal;

        autoTable(doc, {
          startY,
          margin: { left: 80, right: 10 },
          head: [
            [
              { content: left.title, colSpan: 5 },
              { content: right.title, colSpan: 5 },
            ],
            ['No', 'Nama Produk', 'Harga Modal', 'Qty', 'Jumlah Modal', 'No', 'Nama Produk', 'Harga Modal', 'Qty', 'Jumlah Modal'],
          ],
          body,
          foot: [
            [
              { content: 'Total Modal', colSpan: 3, styles: { halign: 'right' } },
              String(left.rows.reduce((s, r) => s + r.qty, 0)),
              rupiah(left.modalTotal),
              { content: 'Total Modal', colSpan: 3, styles: { halign: 'right' } },
              String(right.rows.reduce((s, r) => s + r.qty, 0)),
              rupiah(right.modalTotal),
            ],
            [
              { content: 'Margin channel', colSpan: 4, styles: { halign: 'right' } },
              rupiah(marginOf(left)),
              { content: 'Margin channel', colSpan: 4, styles: { halign: 'right' } },
              rupiah(marginOf(right)),
            ],
          ],
          theme: 'grid',
          styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
          headStyles: { fontSize: 6.5, halign: 'center', valign: 'middle' },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            2: { cellWidth: 20, halign: 'right' },
            3: { cellWidth: 10, halign: 'right' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 8, halign: 'center' },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 10, halign: 'right' },
            9: { cellWidth: 22, halign: 'right' },
          },
          // Only the right-hand table carries the signed convention (Forward), so only its
          // Qty / Jumlah cells get the negative-value tint.
          didParseCell: (data) => {
            if (!right.signed || data.section !== 'body') return;
            if (data.column.index !== 8 && data.column.index !== 9) return;
            const raw = String(data.cell.raw).replace(/[^\d-]/g, '');
            if (raw.startsWith('-')) {
              data.cell.styles.textColor = [190, 40, 40];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
      };

      drawPair(
        {
          title: 'Shopee',
          rows: report.shopeeTable,
          modalTotal: report.shopeeTableTotal,
          channelModal: report.modal.shopee,
          revenue: report.revenue.shopee,
        },
        {
          title: 'Tiktok',
          rows: report.tiktokTable,
          modalTotal: report.tiktokTableTotal,
          channelModal: report.modal.tiktok,
          revenue: report.revenue.tiktok,
        },
        30
      );

      // ---- Page 2: offline + forward ----
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Kang Kebab - ${report.branch.name} - Hari Perhitungan`, 10, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Sales Tgl ${report.periodLabel} - lanjutan`, 10, 20);
      doc.setFontSize(8);
      doc.text('NET SALES', 80, 26);
      doc.text(`Rp ${rupiah(report.revenue.netSales)}`, 150, 26, { align: 'right' });
      doc.text('Total Modal (COGS) Cabang', 160, 26);
      doc.text(`Rp ${rupiah(report.modal.net)}`, 235, 26, { align: 'right' });
      doc.text('Gross Margin', 245, 26);
      doc.text(`Rp ${rupiah(gm)}`, 287, 26, { align: 'right' });

      drawPair(
        {
          title: 'Toko (Offline)',
          rows: report.offlineTable,
          modalTotal: report.offlineTableTotal,
          channelModal: report.modal.offline,
          revenue: report.revenue.offline,
        },
        {
          title: 'Resi Forward (rincian)',
          rows: report.forwardTable,
          modalTotal: report.forwardTableTotal,
          channelModal: report.forwardTableTotal,
          revenue: report.forward.fromHq.revenue + report.forward.fromBranch.revenue,
          signed: true,
        },
        30
      );

      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 150;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(110);
      doc.text(
        'Resi Forward hanya berlaku untuk penjualan Online. Tabel Resi Forward adalah rincian, bukan baris omzet tersendiri: pembayarannya sudah termasuk di tabel Shopee atau Tiktok.',
        10,
        finalY + 6
      );
      doc.text(
        'Qty negatif pada tabel Resi Forward = barang disuplai HQ (stok cabang tidak berkurang, omzet & modal dikurangi dari cabang). Qty positif = barang dari stok cabang.',
        10,
        finalY + 10
      );
      doc.text(
        'Harga Modal memakai Modal (COGS) dari Master Data & Pricing. Margin = Omzet - Modal, dihitung sebelum Pengeluaran.',
        10,
        finalY + 14
      );
      doc.text(
        'Omzet Shopee dan Tiktok memakai Harga Aktual Ecommerce dari POS, sehingga tidak selalu sama dengan Harga Jual di Master Data.',
        10,
        finalY + 18
      );
      doc.text(
        'Margin tabel Resi Forward bisa lebih kecil karena satu produk terjual dari HQ sekaligus dari stok cabang sehingga Qty saling meniadakan.',
        10,
        finalY + 22
      );

      doc.save(`Perhitungan_${report.branch.code}_${startDate}_${endDate}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const periodInvalid = useMemo(() => {
    if (!startDate || !endDate) return true;
    return parseLocalDate(endDate).getTime() < parseLocalDate(startDate).getTime();
  }, [startDate, endDate]);

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Laporan Perhitungan"
        description="Rekap omzet per channel beserta rincian produk untuk periode tertentu, siap diunduh sebagai PDF. Resi Forward dihitung sebagai penjualan Online dengan pengurangan untuk barang yang disuplai HQ."
        icon={FileSpreadsheet}
        actions={
          <>
            {isHq && (
              <Select value={branchId} onValueChange={(val) => val && setBranchId(val)}>
                <SelectTrigger className="w-48">
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
            )}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                aria-label="Tanggal mulai"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                aria-label="Tanggal akhir"
              />
            </div>
            <Button onClick={handleExportPDF} disabled={!report || exporting || periodInvalid}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              Unduh PDF
            </Button>
          </>
        }
      />

      {periodInvalid && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription className="text-xs">
            Tanggal akhir tidak boleh lebih awal dari tanggal mulai.
          </AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Menyusun laporan...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-4">
          {/* Stat row: the whole financial spine in one band, so the detail tabs below can
              stay purely tabular. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Gross Sales"
              value={report.revenue.netSales}
              hint={
                <>
                  {report.totals.transactionCount} transaksi · {report.periodLabel}
                  {report.revenue.lessForwardFromHq > 0 && (
                    <span className="mt-0.5 block text-violet-700">
                      {rupiah(report.revenue.totalInvoiced)} terinvoice −{' '}
                      {rupiah(report.revenue.lessForwardFromHq)} Resi Forward dari HQ
                    </span>
                  )}
                </>
              }
            />
            <StatCard
              label="Total Modal (COGS)"
              value={report.modal.net}
              hint={
                report.modal.lessForwardFromHq > 0 ? (
                  <span className="text-violet-700">
                    {rupiah(report.modal.total)} − {rupiah(report.modal.lessForwardFromHq)} dari HQ
                  </span>
                ) : undefined
              }
            />
            <StatCard
              label="Gross Margin"
              value={report.totals.margin}
              hint={`${report.totals.marginPercentage.toFixed(2)}% dari Net Sales`}
              tone={report.totals.margin < 0 ? 'negative' : 'default'}
            />
            {expenseTotal !== 0 && (
              <StatCard
                label="Net Margin"
                value={netMargin}
                hint={`setelah pengeluaran ${rupiah(expenseTotal)}`}
                tone={netMargin < 0 ? 'negative' : 'positive'}
              />
            )}
          </div>

          <Tabs defaultValue="offline" className="space-y-3">
            <TabsList className="flex-wrap">
              <TabsTrigger value="offline">Toko (Offline)</TabsTrigger>
              <TabsTrigger value="shopee">Shopee</TabsTrigger>
              <TabsTrigger value="tiktok">Tiktok</TabsTrigger>
              <TabsTrigger value="forward">
                <ArrowLeftRight className="size-3.5" />
                Resi Forward
              </TabsTrigger>
              <TabsTrigger value="cost">Modal &amp; Margin</TabsTrigger>
            </TabsList>

            <TabsContent value="offline" className="space-y-3">
              <ProductTable
                rows={report.offlineTable}
                modalTotal={report.offlineTableTotal}
                channelModal={report.modal.offline}
                revenue={report.revenue.offline}
              />
            </TabsContent>

            <TabsContent value="shopee" className="space-y-3">
              <ProductTable
                rows={report.shopeeTable}
                modalTotal={report.shopeeTableTotal}
                channelModal={report.modal.shopee}
                revenue={report.revenue.shopee}
              />
              <p className="text-[11px] text-muted-foreground">
                Omzet Shopee memakai <span className="font-semibold">Harga Aktual Ecommerce</span>{' '}
                yang diketik di POS, jadi tidak selalu sama dengan Harga Jual Shopee di Master Data.
                Margin di sini belum dikurangi komisi platform maupun Ads, dan sudah termasuk Resi
                Forward yang dikirim dari HQ.
              </p>
            </TabsContent>

            <TabsContent value="tiktok" className="space-y-3">
              <ProductTable
                rows={report.tiktokTable}
                modalTotal={report.tiktokTableTotal}
                channelModal={report.modal.tiktok}
                revenue={report.revenue.tiktok}
              />
              <p className="text-[11px] text-muted-foreground">
                Omzet Tiktok memakai <span className="font-semibold">Harga Aktual Ecommerce</span>{' '}
                yang diketik di POS, jadi tidak selalu sama dengan Harga Jual TikTok di Master Data.
                Margin di sini belum dikurangi komisi platform maupun Ads, dan sudah termasuk Resi
                Forward yang dikirim dari HQ.
              </p>
            </TabsContent>

            <TabsContent value="forward" className="space-y-3">
              <ProductTable
                rows={report.forwardTable}
                modalTotal={report.forwardTableTotal}
                channelModal={report.forwardTableTotal}
                revenue={report.forward.fromHq.revenue + report.forward.fromBranch.revenue}
                signed
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-medium text-violet-800">
                      <Warehouse className="size-3.5" />
                      Barang dari HQ
                    </span>
                    <span className="font-semibold tabular-nums text-violet-800">
                      − {formatRupiah(report.forward.fromHq.revenue)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {report.forward.fromHq.qty} unit dikirim dari HQ, jadi stok cabang tidak
                    berkurang. Omzet <span className="font-semibold">dan modal</span> (
                    {formatRupiah(report.forward.fromHq.modal)}) dikurangi dari sisi cabang, sehingga
                    Qty tabel minus.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <PackageCheck className="size-3.5" />
                      Dari Stok Cabang
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatRupiah(report.forward.fromBranch.revenue)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {report.forward.fromBranch.qty} unit diambil dari stok cabang sehingga stok
                    berkurang, dan omzet serta modal ({formatRupiah(report.forward.fromBranch.modal)})
                    masuk penuh ke cabang. Qty tabel positif.
                  </p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Tabel ini adalah <span className="font-semibold">rincian</span> Resi Forward, bukan
                baris omzet tersendiri — penjualan ini sudah termasuk di tabel Shopee atau Tiktok
                sesuai platformnya, dan hanya bagian dari HQ yang dikurangi pada tabel Modal &amp;
                Margin.
              </p>
            </TabsContent>

            <TabsContent value="cost" className="space-y-3">
              <ChannelCostTable report={report} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Baris channel bersifat bruto dan sesuai dengan tabel produknya. Baris{' '}
                <span className="font-semibold text-violet-700">Dikurangi: Resi Forward dari HQ</span>{' '}
                memotong omzet <span className="font-semibold">dan</span> modal, karena cabang tidak
                menyuplai barang itu — memotong omzet saja akan membuat margin terlihat rugi. Baris{' '}
                <span className="font-semibold text-foreground">Net Sales (Cabang)</span> adalah angka
                yang dipakai untuk bagi hasil.
              </p>
            </TabsContent>
          </Tabs>

          {/* Pengeluaran is opt-in: nothing to show until there is something to type. */}
          {!showExpenses ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowExpenses(true)}>
                <Receipt className="size-3.5" />
                Isi Pengeluaran
              </Button>
            </div>
          ) : (
            <Card size="sm">
              <CardHeader className="pb-3 border-b border-border/70">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  Pengeluaran (input manual)
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExpenses(false)}
                    className="h-6 px-2 text-xs"
                  >
                    <ChevronDown className="size-3.5" />
                    Sembunyikan
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Belum ada pencatatan pengeluaran di sistem, jadi angka ini diketik tangan per laporan
                  dan <span className="font-semibold">tidak disimpan</span>. Nilai kembali kosong
                  saat cabang atau periode berubah.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {EXPENSE_FIELDS.map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label
                        htmlFor={`expense-${key}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {label}
                      </label>
                      <Input
                        id={`expense-${key}`}
                        type="number"
                        inputMode="numeric"
                        value={expenses[key]}
                        onChange={(e) => setExpense(key, e.target.value)}
                        placeholder="0"
                        className="h-8 text-xs tabular-nums"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                  <RevenueLine label="Total Pengeluaran" value={expenseTotal} />
                  <RevenueLine
                    label="Net Margin (setelah pengeluaran)"
                    value={netMargin}
                    bold
                    accent={netMargin < 0 ? 'text-rose-600' : 'text-emerald-600'}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Harga Modal memakai <span className="font-semibold text-foreground">Modal (COGS)</span>{' '}
            dari Master Data &amp; Pricing, jadi seluruh tabel menghitung modal — bukan omzet.
            Tanda <span className="font-semibold text-amber-600">*</span> berarti modal produk berubah
            di tengah periode sehingga Harga Modal × Qty tidak lagi sama dengan Jumlah. Resi Forward
            hanya berlaku untuk penjualan Online, dan bagian yang disuplai HQ dipotong dari omzet
            <span className="font-semibold text-foreground"> serta modal</span> cabang.
          </p>
        </div>
      )}

      {!loading && !report && !errorMsg && !periodInvalid && (
        <EmptyState
          icon={FileSpreadsheet}
          title="Laporan belum tersedia"
          description="Pilih cabang dan rentang tanggal yang valid untuk menyusun laporan perhitungan."
        />
      )}
    </div>
  );
};

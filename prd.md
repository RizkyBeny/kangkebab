# PRD: Sistem Pencatatan Stock Opname Realtime Multichannel

### 1. Overview

| Field | Value |
|---|---|
| **Document status** | Draft |
| **PRD type** | Product PRD |
| **Author** | [NEEDS INPUT] |
| **Last updated** | 27 Agustus 2026 |
| **Target release** | [NEEDS INPUT] |
| **Primary stakeholders** | HQ Operations/Inventory, Finance, Cabang Operations, Engineering, Product |

---

### 2. Problem Statement

Bisnis dengan struktur HQ dan multi-cabang saat ini mengelola distribusi barang, stok, dan penjualan (online via e-commerce maupun offline) secara manual atau di sistem yang terpisah-pisah. Akibatnya, selisih stok (barang rusak/hilang saat pengiriman) tidak terdeteksi cepat, HQ tidak punya visibilitas real-time atas stok dan penjualan tiap cabang, rekonsiliasi keuangan memakan waktu lama, dan cabang tidak punya cara terstandardisasi untuk menerbitkan bukti transaksi ke customer offline. ⚠️ Needs validation — belum ada data kuantitatif (mis. rata-rata waktu rekonsiliasi saat ini, frekuensi selisih stok) untuk mengukur besarnya masalah ini; disarankan divalidasi dengan tim operasional cabang eksisting sebelum development dimulai.

---

### 3. Goals

**Business goal:**
Menurunkan selisih stok yang tidak tercatat, mempercepat rekonsiliasi stok & keuangan, memberikan visibilitas real-time stok antar cabang, dan meningkatkan akurasi laporan omzet/pendapatan. Target angka spesifik: [NEEDS INPUT] — perlu baseline dari proses manual saat ini (lihat Section 9).

**User goal:**
HQ dapat mengirim dan memantau distribusi barang ke seluruh cabang dari satu tempat tanpa rekonsiliasi manual via spreadsheet/WA. Cabang dapat menerima, memvalidasi, menjual (online & offline), dan mencetak struk untuk customer tanpa alat bantu tambahan di luar sistem.

**Non-goals:**
- Integrasi API otomatis (auto-sync) dengan platform e-commerce (Shopee/Tiktok) — pencatatan penjualan online dilakukan manual oleh cabang.
- Aplikasi mobile native (scope saat ini web dashboard saja).
- Forecasting/prediksi kebutuhan stok berbasis AI.
- Perhitungan pajak otomatis dan multi-currency.

---

### 4. User Personas

**Primary persona: HQ Admin / Inventory Manager**
- Context: Bekerja dari kantor pusat, mengelola master data barang dan distribusi ke 1–10 cabang.
- Motivation: Ingin memastikan barang yang dikirim ke cabang tercatat akurat (nama, varian, qty, harga modal) dan bisa memantau stok serta keuangan seluruh cabang secara konsolidasi tanpa menunggu laporan manual.
- Pain point: Saat ini tidak ada sistem terpusat yang menunjukkan status pengiriman dan validasi penerimaan barang secara real-time per cabang.

**Secondary persona: Cabang Staff (Admin/Kasir Cabang)**
- Context: Bekerja di lokasi cabang, menerima barang kiriman HQ, mengelola stok toko, dan melayani transaksi ke customer (offline di toko, atau input rekap penjualan online).
- Motivation: Ingin proses terima barang, jual produk, dan cetak struk berjalan cepat tanpa pencatatan ganda di buku/excel terpisah.
- Pain point: Barang yang diterima kadang tidak sesuai (rusak/kurang) dan sulit dilaporkan balik ke HQ secara terlacak; belum ada cara cepat membuat struk resmi untuk customer offline.

---

### 5. User Stories

| ID | User Story | Priority |
|---|---|---|
| US-01 | Sebagai HQ Admin, saya ingin menginput seluruh barang beserta harga modal ke sistem, agar ada master data stok terpusat. | P0 |
| US-02 | Sebagai HQ Admin, saya ingin mencatat pengiriman barang ke cabang tertentu (nama barang, varian, quantity, harga), agar cabang tahu persis apa yang akan diterima. | P0 |
| US-03 | Sebagai Cabang Staff, saya ingin mendapat update real-time saat HQ menginput pengiriman barang, agar saya bisa menyiapkan penerimaan barang. | P0 |
| US-04 | Sebagai Cabang Staff, saya ingin memvalidasi manual status "diterima" saat barang fisik sampai, agar catatan stok sistem sesuai kondisi nyata. | P0 |
| US-05 | Sebagai Cabang Staff, saya ingin mencatat dan mengedit jumlah "barang rusak" saat barang yang diterima tidak sesuai, agar selisih stok tercatat dan terlacak ke HQ. | P0 |
| US-06 | Sebagai Cabang Staff, saya ingin memilih produk dari stok yang diterima dan menambahkan harga jual, agar produk otomatis muncul di tabel live product. | P0 |
| US-07 | Sebagai Cabang Staff, saya ingin melihat tabel live product (nama, varian, quantity, harga modal, harga jual), agar saya tahu produk apa saja yang siap dijual dan marginnya. | P0 |
| US-08 | Sebagai Cabang Staff, saya ingin mencatat penjualan online dengan memilih platform (Shopee/Tiktok) dan produk yang terjual, agar stok dan omzet online tercatat di sistem yang sama. | P0 |
| US-09 | Sebagai Cabang Staff, saya ingin mencatat penjualan offline dengan input produk yang terjual, agar stok dan omzet offline tercatat otomatis. | P0 |
| US-10 | Sebagai Cabang Staff, saya ingin sistem menerbitkan struk PDF yang bisa diunduh setiap kali ada transaksi offline, agar saya bisa memberikan bukti pembelian ke customer. | P0 |
| US-11 | Sebagai HQ/Cabang Staff, saya ingin setiap transaksi penjualan (online/offline) otomatis mengurangi stok opname secara real-time, agar tidak ada input ganda dan stok selalu akurat. | P0 |
| US-12 | Sebagai HQ/Cabang Staff, saya ingin melihat riwayat pendapatan/omzet hasil rekap penjualan, agar saya bisa memantau performa penjualan per cabang atau konsolidasi. | P1 |
| US-13 | Sebagai HQ Admin, saya ingin melihat catatan keuangan (modal terpakai, omzet, margin) di level konsolidasi seluruh cabang, agar saya bisa mengambil keputusan bisnis berbasis data. | P1 |

---

### 6. Acceptance Criteria

**US-01 — Input master barang & harga modal**
- [ ] Given HQ Admin login ke sistem, when menambahkan barang baru dengan nama, varian, dan harga modal, then barang tersimpan di master data dan bisa dicari/difilter.
- [ ] Given barang sudah ada di master data, when HQ Admin mengedit harga modal, then perubahan tersimpan dan tercatat riwayat perubahannya (audit trail).

**US-02 — Catat pengiriman barang ke cabang**
- [ ] Given master barang sudah tersedia, when HQ Admin membuat pengiriman baru dan memilih cabang tujuan, nama barang, varian, quantity, dan harga, then data pengiriman tersimpan dengan status "Dikirim".
- [ ] Given pengiriman sudah dibuat, when HQ Admin melihat daftar pengiriman, then status tiap pengiriman (Dikirim/Diterima/Bermasalah) terlihat jelas per cabang.

**US-03 — Update real-time ke cabang**
- [ ] Given HQ Admin menyimpan data pengiriman baru, when Cabang Staff sedang membuka dashboard, then notifikasi/data pengiriman baru muncul tanpa perlu refresh manual dalam waktu < 5 detik.

**US-04 — Validasi penerimaan barang**
- [ ] Given barang fisik sudah sampai di cabang, when Cabang Staff menekan tombol "Konfirmasi Diterima" pada item pengiriman, then status berubah menjadi "Diterima" dan stok cabang otomatis bertambah sesuai quantity yang dikonfirmasi.
- [ ] Given Cabang Staff belum melakukan konfirmasi, then status tetap "Dikirim" dan stok cabang tidak bertambah (mencegah selisih pencatatan).

**US-05 — Catat barang rusak/tidak sesuai**
- [ ] Given proses validasi penerimaan sedang berlangsung, when Cabang Staff menemukan barang rusak/kurang, then Cabang Staff bisa input quantity "Barang Rusak" per item sebelum konfirmasi status diterima.
- [ ] Given quantity barang rusak sudah diinput, then jumlah tersebut dikecualikan dari stok layak jual namun tetap tercatat sebagai riwayat/laporan terpisah yang bisa dilihat HQ.

**US-06 & US-07 — Live product & harga jual**
- [ ] Given stok cabang sudah terisi (hasil validasi penerimaan), when Cabang Staff memilih produk dari stok dan input harga jual, then produk muncul di tabel Live Product dengan kolom Nama Barang, Varian, Quantity, Harga Modal, Harga Jual.
- [ ] Given harga jual sudah diinput, when Cabang Staff mengubah harga jual di kemudian hari, then perubahan langsung tercermin di tabel Live Product.

**US-08 & US-09 — Catat penjualan online & offline**
- [ ] Given ada produk di Live Product, when Cabang Staff membuat transaksi baru dan memilih channel "Online", then Cabang Staff wajib memilih platform (Shopee/Tiktok) sebelum input produk yang terjual dan quantity-nya.
- [ ] Given ada produk di Live Product, when Cabang Staff membuat transaksi baru dan memilih channel "Offline", then Cabang Staff input produk terjual dan quantity-nya tanpa perlu memilih platform.
- [ ] Given transaksi (online/offline) disimpan, then stok di tabel Live Product berkurang otomatis sesuai quantity terjual.

**US-10 — Struk PDF untuk transaksi offline**
- [ ] Given transaksi offline berhasil disimpan, when proses input selesai, then sistem otomatis membuat struk dalam format PDF berisi detail produk, quantity, harga jual, total, tanggal, dan nama cabang.
- [ ] Given struk PDF sudah dibuat, then Cabang Staff dapat mengunduh file tersebut langsung dari halaman transaksi.

**US-11 — Integrasi realtime dengan stok opname**
- [ ] Given transaksi penjualan (online/offline) tersimpan, then perubahan stok tercermin secara real-time di dashboard HQ dan Cabang tanpa proses sinkronisasi manual.

**US-12 & US-13 — Riwayat omzet & catatan keuangan**
- [ ] Given ada transaksi penjualan tersimpan, when Cabang Staff atau HQ Admin membuka halaman Riwayat Pendapatan, then data omzet ditampilkan per hari/minggu/bulan dan bisa difilter per channel (online/offline) dan per cabang.
- [ ] Given HQ Admin membuka dashboard konsolidasi, then total omzet, total modal terpakai, dan margin kotor seluruh cabang ditampilkan dalam satu tampilan.

---

### 7. Functional Requirements

| ID | Requirement | Story ref |
|---|---|---|
| FR-01 | Sistem harus menyediakan modul master data barang (nama, varian, harga modal) yang hanya bisa dikelola oleh role HQ. | US-01 |
| FR-02 | Sistem harus menyediakan modul pengiriman barang dari HQ ke cabang dengan field nama barang, varian, quantity, dan harga. | US-02 |
| FR-03 | Sistem harus mengirimkan update status pengiriman secara real-time (push/websocket) ke dashboard cabang terkait. | US-03 |
| FR-04 | Sistem harus menyediakan aksi konfirmasi penerimaan barang oleh cabang, yang mengubah status pengiriman dan menambah stok cabang. | US-04 |
| FR-05 | Sistem harus mengizinkan cabang menginput dan mengedit quantity "barang rusak" sebelum konfirmasi diterima final. | US-05 |
| FR-06 | Sistem harus menyediakan modul Live Product dengan kolom Nama Barang, Varian, Quantity, Harga Modal, Harga Jual, yang di-generate dari stok yang sudah divalidasi. | US-06, US-07 |
| FR-07 | Sistem harus menyediakan modul pencatatan transaksi dengan pilihan channel Online (dengan sub-pilihan platform Shopee/Tiktok) atau Offline. | US-08, US-09 |
| FR-08 | Sistem harus otomatis mengurangi quantity di Live Product setiap kali transaksi penjualan disimpan. | US-11 |
| FR-09 | Sistem harus otomatis membuat file struk berformat PDF untuk setiap transaksi offline, berisi minimal: nama cabang, tanggal/waktu, daftar produk, quantity, harga, dan total. | US-10 |
| FR-10 | Sistem harus menyediakan opsi unduh file struk PDF dari halaman detail transaksi. | US-10 |
| FR-11 | Sistem harus menyediakan halaman Riwayat Pendapatan/Omzet dengan filter tanggal, channel, dan cabang. | US-12 |
| FR-12 | Sistem harus menyediakan dashboard keuangan konsolidasi untuk role HQ (total modal, omzet, margin) lintas seluruh cabang. | US-13 |
| FR-13 | Sistem harus menerapkan role-based access: HQ (akses penuh semua cabang) dan Cabang (akses terbatas pada data cabangnya sendiri). | US-01–US-13 |

---

### 8. Non-Functional Requirements

| Category | Requirement | Threshold |
|---|---|---|
| Performance | Waktu respons update real-time dari HQ ke Cabang | < 5 detik |
| Performance | Waktu generate & tersedia unduh struk PDF | < 3 detik setelah transaksi disimpan |
| Availability | Uptime sistem (dipakai operasional harian toko) | 99.5% |
| Security | Autentikasi & otorisasi role-based (HQ vs Cabang) | Login wajib, session-based/JWT auth, akses data dibatasi per role & per cabang |
| Security | Audit trail perubahan data sensitif (harga modal, stok, barang rusak) | Semua perubahan tercatat dengan user, timestamp |
| Scalability | Jumlah cabang yang didukung pada fase awal | 1–10 cabang aktif bersamaan |
| Data integrity | Konsistensi stok saat transaksi bersamaan (concurrent sale) | Tidak boleh terjadi stok minus / race condition |
| Accessibility | Kompatibilitas browser dashboard | Browser modern (Chrome, Edge, Firefox versi 2 tahun terakhir) |

---

### 9. Success Metrics

| Metric | Type | Baseline | Target | Measurement method |
|---|---|---|---|---|
| Jumlah selisih stok tidak tercatat per bulan | Lagging | [NEEDS INPUT] — perlu data proses manual saat ini | Turun signifikan (target angka: [NEEDS INPUT]) | Perbandingan laporan "barang rusak" sistem vs catatan manual sebelumnya |
| Waktu rekonsiliasi stok & keuangan per periode | Lagging | [NEEDS INPUT] | Berkurang (target angka: [NEEDS INPUT]) | Timestamp mulai vs selesai proses rekonsiliasi bulanan HQ |
| Latency update stok real-time HQ↔Cabang | Leading | N/A (fitur baru) | < 5 detik | Log event websocket/notifikasi |
| Akurasi laporan omzet vs rekap manual/kasir | Leading | [NEEDS INPUT] | 100% konsisten antara sistem dan transaksi aktual | Sampling audit transaksi bulanan |

⚠️ Needs validation — baseline dan target angka spesifik belum tersedia, disarankan diambil dari data operasional 1–2 bulan terakhir sebelum development.

---

### 10. Dependencies and Risks

**Dependencies:**

| Dependency | Owner | Status | Notes |
|---|---|---|---|
| Library/service pembuatan PDF struk | Engineering | Pending | Perlu dipilih (server-side rendering, mis. template HTML→PDF) |
| Infrastruktur real-time (websocket/pub-sub) | Engineering | Pending | Diperlukan untuk update status pengiriman & stok real-time |
| Daftar resmi platform e-commerce yang didukung (saat ini: Shopee, Tiktok) | Product | Confirmed | Bersifat pilihan manual, bukan integrasi API |
| Struktur role & akun user per cabang | Product/Ops | Pending | Perlu kejelasan siapa yang membuat akun Cabang Staff |

**Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pencatatan penjualan online manual (tanpa integrasi API e-commerce) berpotensi human error atau telat input | Med | Med | Tambahkan validasi/reminder harian, evaluasi integrasi API di fase berikutnya |
| Race condition stok saat transaksi offline & online terjadi bersamaan | Low | High | Terapkan locking/transaction atomik di level database saat pengurangan stok |
| Cabang menunda konfirmasi penerimaan barang sehingga data stok HQ vs fisik tidak sinkron | Med | Med | Tambahkan notifikasi pengingat otomatis jika status "Dikirim" belum dikonfirmasi dalam X hari |
| Data harga modal terekspos ke role Cabang yang tidak seharusnya melihat margin | Med | High | Pastikan role-based access ketat: Cabang hanya lihat harga modal produknya sendiri, bukan detail margin bisnis HQ |

---

### 11. Open Questions

| # | Question | Owner | Due date | Status |
|---|---|---|---|---|
| OQ-01 | Apakah setiap cabang punya lebih dari satu akun staff (multi-user per cabang) dengan role berbeda (kasir vs admin cabang)? | Product | [NEEDS INPUT] | Open |
| OQ-02 | Apakah barang rusak yang dicatat cabang perlu alur approval dari HQ sebelum resmi mengurangi nilai aset, atau cukup tercatat sebagai laporan? | Product | [NEEDS INPUT] | Open |
| OQ-03 | Apakah diperlukan nomor struk unik/berurutan per cabang untuk keperluan akuntansi? | Product/Finance | [NEEDS INPUT] | Open |
| OQ-04 | Apakah harga jual bisa berbeda antar cabang untuk produk yang sama, atau harus seragam dari HQ? | Product | [NEEDS INPUT] | Open |
| OQ-05 | Apakah dibutuhkan retur/pembatalan transaksi (online/offline) dan bagaimana efeknya ke stok dan struk yang sudah diterbitkan? | Product | [NEEDS INPUT] | Open |
| OQ-06 | Apakah integrasi API langsung dengan Shopee/Tiktok direncanakan di roadmap berikutnya? | Product | [NEEDS INPUT] | Open |

---

### 12. Rollout Plan

- **Rollout strategy**: Beta/pilot terbatas — mulai dari 1–2 cabang percontohan sebelum diperluas ke seluruh cabang (1–10).
- **Target audience for initial release**: 1–2 cabang dengan volume transaksi menengah (bukan tersibuk/tersepi) untuk validasi alur end-to-end.
- **Rollback criteria**: Selisih stok sistem vs fisik melebihi ambang batas yang disepakati, atau kegagalan generate struk PDF terjadi berulang (>5% transaksi offline gagal).
- **Launch checklist items**: Uji alur penuh (input barang HQ → kirim → validasi cabang → live product → transaksi → struk PDF → riwayat omzet); pelatihan singkat untuk staff cabang pilot; verifikasi role-based access; load test skenario transaksi bersamaan; audit trail berfungsi.

---

### 13. Appendix

- Brief awal dari user (ringkasan alur HQ → Cabang → Penjualan → Struk → Riwayat Omzet) — sumber utama requirement dokumen ini.
- Referensi desain/teknis (schema database, API contract, pilihan tech stack real-time) akan disusun terpisah di technical design doc.

---

## Catatan Kelengkapan (Confidence Note)

PRD ini disusun berdasarkan brief yang cukup detail dari pemilik produk untuk alur fungsional utama (US-01 s.d. US-13), sehingga acceptance criteria dan functional requirements untuk P0 items relatif solid. Namun beberapa area masih memerlukan input lebih lanjut sebelum development dimulai, ditandai `[NEEDS INPUT]` dan `⚠️ Needs validation`, terutama:
- Baseline & target angka kuantitatif untuk success metrics (Section 9).
- Keputusan bisnis terkait approval barang rusak, retur transaksi, dan konsistensi harga jual antar cabang (Section 11).
- Timeline rilis dan pemilik dokumen (Section 1).

Status dokumen: **Draft — perlu review** sebelum dianggap final untuk mulai development.
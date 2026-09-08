// Backfill TransactionCounter rows from existing SalesTransaction numbers.
// Run once after deploying the TransactionCounter model:
//   node scripts/backfill-transaction-counters.mjs
// Seeds lastNumber = max numeric suffix already used per branch per date, so
// new invoices never reuse a number that already exists (even after deletions).
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const transactions = await p.salesTransaction.findMany({
    select: { id: true, branchId: true, transactionNumber: true },
  });

  const byBranchDate = new Map(); // `${branchId}|${date}` -> { branchId, date, maxSeq, count }

  for (const tx of transactions) {
    const parts = tx.transactionNumber.split("/");
    if (parts.length < 4) {
      console.log(`SKIP unparsable number: ${tx.transactionNumber}`);
      continue;
    }
    const date = parts[2];
    const seq = Number(parts[3]);
    if (!/^\d{8}$/.test(date) || !Number.isInteger(seq) || seq <= 0) {
      console.log(`SKIP unparsable number: ${tx.transactionNumber}`);
      continue;
    }

    const key = `${tx.branchId}|${date}`;
    const entry = byBranchDate.get(key) || { branchId: tx.branchId, date, maxSeq: 0, count: 0 };
    entry.maxSeq = Math.max(entry.maxSeq, seq);
    entry.count += 1;
    byBranchDate.set(key, entry);
  }

  if (byBranchDate.size === 0) {
    console.log("No transactions found. Nothing to backfill.");
    await p.$disconnect();
    return;
  }

  const duplicates = await p.salesTransaction.groupBy({
    by: ["transactionNumber"],
    _count: true,
    _max: { createdAt: true },
    having: { transactionNumber: { _count: { gt: 1 } } },
    orderBy: { _count: { transactionNumber: "desc" } },
  });
  if (duplicates.length > 0) {
    console.log(`WARNING: ${duplicates.length} transactionNumber value(s) are already duplicated in DB:`);
    for (const d of duplicates) {
      console.log(`  ${d.transactionNumber} (${d._count}x, last ${d._max.createdAt})`);
    }
  } else {
    console.log("No duplicated transaction numbers found.");
  }

  let seeded = 0;
  let updated = 0;
  let present = 0;

  for (const entry of byBranchDate.values()) {
    const existingRow = await p.transactionCounter.findUnique({
      where: { branchId_date: { branchId: entry.branchId, date: entry.date } },
    });
    if (existingRow) {
      if (entry.maxSeq > existingRow.lastNumber) {
        await p.transactionCounter.update({
          where: { id: existingRow.id },
          data: { lastNumber: entry.maxSeq },
        });
        updated += 1;
        console.log(`UPDATE ${entry.branchId} ${entry.date} -> ${entry.maxSeq} (${entry.count} txns)`);
      } else {
        present += 1;
      }
    } else {
      await p.transactionCounter.create({
        data: { branchId: entry.branchId, date: entry.date, lastNumber: entry.maxSeq },
      });
      seeded += 1;
      console.log(`CREATE ${entry.branchId} ${entry.date} -> ${entry.maxSeq} (${entry.count} txns)`);
    }
  }

  console.log(`Backfill done. Created ${seeded}, updated ${updated}, already present ${present}.`);
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
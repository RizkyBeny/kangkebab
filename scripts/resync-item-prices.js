const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();

async function main() {
  const products = await p.masterProduct.findMany({
    select: { id: true, offlineSellingPrice: true, shopeeSellingPrice: true, tiktokSellingPrice: true },
  });
  const pmap = new Map(products.map((x) => [x.id, x]));

  const items = await p.salesTransactionItem.findMany({
    include: {
      transaction: { select: { id: true, transactionNumber: true, channel: true, platform: true } },
    },
  });

  let changedItems = 0;
  const offlineTxTotals = new Map();

  for (const it of items) {
    const mp = pmap.get(it.masterProductId);
    if (!mp) {
      console.log("MISSING PRODUCT for item", it.id, "-> skipped");
      continue;
    }

    const channel = (it.transaction.channel || "").toUpperCase().trim();
    const platform = (it.transaction.platform || "").toUpperCase().trim();

    let newPrice;
    if (channel === "ONLINE" && platform === "SHOPEE") {
      newPrice = mp.shopeeSellingPrice;
    } else if (channel === "ONLINE" && platform === "TIKTOK") {
      newPrice = mp.tiktokSellingPrice;
    } else if (channel === "OFFLINE") {
      newPrice = mp.offlineSellingPrice;
    } else {
      console.log(
        `UNKNOWN channel/platform ${channel}/${platform} on ${it.transaction.transactionNumber} (item ${it.id}) -> skipped`
      );
      continue;
    }

    if (newPrice !== it.sellingPrice) {
      await p.salesTransactionItem.updateMany({ where: { id: it.id }, data: { sellingPrice: newPrice } });
      changedItems += 1;
      console.log(
        `item ${it.id} (${it.transaction.transactionNumber}) price ${it.sellingPrice} -> ${newPrice} (${channel} ${platform})`
      );
    }

    if (channel === "OFFLINE") {
      const cur = offlineTxTotals.get(it.transaction.id) || 0;
      offlineTxTotals.set(it.transaction.id, cur + newPrice * it.qty);
    }
  }

  console.log("\nItems updated:", changedItems);

  for (const [txId, total] of offlineTxTotals) {
    await p.salesTransaction.updateMany({ where: { id: txId }, data: { totalAmount: total } });
    console.log("OFFLINE transaction total recomputed ->", total, "(tx", txId + ")");
  }
  if (offlineTxTotals.size === 0) console.log("No OFFLINE transactions; online totals left untouched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
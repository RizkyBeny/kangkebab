import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial database data for Cabang Madiun & HQ...');

  // Reset existing branches/users if needed or clean up non-Madiun branches
  await prisma.salesTransactionItem.deleteMany();
  await prisma.salesTransaction.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.branchInventory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  // 1. Create Branches
  const hqBranch = await prisma.branch.create({
    data: {
      code: 'HQ',
      name: 'Kantor Pusat HQ (Operations)',
      address: 'Jl. Sudirman No. 1, Jakarta Pusat',
    },
  });

  const branchMdn = await prisma.branch.create({
    data: {
      code: 'CBG-MDN',
      name: 'Cabang Madiun',
      address: 'Jl. Pahlawan No. 25, Madiun',
    },
  });

  // 2. Create Initial Users
  await prisma.user.create({
    data: {
      name: 'Budi (HQ Manager)',
      email: 'admin@kangkebab.com',
      password: 'admin123',
      role: 'HQ_ADMIN',
      branchId: hqBranch.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Siti (Kasir Madiun)',
      email: 'staff.madiun@kangkebab.com',
      password: 'staff123',
      role: 'CABANG_STAFF',
      branchId: branchMdn.id,
    },
  });

  // 3. Create Master Products
  const products = [
    {
      sku: 'KB-OR-SM',
      name: 'Kebab Original Beef',
      variant: 'Small',
      costPrice: 8000,
      offlineSellingPrice: 15000,
      onlineSellingPrice: 17000,
    },
    {
      sku: 'KB-OR-LG',
      name: 'Kebab Original Beef',
      variant: 'Large',
      costPrice: 14000,
      offlineSellingPrice: 25000,
      onlineSellingPrice: 28000,
    },
    {
      sku: 'KB-CH-SM',
      name: 'Kebab Cheese Supreme',
      variant: 'Small',
      costPrice: 10000,
      offlineSellingPrice: 18000,
      onlineSellingPrice: 20000,
    },
    {
      sku: 'KB-CH-LG',
      name: 'Kebab Cheese Supreme',
      variant: 'Large',
      costPrice: 16000,
      offlineSellingPrice: 29000,
      onlineSellingPrice: 32000,
    },
    {
      sku: 'KB-SP-LG',
      name: 'Kebab Spicy Mozzarella',
      variant: 'Large',
      costPrice: 18000,
      offlineSellingPrice: 32000,
      onlineSellingPrice: 35000,
    },
  ];

  for (const prod of products) {
    await prisma.masterProduct.upsert({
      where: { sku: prod.sku },
      update: prod,
      create: prod,
    });
  }

  console.log('Seed for Cabang Madiun completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

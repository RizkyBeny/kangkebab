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
  await prisma.masterProduct.deleteMany();

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

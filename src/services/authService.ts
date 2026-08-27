import { prisma } from '@/lib/prisma';
import { User, Branch } from '@/types';

export async function getAllUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    include: {
      branch: true,
    },
    orderBy: { name: 'asc' },
  });
  return users as unknown as User[];
}

export async function getAllBranches(): Promise<Branch[]> {
  const branches = await prisma.branch.findMany({
    orderBy: { code: 'asc' },
  });
  return branches as unknown as Branch[];
}

export async function getUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { branch: true },
  });
  return (user as unknown as User) || null;
}

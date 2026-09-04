# KangKebab — Multichannel Stock & POS System

Real-time multi-channel stock management and Point-of-Sale system for KangKebab, supporting Head Quarter (HQ) operations and branch-level POS across multiple locations.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma
- **UI:** shadcn/ui + Tailwind CSS v4
- **Realtime:** Server-Sent Events (SSE)

## Getting Started

```bash
npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma db seed` | Seed database |

export function Footer() {
  return (
    <footer className="flex flex-col gap-1 border-t border-border bg-background px-6 py-4 text-center text-xs text-muted-foreground">
      <span className="font-medium">KangKebab Multichannel System &copy; 2026</span>
      <span className="text-[11px]">Built with Next.js, Prisma, PostgreSQL &amp; SSE Realtime</span>
    </footer>
  );
}
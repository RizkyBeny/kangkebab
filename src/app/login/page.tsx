'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Lock, Mail, ShieldCheck, Store, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const result = await login(email, password);
    if (result.success) {
      router.push('/');
    } else {
      setErrorMsg(result.error || 'Email atau password tidak sesuai. Silakan periksa kembali.');
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSubmitting(true);
    setErrorMsg('');

    const result = await login(demoEmail, demoPass);
    if (result.success) {
      router.push('/');
    } else {
      setErrorMsg(result.error || 'Email atau password tidak sesuai. Silakan periksa kembali.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl shadow-primary/5 border-border/50 bg-card/90 backdrop-blur-xl relative z-10">
        <CardHeader className="text-center space-y-2 pt-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-primary/20 mb-2">
            KK
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">KangKebab POS</CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground">Sistem Stock Opname &amp; POS Realtime</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
              <AlertDescription className="font-medium text-xs">
                {errorMsg}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/80">Email Akses</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="nama@kangkebab.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-5 text-xs bg-background/50 focus-visible:bg-background border-border/50 transition-all focus-visible:ring-primary/30 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/80">Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 py-5 text-xs bg-background/50 focus-visible:bg-background border-border/50 transition-all focus-visible:ring-primary/30 shadow-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-xs font-bold shadow-lg shadow-primary/20 mt-4 transition-all hover:translate-y-[-2px]"
            >
              {submitting ? 'Memproses Login...' : 'Masuk Ke Dashboard'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col border-t border-border/50 pt-6 bg-muted/20 rounded-b-xl">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center flex items-center justify-center gap-1 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Akses Cepat Akun Demo
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleQuickDemoLogin('admin@kangkebab.com', 'admin123')}
              className="h-auto p-3 justify-start bg-background/50 hover:bg-background border-border/50 hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  <span>HQ Admin</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">Pusat &amp; Finansial</div>
              </div>
            </Button>

            <Button
              variant="outline"
              type="button"
              onClick={() => handleQuickDemoLogin('staff.madiun@kangkebab.com', 'staff123')}
              className="h-auto p-3 justify-start bg-background/50 hover:bg-background border-border/50 hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
                  <Store className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Kasir Madiun</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">Cabang Madiun</div>
              </div>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

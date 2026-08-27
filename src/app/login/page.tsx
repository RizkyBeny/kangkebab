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

    const success = await login(email, password);
    if (success) {
      router.push('/');
    } else {
      setErrorMsg('Email atau password tidak sesuai. Silakan periksa kembali.');
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSubmitting(true);
    setErrorMsg('');

    const success = await login(demoEmail, demoPass);
    if (success) {
      router.push('/');
    } else {
      setErrorMsg('Gagal login akun demo');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-slate-200">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl mx-auto shadow-md mb-2">
            KK
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">KangKebab POS</CardTitle>
          <CardDescription className="text-xs font-medium">Sistem Stock Opname &amp; POS Realtime Multichannel</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription className="font-medium text-xs">
                {errorMsg}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold">Email Akses</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="nama@kangkebab.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-5 text-xs bg-slate-50 focus-visible:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 py-5 text-xs bg-slate-50 focus-visible:bg-white transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-xs font-bold shadow-md mt-2"
            >
              {submitting ? 'Memproses Login...' : 'Masuk Ke Dashboard'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col border-t border-slate-100 pt-6">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center flex items-center justify-center gap-1 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Akses Cepat Akun Demo
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full">
            <Button
              variant="outline"
              onClick={() => handleQuickDemoLogin('admin@kangkebab.com', 'admin123')}
              className="h-auto p-3 justify-start bg-slate-50 hover:bg-slate-100 transition-all"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>HQ Admin</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal">Pusat &amp; Financials</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleQuickDemoLogin('staff.madiun@kangkebab.com', 'staff123')}
              className="h-auto p-3 justify-start bg-slate-50 hover:bg-slate-100 transition-all"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kasir Madiun</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal">Cabang Madiun POS</div>
              </div>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

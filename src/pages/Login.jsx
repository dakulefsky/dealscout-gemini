import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { auth, setToken } from '@/lib/api';
import { safeReturnTo } from '@/lib/authReturnTo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const returnTo = safeReturnTo();

  useEffect(() => {
    document.title = 'DealScout Admin';
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex,nofollow');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await auth.login(email, password);
      if (res?.user?.role !== 'admin') throw new Error('Admin access required');
      setToken(res.access_token);
      window.location.href = returnTo.startsWith('/admin') ? returnTo : '/admin';
    } catch (err) {
      setToken(null);
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your admin email first');
      return;
    }

    setResetSending(true);
    try {
      await auth.forgotPassword(email);
      setNotice('If that admin email exists, a password reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Could not request a reset link');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <AuthLayout icon={ShieldCheck} title="DealScout Admin" subtitle="Private administration access">
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {notice && <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm" role="status">{notice}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || resetSending}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : 'Sign in'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={handleForgotPassword} disabled={loading || resetSending}>
          {resetSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending reset link...</> : 'Forgot password?'}
        </Button>
      </form>
    </AuthLayout>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { auth, setToken } from '@/lib/api';
import { safeReturnTo } from '@/lib/authReturnTo';

export default function Register() {
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [otpCode, setOtpCode]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const returnTo = safeReturnTo();

  const [devCode, setDevCode]   = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await auth.register(email, password);
      if (res?.otpCode) {
        setDevCode(res.otpCode);
        setOtpCode(res.otpCode);
      }
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auth.verifyOtp(email, otpCode);
      setToken(res.access_token);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await auth.resendOtp(email);
      if (res?.otpCode) {
        setDevCode(res.otpCode);
        setOtpCode(res.otpCode);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (step === 'otp') {
    return (
      <AuthLayout icon={CheckCircle2} title="Check your email" subtitle={`Enter the 6-digit code sent to ${email}.`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        {devCode && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <span>Demo verification code: <strong className="font-mono text-sm">{devCode}</strong></span>
            <button
              type="button"
              onClick={() => setOtpCode(devCode)}
              className="text-emerald-700 font-bold underline text-xs"
            >
              Fill code
            </button>
          </div>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="h-12 text-center text-2xl tracking-widest" required />
          </div>
          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Verify email'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Didn't receive it?{' '}
          <button type="button" onClick={handleResend} className="text-primary font-medium hover:underline">Resend code</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Start finding deals today"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" placeholder="At least 6 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="confirm" type="password" placeholder="Repeat your password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

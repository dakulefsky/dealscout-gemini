import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { auth } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [done, setDone]     = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await auth.forgotPassword(email);
      if (res?.resetToken) {
        setResetToken(res.resetToken);
      }
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout icon={CheckCircle2} title="Check your email" subtitle="If that address is registered, a password reset link has been issued.">
        {resetToken && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
            <p className="text-xs text-emerald-800 font-semibold">Demo Password Reset Link:</p>
            <Link
              to={`/reset-password?token=${resetToken}`}
              className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
            >
              Reset Password Now →
            </Link>
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center">
          <Link to="/login" className="text-primary font-medium hover:underline">Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={KeyRound}
      title="Forgot your password?"
      subtitle="Enter your email and we'll send a reset link."
      footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to log in</Link>}
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}

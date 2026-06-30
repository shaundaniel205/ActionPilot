'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers';
import { AuthLayout } from '../components/layouts';
import { 
  Sparkles, 
  ArrowRight, 
  CheckSquare, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Zap, 
  ShieldAlert,
  Loader2
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, signInWithEmail, signUpWithEmail, mockMode, toggleMockMode, isLoading, error } = useAuth();
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (!email || !password) {
      setAuthError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        if (!mockMode) {
          setAuthError('Check your email for confirmation link!');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxLaunch = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      // Toggle to mock mode and log in with default sandbox user
      toggleMockMode(true);
      await signInWithEmail('sandbox@actionpilot.local', 'password123');
    } catch (err: any) {
      setAuthError('Failed to launch sandbox.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-100 min-h-screen">
        <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm tracking-wide">Syncing session state...</p>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden min-h-screen">
      
      {/* Background Gradient Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-sky-900/10 blur-[150px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-24 flex-1 flex flex-col md:flex-row items-center justify-between gap-12 z-10 w-full">
        
        {/* Left Side: Product Branding & Features */}
        <div className="flex-1 text-left space-y-6 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" /> Core Product Engine Ready
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Take Control of Your Schedule with <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">ActionPilot</span>
          </h1>
          
          <p className="text-slate-400 text-lg leading-relaxed">
            The AI-inspired productivity companion that organizes your day, calculates deadline risks, and adjusts dynamically when you fall behind.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Rule-Based Scheduling</h3>
                <p className="text-xs text-slate-400 mt-0.5">Auto-maps tasks to daily 9-5 work hours, skipping weekends.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Deadline Risk Analysis</h3>
                <p className="text-xs text-slate-400 mt-0.5">Identifies tasks that risk missing their deadlines immediately.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">&quot;I&apos;m Behind&quot; Recalculation</h3>
                <p className="text-xs text-slate-400 mt-0.5">Compresses tasks and shifts schedules dynamically with one click.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Productivity Recommendations</h3>
                <p className="text-xs text-slate-400 mt-0.5">Generates rule-based optimization tips for your focus blocks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Box */}
        <div className="w-full max-w-md shrink-0">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-slate-100 text-center mb-6">
              {isLogin ? 'Welcome Back' : 'Create an Account'}
            </h2>

            {/* Error alerts */}
            {(authError || error) && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {authError || error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email Address
                </label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com" 
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-600 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Password
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-600 outline-none transition"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 font-semibold text-white py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 hover:shadow-sky-500/10 transition duration-200 mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Sign Up'} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Login/Signup */}
            <div className="mt-4 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-sky-400 transition"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/60 px-2 text-slate-500">Or Run Locally</span>
              </div>
            </div>

            {/* Sandbox Quick Access */}
            <div className="space-y-3">
              <button 
                onClick={handleSandboxLaunch}
                disabled={loading}
                className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition duration-200"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                Launch Demo Sandbox
              </button>
              <p className="text-[10px] text-center text-slate-500 leading-normal px-2">
                Instantly runs the app using local SQLite. No database connection required. Recommended for immediate testing.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="z-10 py-6 border-t border-slate-900 text-center text-xs text-slate-600 mt-auto">
        ActionPilot &copy; {new Date().getFullYear()} — Made with Next.js, FastAPI & Supabase
      </footer>
    </div>
    </AuthLayout>
  );
}

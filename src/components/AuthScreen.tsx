import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase.ts';
import { AppSettings } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, AlertTriangle, Coins, Sparkles, LogIn, UserPlus, CheckCircle, Loader, XCircle } from 'lucide-react';

interface AuthScreenProps {
  onMockLogin: (role: string, email: string, name: string) => void;
  isLoading: boolean;
  errorMsg: string | null;
  settings: AppSettings;
}

type EmpIdStatus = 'idle' | 'checking' | 'valid' | 'not_found' | 'already_claimed' | 'error';

export default function AuthScreen({ onMockLogin, isLoading, errorMsg, settings }: AuthScreenProps) {
  const [selectedMockRole, setSelectedMockRole] = useState('System Admin');
  const [mockEmail, setMockEmail] = useState('admin@coop.local');
  const [mockName, setMockName] = useState('SysAdmin Jack');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Employee ID validation state (registration only)
  const [employeeId, setEmployeeId] = useState('');
  const [empIdStatus, setEmpIdStatus] = useState<EmpIdStatus>('idle');
  const [empIdFullName, setEmpIdFullName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate employee ID with debounce as user types
  useEffect(() => {
    if (!isRegistering) return;
    const id = employeeId.trim();
    if (!id) { setEmpIdStatus('idle'); setEmpIdFullName(''); return; }

    setEmpIdStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-employee-id/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.found) {
          setEmpIdStatus('valid');
          setEmpIdFullName(data.fullName || '');
        } else {
          setEmpIdStatus(data.reason === 'already_claimed' ? 'already_claimed' : 'not_found');
          setEmpIdFullName('');
        }
      } catch {
        setEmpIdStatus('error');
      }
    }, 500);
  }, [employeeId, isRegistering]);

  const handleSwitchMode = () => {
    setIsRegistering(v => !v);
    setLocalError(null);
    setEmployeeId('');
    setEmpIdStatus('idle');
    setEmpIdFullName('');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (isRegistering && empIdStatus !== 'valid') {
      setLocalError('Please enter a valid Employee ID before registering.');
      return;
    }

    setAuthActionLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLocalError('Supabase credentials undefined. Add environment keys or use the Developer Playground below.');
      setAuthActionLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Create pending stub with employee ID so admin can immediately identify this person
        try {
          const preRes = await fetch('/api/users/pre-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, employeeId: employeeId.trim() }),
          });
          if (!preRes.ok) {
            const preErr = await preRes.json();
            throw new Error(preErr.error || 'Pre-registration failed.');
          }
        } catch (preErr: any) {
          // If the stub creation fails, still continue — user can log in later
          console.warn('Pre-register stub failed:', preErr.message);
        }

        alert(`Registration submitted! Your account as ${empIdFullName} is pending approval by a System Admin.`);
        setIsRegistering(false);
        setEmployeeId('');
        setEmpIdStatus('idle');
        setEmpIdFullName('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed.');
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleMockRoleChange = (role: string) => {
    setSelectedMockRole(role);
    switch (role) {
      case 'System Admin':    setMockEmail('admin@coop.local');              setMockName('SysAdmin Jack');     break;
      case 'Manager':         setMockEmail('manager@coop.local');            setMockName('Manager Sarah');     break;
      case 'Accounting Officer': setMockEmail('accountant@coop.local');      setMockName('Controller Clara');  break;
      case 'Cashier':         setMockEmail('cashier@coop.local');            setMockName('Teller Tom');        break;
      case 'Auditor':         setMockEmail('auditor@coop.local');            setMockName('Auditor Arthur');    break;
      case 'Member':          setMockEmail('alan.clintantone1921@gmail.com'); setMockName('Alice Cooper');     break;
    }
  };

  const empIdHint = () => {
    switch (empIdStatus) {
      case 'checking':     return <span className="flex items-center gap-1 text-neutral-400"><Loader className="w-3 h-3 animate-spin" />Checking...</span>;
      case 'valid':        return <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3 h-3" />Found: <strong>{empIdFullName}</strong></span>;
      case 'not_found':    return <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />Employee ID not found in roster</span>;
      case 'already_claimed': return <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />This Employee ID is already registered</span>;
      case 'error':        return <span className="text-red-400">Could not verify — try again</span>;
      default:             return null;
    }
  };

  const canSubmitRegistration = empIdStatus === 'valid' && email && password.length >= 6;

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-neutral-900 selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative bg-white border border-neutral-200/80 rounded-xl shadow-xl shadow-neutral-200/50 overflow-hidden"
      >
        <div className="px-6 pt-8 pb-4 text-center border-b border-neutral-100 bg-neutral-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={settings.logoUrl || 'no-logo'}
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-white text-white rounded-full mb-3 overflow-hidden border border-neutral-100 shadow-sm"
            >
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                : <Coins className="w-6 h-6 shrink-0" />
              }
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.h1
              key={settings.appName || '__loading__'}
              initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="text-xl font-medium tracking-tight text-neutral-900 font-sans"
            >
              {settings.appName || <span className="inline-block w-36 h-5 bg-neutral-200 rounded animate-pulse" />}
            </motion.h1>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={settings.appSubtitle || '__loading__'}
              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-xs text-neutral-500 mt-1"
            >
              {settings.appSubtitle || <span className="inline-block w-48 h-3 bg-neutral-100 rounded animate-pulse" />}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="p-6 space-y-6">
          {(errorMsg || localError) && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{localError || errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              {isRegistering ? 'Create Account' : 'Secure Login'}
            </h2>

            {isRegistering && (
              <>
                <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-lg leading-relaxed">
                  <span className="font-semibold block mb-0.5">Employee ID Required</span>
                  Enter your Employee ID to verify your identity. Your account will be visible to the admin for approval once submitted.
                </div>

                <div className="space-y-1">
                  <input
                    type="text"
                    className={`w-full text-xs p-2.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-black bg-white text-neutral-850 ${
                      empIdStatus === 'valid' ? 'border-emerald-300 bg-emerald-50/30' :
                      empIdStatus === 'not_found' || empIdStatus === 'already_claimed' ? 'border-red-300' :
                      'border-neutral-200'
                    }`}
                    placeholder="Enter your Employee ID"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    required
                  />
                  <div className="text-[11px] px-0.5">{empIdHint()}</div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <input
                type="email"
                className="w-full text-xs p-2.5 border border-neutral-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-neutral-850"
                placeholder="Enter email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="w-full text-xs p-2.5 border border-neutral-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-neutral-850"
                placeholder="Password (minimum 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={authActionLoading || (isRegistering && !canSubmitRegistration)}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-300 text-white font-medium text-xs py-2.5 rounded-lg shadow transition-all cursor-pointer"
            >
              {isRegistering ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {authActionLoading ? 'Processing...' : isRegistering ? 'Register Account' : 'Authenticate'}
            </button>

            <div className="text-center pt-1">
              <button type="button" onClick={handleSwitchMode}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium underline cursor-pointer">
                {isRegistering ? 'Already have an account? Sign In' : 'New employee? Register here'}
              </button>
            </div>
          </form>

        </div>

        <div className="bg-neutral-50 border-t border-neutral-100 px-6 py-4 flex items-center justify-between text-[10px] text-neutral-400">
          <span>Development - HC Koop</span>
          <span className="font-mono text-[9px]">v1.0.0 (PostgreSQL Mode)</span>
        </div>
      </motion.div>
    </div>
  );
}

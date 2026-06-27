import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from './lib/supabase.ts';
import { User, AppSettings } from './types.ts';
import { safeReadJson } from './lib/safe-fetch.ts';
import AuthScreen from './components/AuthScreen.tsx';
import Sidebar from './components/Sidebar.tsx';
import MembersModule from './components/MembersModule.tsx';
import TransactionsModule from './components/TransactionsModule.tsx';
import ReportsModule from './components/ReportsModule.tsx';
import MemberPortal from './components/MemberPortal.tsx';
import UsersModule from './components/UsersModule.tsx';
import ProfileModule from './components/ProfileModule.tsx';
import SettingsModule from './components/SettingsModule.tsx';
import LoanApplicationsModule from './components/LoanApplicationsModule.tsx';
import { AlertTriangle, KeyRound, Loader, ShieldCheck, Menu, CheckCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('members');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['members']));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Password recovery state — set when Supabase fires PASSWORD_RECOVERY event
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetConfirmPw, setResetConfirmPw] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const navigateTo = (tab: string) => {
    setMountedTabs(prev => new Set([...prev, tab]));
    setActiveTab(tab);
  };
  const SETTINGS_CACHE_KEY = 'coop_settings';

  const parseCachedSettings = (): AppSettings => {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      appName: '', appSubtitle: '', currencySymbol: '$', requireEmployeeId: false,
      logoUrl: '', motto: '', mission: '', vision: '',
      address: '', contactEmail: '', contactPhone: '', establishedYear: '',
    };
  };

  const applyBranding = (s: AppSettings) => {
    if (s.appName) document.title = s.appName;
    if (!s.logoUrl) return;
    // Draw a circular version of the logo onto a canvas and use it as the favicon
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, size, size);
      const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
      if (favicon) favicon.href = canvas.toDataURL('image/png');
    };
    img.src = s.logoUrl;
  };

  const cachedSettings = parseCachedSettings();
  applyBranding(cachedSettings);
  const [settings, setSettings] = useState<AppSettings>(cachedSettings);

  useEffect(() => {
    // 0. Fetch app settings — update cache so next load is instant
    fetch('/api/settings').then(r => r.json()).then(data => {
      const fresh: AppSettings = {
        appName: data.app_name || '',
        appSubtitle: data.app_subtitle || '',
        currencySymbol: data.currency_symbol || '$',
        requireEmployeeId: data.requireEmployeeId === 'true',
        logoUrl: data.logo_url || '',
        motto: data.motto || '',
        mission: data.mission || '',
        vision: data.vision || '',
        address: data.address || '',
        contactEmail: data.contact_email || '',
        contactPhone: data.contact_phone || '',
        establishedYear: data.established_year || '',
      };
      setSettings(fresh);
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(fresh));
      applyBranding(fresh);
    }).catch(() => {});

    // 1. Recover any active mock or real sessions from localStorage on application start
    const savedToken = localStorage.getItem('coop_authToken');
    const savedUser = localStorage.getItem('coop_currentUser');

    if (savedToken && savedUser) {
      setAuthToken(savedToken);
      try {
        const parsedUser = JSON.parse(savedUser);
        setCurrentUser(parsedUser);
        if (parsedUser.role === 'Member') {
          navigateTo('portal');
        } else {
          navigateTo('members');
        }
      } catch (e) {
        console.error("Local storage recovery failed:", e);
      }
    }

    // 2. Initialize Supabase Client Listener
    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Active session — use the fresh token (may differ from localStorage)
          handleAuthenticSession(session.access_token);
        } else if (savedToken && !savedToken.startsWith('mock-token-')) {
          // Real token in localStorage but no active Supabase session — it's expired, clear it
          localStorage.removeItem('coop_authToken');
          localStorage.removeItem('coop_currentUser');
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      });

      const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked a password-reset link — show the reset form, don't log them in yet
          setShowPasswordReset(true);
          setIsLoading(false);
          return;
        }
        if (session) {
          if (event === 'SIGNED_IN') {
            // Only do full auth flow for genuine new sign-ins (no existing session)
            const existing = localStorage.getItem('coop_authToken');
            if (!existing || existing.startsWith('mock-token-')) {
              handleAuthenticSession(session.access_token);
            } else {
              // Already logged in — silently update token
              setAuthToken(session.access_token);
              localStorage.setItem('coop_authToken', session.access_token);
            }
          } else if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            // Silently swap token — never show the loading spinner for these
            setAuthToken(session.access_token);
            localStorage.setItem('coop_authToken', session.access_token);
          }
        } else if (event === 'SIGNED_OUT') {
          const currentToken = localStorage.getItem('coop_authToken');
          if (currentToken && !currentToken.startsWith('mock-token-')) {
            handleLogout();
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleAuthenticSession = async (token: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (!token) {
        throw new Error('Verification session contains an empty token payload.');
      }

      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        let errorMsg = 'Identity mapping handshake failed.';
        try {
          const err = await safeReadJson(res);
          errorMsg = err.error || errorMsg;
        } catch (e: any) {
          errorMsg = e.message || errorMsg;
        }
        throw new Error(errorMsg);
      }

      let syncUser = await safeReadJson(res);

      setCurrentUser(syncUser);
      setAuthToken(token);

      localStorage.setItem('coop_authToken', token);
      localStorage.setItem('coop_currentUser', JSON.stringify(syncUser));

      if (syncUser.role === 'Member') {
        navigateTo('portal');
      } else {
        navigateTo('members');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Identity synchronization handshake failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockLogin = async (role: string, email: string, name: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    // Encode name safely
    const encName = encodeURIComponent(name);
    // Custom mock-token format
    const mockToken = `mock-token-${role}|${email}|${encName}`;

    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${mockToken}` }
      });

      if (!res.ok) {
        let errorMsg = 'Development bypass registration failed.';
        try {
          const err = await safeReadJson(res);
          errorMsg = err.error || errorMsg;
        } catch (e: any) {
          errorMsg = e.message || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const syncUser = await safeReadJson(res);

      setCurrentUser(syncUser);
      setAuthToken(mockToken);

      localStorage.setItem('coop_authToken', mockToken);
      localStorage.setItem('coop_currentUser', JSON.stringify(syncUser));

      if (syncUser.role === 'Member') {
        navigateTo('portal');
      } else {
        navigateTo('members');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Local bypass connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = (token: string, user: User) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('coop_authToken', token);
    localStorage.setItem('coop_currentUser', JSON.stringify(user));
    if (user.role === 'Member') navigateTo('portal');
    else navigateTo('members');
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error(e);
    }

    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem('coop_authToken');
    localStorage.removeItem('coop_currentUser');
    setIsLoading(false);
  };

  const handlePasswordReset = async () => {
    setResetError(null);
    if (resetNewPw !== resetConfirmPw) { setResetError('Passwords do not match.'); return; }
    if (resetNewPw.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
    setResetLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured.');
      const { error } = await supabase.auth.updateUser({ password: resetNewPw });
      if (error) throw error;
      setResetDone(true);
      setTimeout(() => {
        setShowPasswordReset(false);
        setResetDone(false);
        setResetNewPw('');
        setResetConfirmPw('');
      }, 2500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to update password.');
    } finally {
      setResetLoading(false);
    }
  };

  /**
   * Fast Development Swap to inspect downstream UX of other accounts instantly.
   */
  const handleRoleSeatSwap = async (targetRole: string) => {
    if (!currentUser || !authToken) return;

    if (authToken.startsWith('mock-token-')) {
      // Re-trigger with same mock email, just different role
      handleMockLogin(targetRole, currentUser.email, currentUser.displayName || 'Administrator');
    } else {
      // For real Supabase roles, we issue an admin PUT request on the backend to swap roles
      setIsLoading(true);
      try {
        const res = await fetch(`/api/users/${currentUser.id}/role`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ role: targetRole })
        });
        if (!res.ok) {
          let errorMsg = 'Role swap permission denied.';
          try {
            const err = await safeReadJson(res);
            errorMsg = err.error || errorMsg;
          } catch (e: any) {
            errorMsg = e.message || errorMsg;
          }
          throw new Error(errorMsg);
        }

        // Re-handshake identity
        await handleAuthenticSession(authToken);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (showPasswordReset) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-neutral-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Set New Password</h2>
              <p className="text-xs text-neutral-500">Choose a strong password for your account.</p>
            </div>
          </div>

          {resetDone ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Password updated! Redirecting to login…
            </div>
          ) : (
            <>
              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {resetError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">New Password</label>
                  <input type="password" value={resetNewPw} onChange={e => setResetNewPw(e.target.value)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-300"
                    placeholder="At least 6 characters" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Confirm Password</label>
                  <input type="password" value={resetConfirmPw} onChange={e => setResetConfirmPw(e.target.value)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-300"
                    placeholder="Repeat new password" />
                </div>
              </div>
              <button onClick={handlePasswordReset} disabled={resetLoading || !resetNewPw || !resetConfirmPw}
                className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-sm font-semibold py-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2">
                {resetLoading ? <Loader className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {resetLoading ? 'Saving…' : 'Update Password'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
        <Loader className="w-8 h-8 text-neutral-900 animate-spin" />
        <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Syncing Ledger Engine...</span>
      </div>
    );
  }

  if (!currentUser || !authToken) {
    return (
      <AuthScreen
        onMockLogin={handleMockLogin}
        onPinLogin={handlePinLogin}
        isLoading={isLoading}
        errorMsg={errorMessage}
        settings={settings}
      />
    );
  }

  if (currentUser && !currentUser.isActive) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-6 shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-50 text-amber-600 rounded-lg mb-4 border border-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </div>
          <h2 className="text-base font-medium text-neutral-900 tracking-tight">Account Pending Approval</h2>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            Your corporate account is registered but currently pending administrative activation. 
            For compliance, an authorized System Admin must approve your active status.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-850 text-white font-medium text-xs py-2 rounded-lg cursor-pointer transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex font-sans antialiased overflow-hidden selection:bg-neutral-900 selection:text-white">
      {/* Sidebar navigation */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={navigateTo}
        onLogout={handleLogout}
        onRoleSwap={handleRoleSeatSwap}
        settings={settings}
        onSettingsUpdated={setSettings}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main viewport area */}
      <main className="flex-grow flex flex-col bg-neutral-50 relative h-screen overflow-hidden">
        {/* Mobile top bar — visible below lg breakpoint */}
        <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-gradient-to-r from-neutral-950 to-neutral-900 flex items-center px-3 gap-2.5 border-b border-neutral-800 shadow-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center font-bold text-neutral-900 text-[10px] shadow overflow-hidden shrink-0">
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : settings.appName.slice(0, 2).toUpperCase()
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">{settings.appName}</p>
            {settings.motto && <p className="text-[9px] text-neutral-500 truncate italic">{settings.motto}</p>}
          </div>
        </div>
        <div className="pt-14 lg:pt-0" />
        {errorMessage && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs flex items-center justify-between text-amber-800">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[10px] font-bold uppercase underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs mount on first visit, then stay alive — no remount on return visits */}
        {mountedTabs.has('members') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'members' ? 'hidden' : ''}`}>
            <MembersModule currentUser={currentUser} token={authToken} settings={settings} />
          </div>
        )}
        {mountedTabs.has('transactions') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'transactions' ? 'hidden' : ''}`}>
            <TransactionsModule currentUser={currentUser} token={authToken} settings={settings} />
          </div>
        )}
        {mountedTabs.has('reports') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'reports' ? 'hidden' : ''}`}>
            <ReportsModule currentUser={currentUser} token={authToken} settings={settings} />
          </div>
        )}
        {mountedTabs.has('portal') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'portal' ? 'hidden' : ''}`}>
            <MemberPortal currentUser={currentUser} token={authToken} settings={settings} />
          </div>
        )}
        {mountedTabs.has('users') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'users' ? 'hidden' : ''}`}>
            <UsersModule currentUser={currentUser} token={authToken} />
          </div>
        )}
        {mountedTabs.has('loans') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'loans' ? 'hidden' : ''}`}>
            <LoanApplicationsModule currentUser={currentUser} token={authToken} settings={settings} />
          </div>
        )}
        {mountedTabs.has('profile') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'profile' ? 'hidden' : ''}`}>
            <ProfileModule
              currentUser={currentUser}
              token={authToken}
              settings={settings}
              onProfileUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
                localStorage.setItem('coop_currentUser', JSON.stringify(updatedUser));
              }}
            />
          </div>
        )}
        {mountedTabs.has('settings') && (
          <div className={`flex-grow flex flex-col h-full overflow-hidden ${activeTab !== 'settings' ? 'hidden' : ''}`}>
            <SettingsModule
              currentUser={currentUser}
              token={authToken}
              settings={settings}
              onSettingsUpdated={(s) => { setSettings(s); localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s)); applyBranding(s); }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

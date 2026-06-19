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
import { AlertTriangle, KeyRound, Loader, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('members');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['members']));

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
      />

      {/* Main viewport area */}
      <main className="flex-grow flex flex-col bg-neutral-50 relative h-screen overflow-hidden">
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

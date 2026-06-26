import React, { useState } from 'react';
import { User, AppSettings } from '../types.ts';
import {
  Users,
  FileText,
  DollarSign,
  LogOut,
  Sparkles,
  LineChart,
  Shield,
  Settings,
  X,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Target,
  Eye,
  HandCoins,
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onRoleSwap: (role: string) => void;
  settings: AppSettings;
  onSettingsUpdated?: (s: AppSettings) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentUser, activeTab, setActiveTab, onLogout, onRoleSwap, settings, isOpen, onClose }: SidebarProps) {
  const rolesList = ['System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor', 'Member'];
  const [showCoopInfo, setShowCoopInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 text-neutral-300 flex flex-col h-screen shrink-0 border-r border-neutral-800
        transition-transform duration-300 ease-in-out print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-56
      `}>

        {/* Brand Header — clickable, distinct background */}
        <button
          onClick={() => { setShowCoopInfo(true); onClose(); }}
          className="w-full px-3 py-3 hidden lg:flex items-center gap-3 bg-neutral-950 hover:bg-neutral-800/70 transition-colors cursor-pointer border-b border-neutral-800 group"
        >
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center font-bold text-neutral-900 text-sm shadow-lg overflow-hidden shrink-0 group-hover:shadow-xl transition-shadow">
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : settings.appName.slice(0, 2).toUpperCase()
            }
          </div>
          <div className="overflow-hidden text-left">
            <p className="text-sm font-semibold text-white tracking-tight leading-snug">{settings.appName}</p>
            {settings.motto && (
              <p className="text-[10px] text-neutral-500 mt-0.5 italic truncate">{settings.motto}</p>
            )}
          </div>
        </button>

        {/* User row — clickable to profile */}
        <button
          onClick={() => navigate('profile')}
          className={`w-full px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer text-left group border-b border-neutral-800 ${
            activeTab === 'profile' ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/40'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center font-bold text-neutral-200 text-xs uppercase overflow-hidden shrink-0 ring-1 ring-neutral-600 group-hover:ring-neutral-500 transition-all">
            {currentUser.avatarUrl
              ? <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : (currentUser.displayName ? currentUser.displayName.slice(0, 2) : 'US')
            }
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-100 truncate leading-tight">
              {currentUser.displayName || currentUser.email}
            </p>
            <p className="text-[10px] text-neutral-500 truncate mt-0.5">{currentUser.role}</p>
          </div>
        </button>

        {/* Navigation */}
        <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest pl-3 mb-2">Operations</div>

          {currentUser.role !== 'Member' && (
            <button onClick={() => navigate('members')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'members' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
              <Users className="w-4 h-4 shrink-0" /><span>Members Module</span>
            </button>
          )}

          {currentUser.role !== 'Member' && (
            <button onClick={() => navigate('transactions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'transactions' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
              <DollarSign className="w-4 h-4 shrink-0" /><span>Posting Ledger</span>
            </button>
          )}

          {currentUser.role !== 'Member' && (
            <button onClick={() => navigate('loans')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'loans' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
              <HandCoins className="w-4 h-4 shrink-0" /><span>Loan Applications</span>
            </button>
          )}

          <div className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest pl-3 mt-4 mb-2">Intelligence</div>

          {currentUser.role !== 'Member' && (
            <button onClick={() => navigate('reports')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'reports' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
              <LineChart className="w-4 h-4 shrink-0" /><span>Financial & Audits</span>
            </button>
          )}

          {currentUser.role === 'Member' && (
            <button onClick={() => navigate('portal')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'portal' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
              <FileText className="w-4 h-4 shrink-0" /><span>My Self Service</span>
            </button>
          )}

          {(currentUser.role === 'System Admin' || currentUser.role === 'Manager') && (
            <>
              <div className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest pl-3 mt-4 mb-2">Administration</div>
              <button onClick={() => navigate('users')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'users' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
                <Shield className="w-4 h-4 shrink-0" /><span>User Accounts</span>
              </button>
              {currentUser.role === 'System Admin' && (
                <button onClick={() => navigate('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium tracking-wide transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-white text-neutral-900 shadow font-semibold' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850'}`}>
                  <Settings className="w-4 h-4 shrink-0" /><span>System Settings</span>
                </button>
              )}
            </>
          )}
        </nav>



        {/* Footer */}
        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-red-400 transition-colors w-full cursor-pointer pl-3 py-1">
            <LogOut className="w-4 h-4 shrink-0" /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Cooperative Info Modal */}
      {showCoopInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCoopInfo(false)} />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-neutral-900 px-6 pt-8 pb-6 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg overflow-hidden">
                {settings.logoUrl
                  ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <span className="text-xl font-bold text-neutral-900">{settings.appName.slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{settings.appName}</h2>
                {settings.appSubtitle && <p className="text-xs text-neutral-400 mt-0.5">{settings.appSubtitle}</p>}
                {settings.establishedYear && (
                  <p className="text-[11px] text-neutral-500 mt-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" /> Est. {settings.establishedYear}
                  </p>
                )}
              </div>
            </div>

            {/* Close button */}
            <button onClick={() => setShowCoopInfo(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5 text-neutral-300" />
            </button>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {settings.motto && (
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm font-medium text-neutral-700 italic">"{settings.motto}"</p>
                </div>
              )}

              {settings.mission && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-neutral-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Mission</p>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{settings.mission}</p>
                </div>
              )}

              {settings.vision && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-3.5 h-3.5 text-neutral-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Vision</p>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{settings.vision}</p>
                </div>
              )}

              {(settings.address || settings.contactEmail || settings.contactPhone) && (
                <div className="border-t border-neutral-100 pt-5 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Contact & Location</p>
                  {settings.address && (
                    <div className="flex items-start gap-2.5 text-sm text-neutral-600">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                      <span>{settings.address}</span>
                    </div>
                  )}
                  {settings.contactEmail && (
                    <div className="flex items-center gap-2.5 text-sm text-neutral-600">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{settings.contactEmail}</span>
                    </div>
                  )}
                  {settings.contactPhone && (
                    <div className="flex items-center gap-2.5 text-sm text-neutral-600">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{settings.contactPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {!settings.mission && !settings.vision && !settings.motto && !settings.address && (
                <p className="text-sm text-neutral-400 text-center py-4">
                  No cooperative info set yet. Go to System Settings → App Branding to add it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-full shrink-0">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Exit System?</h2>
                <p className="text-xs text-neutral-500 mt-1">You will be logged out of the cooperative system.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Stay
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

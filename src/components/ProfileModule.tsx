import React, { useState, useEffect, useRef } from 'react';
import { User, Member, AppSettings } from '../types.ts';
import { safeReadJson } from '../lib/safe-fetch.ts';
import { getSupabaseClient } from '../lib/supabase.ts';
import { Loader, Save, Camera, X } from 'lucide-react';

interface ProfileModuleProps {
  currentUser: User;
  token: string;
  settings: AppSettings;
  onProfileUpdated: (updatedUser: User) => void;
}

export default function ProfileModule({ currentUser, token, settings, onProfileUpdated }: ProfileModuleProps) {
  const [memberDetails, setMemberDetails] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMemberProfile();
  }, [token]);

  // Sync from parent if user object updates externally
  useEffect(() => {
    setDisplayName(currentUser.displayName || '');
    setPhone(currentUser.phone || '');
    setAvatarUrl(currentUser.avatarUrl || '');
  }, [currentUser]);

  const fetchMemberProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/members/self', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const member = await safeReadJson(res);
        setMemberDetails(member);
        setFirstName(member.firstName || '');
        setLastName(member.lastName || '');
        // Prefer users.phone (more up to date) but fall back to member phone
        if (!currentUser.phone && member.phone) setPhone(member.phone);
        setDepartment(member.department || '');
      }
    } catch {
      // No linked member profile — only user-level fields are editable
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const supabase = getSupabaseClient();
    if (supabase) {
      // Upload to Supabase Storage: avatars/{uid}/{timestamp}.{ext}
      setMsg(null);
      const ext = file.name.split('.').pop() || 'jpg';
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || `local-${currentUser.id}`;
      const path = `${uid}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (error) {
        setMsg({ type: 'error', text: `Upload failed: ${error.message}` });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      setAvatarUrl(publicUrl);
    } else {
      // No Supabase configured (mock/local mode) — store as base64
      const reader = new FileReader();
      reader.onload = () => setAvatarUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName,
          phone,
          avatarUrl,
          firstName,
          lastName,
          department,
        }),
      });

      if (!res.ok) {
        const err = await safeReadJson(res);
        throw new Error(err.error || 'Failed to update profile.');
      }

      const updatedUser = await safeReadJson(res);
      onProfileUpdated(updatedUser);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = displayName
    ? displayName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : currentUser.email.slice(0, 2).toUpperCase();

  const inputCls = "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white";
  const labelCls = "block text-xs font-semibold text-neutral-600 mb-1.5";

  if (isLoading) {
    return (
      <div className="flex-grow p-8 flex items-center justify-center">
        <Loader className="w-5 h-5 text-neutral-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-grow p-8 overflow-y-auto h-screen max-w-xl">
      <div className="mb-8">
        <h1 className="text-xl font-medium tracking-tight text-neutral-900">My Profile</h1>
        <p className="text-xs text-neutral-400 mt-1">Update your display name, photo, and contact details.</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-6 space-y-5">

        {/* Avatar */}
        <div className="flex items-center gap-5 pb-5 border-b border-neutral-100">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center text-white font-bold text-lg uppercase overflow-hidden border-2 border-neutral-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            {/* Overlay button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 break-all leading-snug">{currentUser.email}</p>
            <p className="text-[11px] text-neutral-400 mb-2 mt-0.5">{currentUser.role}</p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 py-1 px-2.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                Change Photo
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">PNG, JPG, SVG</p>
          </div>
        </div>

        {/* Display Name — hidden for Members */}
        {currentUser.role !== 'Member' && (
          <div>
            <label className={labelCls}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className={inputCls}
              placeholder="Your display name"
            />
          </div>
        )}

        {/* Phone — always visible for all roles */}
        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={inputCls}
            placeholder="+63 9XX XXX XXXX"
          />
        </div>

        {/* Member profile fields — only shown if linked */}
        {memberDetails && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name</label>
                {currentUser.role === 'Member' ? (
                  <p className="text-sm text-neutral-500 py-2">{firstName || '—'}</p>
                ) : (
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} />
                )}
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                {currentUser.role === 'Member' ? (
                  <p className="text-sm text-neutral-500 py-2">{lastName || '—'}</p>
                ) : (
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />
                )}
              </div>
            </div>
            {currentUser.role === 'Member' && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                To update your name, please contact the System Admin.
              </p>
            )}
            {currentUser.role !== 'Member' && (
              <div>
                <label className={labelCls}>Department</label>
                <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className={inputCls} placeholder="e.g. Operations" />
              </div>
            )}
          </>
        )}

        {/* Email — read only */}
        <div>
          <label className={labelCls}>
            Email Address <span className="font-normal text-neutral-400">(managed by Supabase Auth)</span>
          </label>
          <input
            type="text"
            value={currentUser.email}
            disabled
            className="w-full text-sm border border-neutral-100 rounded-lg px-3 py-2 bg-neutral-50 text-neutral-400 cursor-not-allowed"
          />
        </div>

        {msg && (
          <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
            {msg.text}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

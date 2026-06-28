import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../../types.ts';
import { safeReadJson } from '../../lib/safe-fetch.ts';
import { Save, Loader, Upload, X, ImageIcon } from 'lucide-react';
import InfoButton from '../InfoButton.tsx';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{label}</label>
    {children}
  </div>
);

interface Props {
  token: string;
  settings: AppSettings;
  onSettingsUpdated: (settings: AppSettings) => void;
}

export default function SettingsGeneral({ token, settings, onSettingsUpdated }: Props) {
  const [appName, setAppName] = useState(settings.appName);
  const [appSubtitle, setAppSubtitle] = useState(settings.appSubtitle);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [motto, setMotto] = useState(settings.motto);
  const [mission, setMission] = useState(settings.mission);
  const [vision, setVision] = useState(settings.vision);
  const [address, setAddress] = useState(settings.address);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [contactPhone, setContactPhone] = useState(settings.contactPhone);
  const [establishedYear, setEstablishedYear] = useState(settings.establishedYear);

  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAppName(settings.appName);
    setAppSubtitle(settings.appSubtitle);
    setCurrencySymbol(settings.currencySymbol);
    setLogoUrl(settings.logoUrl);
    setMotto(settings.motto);
    setMission(settings.mission);
    setVision(settings.vision);
    setAddress(settings.address);
    setContactEmail(settings.contactEmail);
    setContactPhone(settings.contactPhone);
    setEstablishedYear(settings.establishedYear);
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Logo file is too large. Please use an image under 2 MB.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appName, appSubtitle, currencySymbol, logoUrl,
          motto, mission, vision, address,
          contactEmail, contactPhone, establishedYear,
        }),
      });
      if (!res.ok) throw new Error((await safeReadJson(res)).error);
      onSettingsUpdated({
        ...settings,
        appName, appSubtitle, currencySymbol, logoUrl,
        motto, mission, vision, address,
        contactEmail, contactPhone, establishedYear,
      });
      setMsg({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white";
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">App Branding</h2>
        <InfoButton text="Configure how your cooperative appears in the system — name, logo, tagline, mission, vision, and contact information. These details appear on printed documents and the login screen." />
      </div>

      {/* Identity */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Identity</p>

        {/* Logo */}
        <Field label="Logo">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-200 flex items-center justify-center bg-neutral-50 shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <ImageIcon className="w-6 h-6 text-neutral-300" />
              )}
            </div>
            <div className="space-y-1.5">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 py-1.5 px-3 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload Logo
              </button>
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl('')}
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 cursor-pointer">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
              <p className="text-[10px] text-neutral-400">PNG, JPG, SVG · Max 2 MB</p>
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cooperative / App Name">
            <input type="text" value={appName} onChange={e => setAppName(e.target.value)}
              className={inputCls} placeholder="HC Employee Cooperative" />
          </Field>
          <Field label="Subtitle / Tagline">
            <input type="text" value={appSubtitle} onChange={e => setAppSubtitle(e.target.value)}
              className={inputCls} placeholder="Enterprise Core" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency Symbol">
            <input type="text" value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)}
              className={inputCls} placeholder="₱" maxLength={3} />
          </Field>
          <Field label="Year Established">
            <input type="text" value={establishedYear} onChange={e => setEstablishedYear(e.target.value)}
              className={inputCls} placeholder="2005" maxLength={4} />
          </Field>
        </div>

        <Field label="Motto">
          <textarea rows={2} value={motto} onChange={e => setMotto(e.target.value)}
            className={textareaCls} placeholder="Unity, Service, Progress" />
        </Field>
      </div>

      {/* About */}
      <div className="space-y-4 pt-4 border-t border-neutral-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Mission & Vision</p>

        <Field label="Mission Statement">
          <textarea rows={6} value={mission} onChange={e => setMission(e.target.value)}
            className={textareaCls} placeholder="To empower our members through accessible financial services and cooperative values..." />
        </Field>

        <Field label="Vision Statement">
          <textarea rows={6} value={vision} onChange={e => setVision(e.target.value)}
            className={textareaCls} placeholder="A thriving cooperative community where every member achieves financial well-being..." />
        </Field>
      </div>

      {/* Contact */}
      <div className="space-y-4 pt-4 border-t border-neutral-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Contact & Location</p>

        <Field label="Office Address">
          <textarea rows={3} value={address} onChange={e => setAddress(e.target.value)}
            className={textareaCls} placeholder="123 Main Street, City, Province" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact Email">
            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
              className={inputCls} placeholder="info@cooperative.ph" />
          </Field>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => {
                // Allow digits, spaces, +, -, (, )
                const val = e.target.value.replace(/[^0-9\s\+\-\(\)]/g, '');
                setContactPhone(val);
              }}
              className={inputCls}
              placeholder="+63 917 123 4567"
            />
            {contactPhone && !/^[\d\s\+\-\(\)]{7,20}$/.test(contactPhone) && (
              <p className="text-[10px] text-red-500 mt-1">Enter a valid phone number (e.g. +63 917 123 4567)</p>
            )}
            <p className="text-[10px] text-neutral-400 mt-1">Format: +63 9XX XXX XXXX</p>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`text-xs font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
        {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

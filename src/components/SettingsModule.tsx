import React, { useState } from 'react';
import { User, AppSettings } from '../types.ts';
import SettingsGeneral from './settings/SettingsGeneral.tsx';
import SettingsMembership from './settings/SettingsMembership.tsx';
import SettingsDepartments from './settings/SettingsDepartments.tsx';
import SettingsShareCapital from './settings/SettingsShareCapital.tsx';
import SettingsProducts from './settings/SettingsProducts.tsx';
import SettingsLoanRules from './settings/SettingsLoanRules.tsx';
import SettingsChartOfAccounts from './settings/SettingsChartOfAccounts.tsx';

interface Props {
  currentUser: User;
  token: string;
  onSettingsUpdated: (settings: AppSettings) => void;
  settings: AppSettings;
}

type SectionId =
  | 'branding'
  | 'membership'
  | 'departments'
  | 'shareCapital'
  | 'products'
  | 'loanRules'
  | 'coa';

const NAV: { group: string; items: { id: SectionId; label: string }[] }[] = [
  {
    group: 'App',
    items: [
      { id: 'branding', label: 'Branding & Identity' },
    ],
  },
  {
    group: 'Members',
    items: [
      { id: 'departments', label: 'Departments' },
      { id: 'membership', label: 'Membership Types & Statuses' },
    ],
  },
  {
    group: 'Loans & Savings',
    items: [
      { id: 'shareCapital', label: 'Share Capital Rules' },
      { id: 'products', label: 'Savings & Loan Products' },
      { id: 'loanRules', label: 'Loan Approval & Parameters' },
    ],
  },
  {
    group: 'Advanced',
    items: [
      { id: 'coa', label: 'Account Categories' },
    ],
  },
];

export default function SettingsModule({ currentUser, token, onSettingsUpdated, settings }: Props) {
  const [section, setSection] = useState<SectionId>('branding');

  const allItems = NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));
  const currentLabel = allItems.find(i => i.id === section);

  return (
    <div className="flex-grow flex flex-col lg:flex-row h-screen overflow-hidden">
      {/* Mobile: section picker dropdown */}
      <div className="lg:hidden shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
        <select
          value={section}
          onChange={e => setSection(e.target.value as SectionId)}
          className="w-full text-sm border border-neutral-200 bg-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
        >
          {NAV.map(group => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop: Left nav */}
      <aside className="hidden lg:flex w-52 shrink-0 border-r border-neutral-200 bg-white flex-col py-6 px-3 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2 mb-4">Configuration</p>
        {NAV.map(group => (
          <div key={group.group} className="mb-6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 px-2 mb-2">{group.group}</p>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full text-left text-xs px-2.5 py-2 rounded-lg mb-1 transition-colors cursor-pointer font-medium ${
                  section === item.id
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Content pane */}
      <main className="flex-grow overflow-y-auto p-4 lg:p-8 lg:max-w-3xl">
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4 lg:p-6">
          {section === 'branding' && (
            <SettingsGeneral token={token} settings={settings} onSettingsUpdated={onSettingsUpdated} />
          )}
          {section === 'membership' && (
            <SettingsMembership token={token} />
          )}
          {section === 'departments' && (
            <SettingsDepartments token={token} />
          )}
          {section === 'shareCapital' && (
            <SettingsShareCapital token={token} settings={settings} />
          )}
          {section === 'products' && (
            <SettingsProducts token={token} settings={settings} />
          )}
          {section === 'loanRules' && (
            <SettingsLoanRules token={token} settings={settings} />
          )}
          {section === 'coa' && (
            <SettingsChartOfAccounts token={token} />
          )}
        </div>
      </main>
    </div>
  );
}

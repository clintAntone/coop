import React, { useState } from 'react';
import { User } from '../types.ts';
import { safeReadJson } from '../lib/safe-fetch.ts';
import { KeyRound, Loader, LogOut } from 'lucide-react';

interface Props {
  currentUser: User;
  token: string;
  onVerified: (updatedUser: User) => void;
  onLogout: () => void;
}

export default function EmployeeIDVerificationScreen({ currentUser, token, onVerified, onLogout }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me/link-employee-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });
      if (!res.ok) {
        const err = await safeReadJson(res);
        throw new Error(err.error || 'Verification failed.');
      }
      const updatedUser = await safeReadJson(res);
      onVerified(updatedUser);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-neutral-900 text-white rounded-lg mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900">Employee ID Verification</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Enter your Employee ID to complete registration. Logged in as <strong>{currentUser.email}</strong>.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="Enter your Employee ID (e.g. EMP-001)"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
        <button
          onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

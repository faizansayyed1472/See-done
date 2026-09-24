import React, { useState } from 'react';
import { Shield, Key, Lock, User, CheckCircle2, AlertCircle, Sparkles, Store, Eye, EyeOff } from 'lucide-react';
import { StaffAccount, StoreSettings } from '../types';
import { playKeySound } from '../utils/audio';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  settings: StoreSettings;
  onLoginSuccess: (staff: StaffAccount, remember?: boolean) => void;
  canDismiss?: boolean;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  settings,
  onLoginSuccess,
  canDismiss = false,
}) => {
  const [selectedRole, setSelectedRole] = useState<'any' | 'owner' | 'cashier'>('any');
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberSession, setRememberSession] = useState(false);

  if (!isOpen) return null;

  const staffList = settings.staffAccounts || [];
  const ownerAccount = staffList.find((s) => s.role === 'owner' || s.role === 'master_admin') || staffList[0];

  const handleSelectQuickAccount = (staff: StaffAccount) => {
    playKeySound('num');
    const isOwner = staff.role === 'owner' || staff.role === 'master_admin';
    const username = isOwner ? 'faizan inamdar' : (staff.username || staff.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    setUserIdInput(username);
    setPasswordInput('');
    setErrorMsg('');
    if (isOwner) {
      setSelectedRole('owner');
    } else {
      setSelectedRole('cashier');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = userIdInput.trim().toLowerCase();
    const cleanUserStripped = cleanUser.replace(/[^a-z0-9]/g, '');
    const cleanPin = passwordInput.trim();

    if (!cleanUser) {
      setErrorMsg('Please enter your User ID or Username.');
      return;
    }
    if (!cleanPin) {
      setErrorMsg('Please enter your Password or PIN.');
      return;
    }

    const isFaizanAttempt =
      cleanUser === 'faizan' ||
      cleanUser === 'faizan inamdar' ||
      cleanUser === 'faizan-inamdar' ||
      cleanUserStripped === 'faizaninamdar' ||
      cleanUserStripped === 'faizaninamdaradmin' ||
      cleanUserStripped === 'faizan' ||
      cleanUser === 'server' ||
      cleanUser === 'admin' ||
      cleanUser === 'owner' ||
      cleanUser === 'staff-owner';

    // Find staff by username, serverId, id, or name (case-insensitive)
    const matched = staffList.find((s) => {
      const u = (s.username || '').toLowerCase();
      const n = s.name.toLowerCase();
      const nStripped = n.replace(/[^a-z0-9]/g, '');
      const rawId = s.id.toLowerCase();
      const rawServerId = (s.serverId || '').toLowerCase();

      const isFaizanStaff =
        s.role === 'owner' ||
        s.role === 'master_admin' ||
        s.id === 'faizan-inamdar' ||
        s.id === 'staff-owner' ||
        s.name.toLowerCase().includes('faizan');

      if (isFaizanAttempt && isFaizanStaff) {
        return true;
      }

      return (
        u === cleanUser ||
        rawServerId === cleanUser ||
        n === cleanUser ||
        nStripped === cleanUserStripped ||
        rawId === cleanUser
      );
    });

    if (!matched) {
      // If Faizan Inamdar server ID attempted with master PIN, authenticate directly
      if (isFaizanAttempt && cleanPin === 'nayab@q6') {
        const faizanOwner: StaffAccount = {
          id: 'faizan-inamdar',
          serverId: 'faizan-inamdar',
          name: 'Faizan Inamdar (admin)',
          username: 'faizan',
          role: 'owner',
          pin: 'nayab@q6',
          active: true,
          assignedOutletIds: ['store-1', 'store-2'],
          defaultOutletId: 'store-1',
          permissions: {
            canEditProducts: true,
            canViewReports: true,
            canManageUdhaar: true,
            canVoidBills: true,
            canAccessMasterAdmin: true,
          },
        };
        playKeySound('action');
        onLoginSuccess(faizanOwner, false);
        return;
      }

      setErrorMsg('User ID not found. Check your credentials or select an account below.');
      return;
    }

    // Verify Password / PIN
    const isOwner = matched.role === 'owner' || matched.role === 'master_admin';
    const pinMatches = matched.pin === cleanPin || (isOwner && cleanPin === 'nayab@q6');
    if (!pinMatches) {
      setErrorMsg('Incorrect Password. Please check and try again.');
      return;
    }

    // Login successful
    playKeySound('action');

    // SECURITY DIRECTIVE:
    // Only non-admin cashier sessions may optionally be remembered in localStorage.
    // Owner / Admin credentials MUST NEVER be stored in localStorage for auto-login
    // across reloads, preventing unauthorized access breaches!
    try {
      if (rememberSession && matched.role === 'cashier') {
        localStorage.setItem('nayab_active_session_staff', matched.id);
        localStorage.setItem('nayab_session_authenticated', 'true');
      } else {
        localStorage.removeItem('nayab_active_session_staff');
        localStorage.removeItem('nayab_session_authenticated');
      }
    } catch {}

    onLoginSuccess(matched, rememberSession);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-950/60 relative overflow-hidden">
        {/* Glow Header Accent */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Banner */}
        <div className="text-center space-y-2 mb-6">
          <div className="flex justify-center mb-1">
            <div className="relative">
              <img
                src="/pwa-192x192.png"
                alt="NAYAB POS"
                className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-emerald-950/80 ring-2 ring-emerald-500/40"
              />
              <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-slate-950 rounded-full shadow-xs">
                <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wider">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>NAYAB SECURE POS</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Store Login & Authentication</span>
          </h3>
          <p className="text-xs text-slate-400">
            {settings.shopName || 'NAYAB Smart Kirana & Spices'} • Staff & Owner Access
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-200 text-xs flex items-center gap-2 animate-in shake">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Accounts Selector Chips */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
            <span>Select Account:</span>
            <span className="text-[10px] text-slate-500">Tap to autofill ID</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {staffList.slice(0, 4).map((s) => {
              const isOwner = s.role === 'owner' || s.role === 'master_admin';
              const username = isOwner ? 'faizan inamdar' : (s.username || s.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
              const isSelected = userIdInput.toLowerCase() === username.toLowerCase();
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectQuickAccount(s)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 text-xs cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                      : isOwner
                      ? 'bg-slate-800/80 border-amber-500/40 text-amber-200 hover:bg-slate-750'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isOwner ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isOwner ? '👑' : '👤'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold truncate text-white">{s.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {isOwner ? 'Server ID: faizan-inamdar' : `ID: ${username}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>User ID / Username:</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="e.g. faizan inamdar, faizan, or abdullah"
              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm placeholder-slate-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Password / PIN:</span>
              </span>
              {selectedRole === 'owner' && (
                <span className="text-[10px] text-amber-400 font-normal">
                  Owner Password Required
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="nayab_pos_pin"
                id="nayab_pos_pin_input"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                required
                maxLength={16}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={showPassword ? 'Enter PIN' : '••••••••'}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 pr-11 text-white font-mono text-sm placeholder-slate-500 outline-none transition-all tracking-widest"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title={showPassword ? 'Hide PIN' : 'Show PIN'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(e) => setRememberSession(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
              <span>Remember login session for cashier counter</span>
            </label>
            <span className="text-[10px] text-slate-500 pl-6">
              Owner/Admin accounts strictly require password on page reload for security.
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm tracking-wide rounded-xl shadow-lg shadow-emerald-950/80 border border-emerald-400/40 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            <Key className="w-4 h-4 text-emerald-200" />
            <span>LOGIN TO NAYAB POS COUNTER</span>
          </button>

          {canDismiss && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Continue without switching account
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

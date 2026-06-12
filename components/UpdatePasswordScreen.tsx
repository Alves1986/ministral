import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';
import { getSystemLogo } from '../utils/branding';

export const UpdatePasswordScreen: React.FC<{ onPasswordUpdated: () => void }> = ({ onPasswordUpdated }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Supabase não inicializado");

      const { error } = await sb.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onPasswordUpdated();
        }, 2000);
      }
    } catch (err: any) {
      setErrorMsg("Erro ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-ministral-500/10 blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-violet-600/10 blur-[120px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-24 h-24 flex items-center justify-center overflow-hidden mb-6">
            <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xs font-black text-ministral-gold uppercase tracking-[0.3em] mb-3">Recuperação</h3>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Nova Senha
          </h1>
        </div>

        <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          {success ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 animate-fade-in py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <Key size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">Senha atualizada!</h2>
              <p className="text-slate-400 text-sm">Sua senha foi redefinida com sucesso. Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nova Senha</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-12 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-12 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                    disabled={loading}
                  />
                </div>
              </div>

              {errorMsg && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-slide-up text-center">{errorMsg}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-ministral-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50 border-b-4 border-secondary/30"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : "Atualizar Senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

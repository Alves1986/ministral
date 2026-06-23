import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, Layout, Key, Building2 } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { getSupabase } from '../services/supabase/client';
import { getSystemLogo } from '../utils/branding';

export const LoginScreen: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes('error=access_denied') || window.location.hash.includes('error_description=Signups+not+allowed')) {
      setErrorMsg("Não foi possível completar o login. Se você recebeu um link de convite, use-o para se cadastrar. Caso contrário, peça ao administrador para adicioná-lo.");
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoadingAction(true);
    setErrorMsg("");
    
    try {
        const result = await loginWithEmail(email.trim(), password.trim());
        if (!result.success) {
            setErrorMsg(result.message || "Erro ao conectar.");
            setLoadingAction(false);
        }
        // Se sucesso, o SessionContext vai atualizar e redirecionar
    } catch (e: any) {
        setErrorMsg("Erro de conexão. Verifique sua internet.");
        setLoadingAction(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;
    
    setRecoveryLoading(true);
    setErrorMsg("");
    
    try {
        const sb = getSupabase();
        if (!sb) throw new Error("Supabase not initialized");
        
        const { error } = await (sb.auth as any).resetPasswordForEmail(recoveryEmail.trim(), {
            redirectTo: window.location.origin
        });

        if (error) {
            setErrorMsg(error.message);
            setRecoveryLoading(false);
        } else {
            setRecoverySuccess(true);
            setRecoveryLoading(false);
        }
    } catch (e: any) {
        setErrorMsg("Erro ao enviar link de recuperação.");
        setRecoveryLoading(false);
    }
  };

  const isGlobalLoading = loadingAction || isLoading || recoveryLoading;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row relative overflow-hidden font-sans">
          {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-ministral-500/10 blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] animate-pulse"></div>
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* Hero Section (Left on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative z-10">
          <div>
              <div className="flex items-center gap-4 mb-12">
                  <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
                      <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-3xl font-black tracking-widest text-white uppercase">Ministral</h1>
              </div>
              <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter mb-8">
                  Excelência na escala. <span className="text-transparent bg-clip-text bg-gradient-to-r from-ministral-gold to-ministral-100">Propósito</span> no servir.
              </h2>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  Coordene sua equipe com precisão, elimine conflitos de escala e leve seu ministério a um novo nível de organização. Simples, inteligente e poderoso.
              </p>
          </div>
      </div>

      {/* Form Section (Right on Desktop) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 bg-ministral-dark/40 backdrop-blur-md">
          <div className="w-full max-w-[420px]">
              <div className="text-center lg:text-left mb-10">
                  <div className="lg:hidden flex justify-center mb-8">
                      <div className="w-32 h-32 flex items-center justify-center overflow-hidden">
                          <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                  </div>
                  <h3 className="text-xs font-black text-ministral-gold uppercase tracking-[0.3em] mb-3">Bem-vindo</h3>
                  <h1 className="text-4xl font-black text-white tracking-tighter">
                      Acesse Ministral
                  </h1>
              </div>

              {/* Form Card */}
              <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
                  
                  <form onSubmit={handleLoginSubmit} className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                          <div className="relative group">
                              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type="email" 
                                  value={email} 
                                  onChange={e => setEmail(e.target.value)}
                                  placeholder="seu@email.com" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={isGlobalLoading}
                              />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <div className="flex justify-between items-center ml-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                              <button 
                                  type="button" 
                                  onClick={() => setShowRecovery(true)}
                                  className="text-[10px] font-black text-secondary/70 hover:text-secondary uppercase tracking-widest transition-colors"
                              >
                                  Esqueci minha senha
                              </button>
                          </div>
                          <div className="relative group">
                              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type={showPassword ? "text" : "password"} 
                                  value={password} 
                                  onChange={e => setPassword(e.target.value)}
                                  placeholder="••••••••" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-12 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={isGlobalLoading}
                              />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                          </div>
                      </div>

                      {errorMsg && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-slide-up text-center">{errorMsg}</div>}

                      <button 
                          type="submit" 
                          disabled={isGlobalLoading}
                          className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-ministral-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50 border-b-4 border-secondary/30"
                      >
                          {isGlobalLoading ? <Loader2 size={20} className="animate-spin" /> : <>Entrar agora <ArrowRight size={18}/></>}
                      </button>

                      <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-white/10"></div>
                          <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">ou</span>
                          <div className="flex-grow border-t border-white/10"></div>
                      </div>

                      <button 
                          type="button" 
                          onClick={async () => {
                              setLoadingAction(true);
                              setErrorMsg("");
                              const res = await loginWithGoogle();
                              if (!res.success) {
                                  setErrorMsg(res.message || "Erro ao conectar com Google.");
                                  setLoadingAction(false);
                              }
                          }}
                          disabled={isGlobalLoading}
                          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-4 rounded-2xl shadow-xl shadow-white/5 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                      >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Entrar com Google
                      </button>
                  </form>

                  {/* Recovery Overlay */}
                  {showRecovery && (
                      <div className="absolute inset-0 bg-slate-900 z-20 p-8 sm:p-10 flex flex-col justify-center animate-fade-in">
                          <div className="mb-6">
                              <div className="w-12 h-12 rounded-2xl bg-ministral-500/10 flex items-center justify-center text-ministral-500 mb-4">
                                  <Key size={24} />
                              </div>
                              <h4 className="text-xl font-black text-white tracking-tighter">Recuperar Senha</h4>
                              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                                  Informe seu e-mail para receber um link de redefinição de senha.
                              </p>
                          </div>

                          {recoverySuccess ? (
                              <div className="space-y-6">
                                  <div className="p-4 rounded-2xl bg-ministral-500/10 border border-ministral-500/20 text-ministral-500 text-xs font-bold text-center">
                                      Verifique seu email para redefinir a senha.
                                  </div>
                                  <button 
                                      onClick={() => {
                                          setShowRecovery(false);
                                          setRecoverySuccess(false);
                                      }}
                                      className="w-full py-4 text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                                  >
                                      Voltar ao login
                                  </button>
                              </div>
                          ) : (
                              <form onSubmit={handleRecoverySubmit} className="space-y-6">
                                  <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                      <div className="relative group">
                                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                          <input 
                                              type="email" 
                                              value={recoveryEmail} 
                                              onChange={e => setRecoveryEmail(e.target.value)}
                                              placeholder="seu@email.com" 
                                              className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                              disabled={recoveryLoading}
                                          />
                                      </div>
                                  </div>

                                  {errorMsg && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center">{errorMsg}</div>}

                                  <div className="flex flex-col gap-3">
                                      <button 
                                          type="submit" 
                                          disabled={recoveryLoading}
                                          className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-ministral-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                                      >
                                          {recoveryLoading ? <Loader2 size={20} className="animate-spin" /> : <>Enviar link <ArrowRight size={18}/></>}
                                      </button>
                                      <button 
                                          type="button"
                                          onClick={() => {
                                              setShowRecovery(false);
                                              setErrorMsg("");
                                          }}
                                          className="w-full py-4 text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                                      >
                                          Cancelar
                                      </button>
                                  </div>
                              </form>
                          )}
                      </div>
                  )}
              </div>

              <div className="mt-8 text-center">
                  <div className="flex justify-center gap-6 mt-2">
                      <button onClick={() => setLegalDoc('terms')} className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-400 transition-colors">Termos</button>
                      <button onClick={() => setLegalDoc('privacy')} className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-400 transition-colors">Privacidade</button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Key, Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { getSupabase } from '../services/supabase/client';
import { getSystemLogo } from '../utils/branding';
import { Button, IconButton } from './ui';

export const LoginScreen: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes('error=access_denied') || window.location.hash.includes('error_description=Signups+not+allowed')) {
      setErrorMsg('Não foi possível completar o login. Se você recebeu um link de convite, use-o para se cadastrar. Caso contrário, peça ao administrador para adicioná-lo.');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (!showRecovery) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRecovery(false);
        setRecoverySuccess(false);
        setErrorMsg('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showRecovery]);

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;

    setLoadingAction(true);
    setErrorMsg('');

    try {
      const result = await loginWithEmail(email.trim(), password.trim());
      if (!result.success) {
        setErrorMsg(result.message || 'Erro ao conectar.');
        setLoadingAction(false);
      }
      // Se sucesso, o SessionContext vai atualizar e redirecionar.
    } catch {
      setErrorMsg('Erro de conexão. Verifique sua internet.');
      setLoadingAction(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingAction(true);
    setErrorMsg('');

    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setErrorMsg(result.message || 'Erro ao conectar com Google.');
        setLoadingAction(false);
      }
    } catch {
      setErrorMsg('Erro de conexão. Verifique sua internet.');
      setLoadingAction(false);
    }
  };

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoveryEmail) return;

    setRecoveryLoading(true);
    setErrorMsg('');

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not initialized');

      const { error } = await (supabase.auth as any).resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setErrorMsg(error.message);
        setRecoveryLoading(false);
      } else {
        setRecoverySuccess(true);
        setRecoveryLoading(false);
      }
    } catch {
      setErrorMsg('Erro ao enviar link de recuperação.');
      setRecoveryLoading(false);
    }
  };

  const openRecovery = () => {
    setErrorMsg('');
    setRecoveryEmail(email);
    setRecoverySuccess(false);
    setShowRecovery(true);
  };

  const closeRecovery = () => {
    setShowRecovery(false);
    setRecoverySuccess(false);
    setErrorMsg('');
  };

  const isGlobalLoading = loadingAction || isLoading || recoveryLoading;
  const inputFrameClass = 'group relative rounded-2xl border border-white/10 bg-slate-950/60 transition-[border-color,box-shadow] focus-within:border-secondary/60 focus-within:ring-2 focus-within:ring-secondary/15';
  const inputClass = 'w-full rounded-2xl bg-transparent py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-700';

  return (
    <div className="relative flex min-h-[100svh] overflow-hidden bg-slate-950 font-sans text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-[12%] -top-[12%] h-[55%] w-[55%] rounded-full bg-ministral-500/10 blur-[150px]" />
        <div className="absolute -bottom-[18%] -right-[12%] h-[48%] w-[48%] rounded-full bg-secondary/10 blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      <main className="relative z-10 grid min-h-[100svh] w-full lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
        <section className="relative hidden min-h-[100svh] flex-col justify-between border-r border-white/5 px-10 py-10 sm:px-14 lg:flex xl:px-20 xl:py-14">
          <div className="max-w-2xl">
            <div className="mb-16 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden sm:h-20 sm:w-20">
                <img src={getSystemLogo('dark')} alt="Logo Ministral" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-widest text-white">Ministral</h1>
            </div>

            <div className="max-w-xl">
              <p className="mb-5 text-[10px] font-black uppercase tracking-[0.3em] text-ministral-gold">Gestão que serve o propósito</p>
              <h2 className="text-6xl font-black leading-[1.05] tracking-tighter text-white">
                Excelência na escala. <span className="text-transparent bg-clip-text bg-gradient-to-r from-ministral-gold to-ministral-100">Propósito</span> no servir.
              </h2>
              <p className="mt-8 max-w-md text-lg leading-relaxed text-slate-400">
                Coordene sua equipe com precisão, elimine conflitos de escala e leve seu ministério a um novo nível de organização. Simples, inteligente e poderoso.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <ShieldCheck size={16} className="text-ministral-gold" aria-hidden="true" />
            <span>Organização para servir melhor.</span>
          </div>
        </section>

        <section className="flex min-h-[100svh] flex-col bg-ministral-dark/40 px-5 py-6 backdrop-blur-md sm:px-10 sm:py-10 lg:justify-between xl:px-16">
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden">
                <img src={getSystemLogo('dark')} alt="Logo Ministral" className="h-full w-full object-contain" />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.22em] text-white">Ministral</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-ministral-gold">Acesso</span>
          </div>

          <div className="flex flex-1 items-center justify-center py-8 sm:py-12 lg:py-16">
            <div className="w-full max-w-[440px]">
              <div className="mb-7 text-left sm:mb-8">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-ministral-gold">Bem-vindo</p>
                <h2 className="text-4xl font-black tracking-tighter text-white">Acesse Ministral</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                  Entre com seus dados para acompanhar suas escalas e coordenar seu ministério.
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:p-8">
                <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-ministral-gold/60" />

                <form onSubmit={handleLoginSubmit} className="space-y-5" aria-label="Formulário de acesso">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail</label>
                    <div className={inputFrameClass}>
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-secondary" aria-hidden="true" />
                      <input
                        id="login-email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="seu@email.com"
                        className={inputClass}
                        disabled={isGlobalLoading}
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        aria-required="true"
                        aria-invalid={!!errorMsg}
                        aria-describedby={errorMsg ? 'login-error' : undefined}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="ml-1 flex items-center justify-between gap-3">
                      <label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Senha</label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={openRecovery}
                        className="-mr-1 text-[10px] font-black uppercase tracking-widest text-secondary/70 hover:text-secondary"
                      >
                        Esqueci minha senha
                      </Button>
                    </div>
                    <div className={inputFrameClass}>
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-secondary" aria-hidden="true" />
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className={`${inputClass} pr-14`}
                        disabled={isGlobalLoading}
                        autoComplete="current-password"
                        required
                        aria-required="true"
                        aria-invalid={!!errorMsg}
                        aria-describedby={errorMsg ? 'login-error' : undefined}
                      />
                      <IconButton
                        type="button"
                        label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:bg-white/5 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </IconButton>
                    </div>
                  </div>

                  {errorMsg && (
                    <div id="login-error" role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-left text-xs font-bold leading-relaxed text-rose-400 animate-slide-up">
                      {errorMsg}
                    </div>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    loading={isGlobalLoading}
                    loadingLabel="Entrando"
                    aria-label="Entrar na conta"
                    className="rounded-2xl border-b-4 border-secondary/30 uppercase tracking-widest text-xs"
                  >
                    <span className="inline-flex items-center gap-2">Entrar agora <ArrowRight size={18} aria-hidden="true" /></span>
                  </Button>

                  <div className="relative flex items-center py-2" aria-label="outras opções de acesso">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="mx-4 flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500">ou</span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    size="lg"
                    loading={isGlobalLoading}
                    loadingLabel="Conectando"
                    onClick={handleGoogleLogin}
                    aria-label="Entrar com conta Google"
                    className="rounded-2xl uppercase tracking-widest text-xs"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Entrar com Google
                    </span>
                  </Button>
                </form>

                {showRecovery && (
                  <div className="absolute inset-0 z-20 flex flex-col justify-center bg-slate-900 p-5 animate-fade-in sm:p-8" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ministral-500/10 text-ministral-500">
                          <Key size={24} aria-hidden="true" />
                        </div>
                        <h3 id="recovery-title" className="text-xl font-black tracking-tighter text-white">Recuperar senha</h3>
                        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-400">
                          Informe seu e-mail para receber um link de redefinição de senha.
                        </p>
                      </div>
                      <IconButton label="Fechar recuperação de senha" size="sm" onClick={closeRecovery} className="-mr-2 -mt-2 text-slate-500 hover:bg-white/5 hover:text-white" />
                    </div>

                    {recoverySuccess ? (
                      <div className="space-y-6">
                        <div className="rounded-2xl border border-ministral-500/20 bg-ministral-500/10 p-4 text-center text-xs font-bold leading-relaxed text-ministral-500">
                          Verifique seu e-mail para redefinir a senha.
                        </div>
                        <Button type="button" variant="ghost" fullWidth onClick={closeRecovery} className="text-xs uppercase tracking-widest text-slate-500 hover:text-white">
                          Voltar ao login
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleRecoverySubmit} className="space-y-6" aria-label="Formulário de recuperação de senha">
                        <div className="space-y-2">
                          <label htmlFor="recovery-email" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail</label>
                          <div className={inputFrameClass}>
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-secondary" aria-hidden="true" />
                            <input
                              id="recovery-email"
                              name="recovery-email"
                              type="email"
                              value={recoveryEmail}
                              onChange={(event) => setRecoveryEmail(event.target.value)}
                              placeholder="seu@email.com"
                              className={inputClass}
                              disabled={recoveryLoading}
                              autoComplete="email"
                              autoCapitalize="none"
                              spellCheck={false}
                              required
                              aria-required="true"
                              aria-describedby={errorMsg ? 'recovery-error' : undefined}
                            />
                          </div>
                        </div>

                        {errorMsg && (
                          <div id="recovery-error" role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-xs font-bold leading-relaxed text-rose-400">
                            {errorMsg}
                          </div>
                        )}

                        <div className="flex flex-col gap-3">
                          <Button type="submit" fullWidth size="lg" loading={recoveryLoading} loadingLabel="Enviando" className="rounded-2xl uppercase tracking-widest text-xs">
                            <span className="inline-flex items-center gap-2">Enviar link <ArrowRight size={18} aria-hidden="true" /></span>
                          </Button>
                          <Button type="button" variant="ghost" fullWidth onClick={closeRecovery} className="text-xs uppercase tracking-widest text-slate-500 hover:text-white">
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              <footer className="mt-7 text-center sm:mt-8">
                <p className="text-xs leading-relaxed text-slate-600">Ao entrar, você concorda com os termos de uso do Ministral.</p>
                <div className="mt-3 flex justify-center gap-6">
                  <Button type="button" variant="link" size="sm" onClick={() => setLegalDoc('terms')} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200">Termos</Button>
                  <Button type="button" variant="link" size="sm" onClick={() => setLegalDoc('privacy')} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200">Privacidade</Button>
                </div>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

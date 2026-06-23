import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  UserPlus,
  AlertOctagon,
  Loader2,
  Mail,
  Lock,
  Phone,
  User,
  Calendar,
  Briefcase,
  Building2,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  validateInviteToken,
  registerWithInvite,
  getSupabase,
  joinMinistry,
  registerWithGoogleInvite,
  processGoogleInviteAfterRedirect,
  clearPendingInvite,
} from "../services/supabaseService";
import { isValidEmail } from "../utils/validation";

interface Props {
  token: string;
  onClear: () => void;
}

export const InviteScreen: React.FC<Props> = ({ token, onClear }) => {
  const [status, setStatus] = useState<
    "loading" | "valid" | "invalid" | "success" | "network_error"
  >("loading");
  const [inviteData, setInviteData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Ministry Data
  const [ministryName, setMinistryName] = useState("");

  // Roles Data
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Form Data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [registering, setRegistering] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [processingGoogleInvite, setProcessingGoogleInvite] = useState(false);

  useEffect(() => {
    const check = async () => {
      const res = await validateInviteToken(token);

      if (res.valid) {
        setInviteData(res.data);
        setStatus("valid");

        if (res.data?.ministryId) {
          setMinistryName(res.data.ministryName || "Ministério");
          if (
            res.data.ministry_functions &&
            res.data.ministry_functions.length > 0
          ) {
            setAvailableRoles(
              res.data.ministry_functions.filter(
                (r: string) =>
                  !r.startsWith("__vocal_count:") &&
                  !r.startsWith("__dance_count:"),
              ),
            );
          } else {
            setAvailableRoles([]);
          }
        }
      } else {
        setErrorMsg(res.message || "Convite inválido");
        setStatus((res as any).isNetworkError ? "network_error" : "invalid");
      }
    };
    check();
  }, [token]);

  // Detecta se o usuário voltou do Google OAuth já autenticado
  useEffect(() => {
    const pendingToken = localStorage.getItem('pending_invite_token');
    if (!pendingToken || pendingToken !== token) return;

    const sb = getSupabase();
    if (!sb) return;

    const checkGoogleAuth = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        // Usuário voltou do Google OAuth com sessão ativa — processar convite
        setProcessingGoogleInvite(true);
        try {
          const result = await processGoogleInviteAfterRedirect();
          if (result.success) {
            setStatus('success');
            // Limpar a URL
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('invite');
              window.history.replaceState({}, '', url.toString());
            } catch (_e) {
              // ignore
            }
            setTimeout(() => onClear(), 2000);
          } else {
            setErrorMsg(result.message || 'Erro ao processar convite com Google.');
          }
        } catch (e: unknown) {
          setErrorMsg(e instanceof Error ? e.message : 'Erro desconhecido.');
        } finally {
          setProcessingGoogleInvite(false);
        }
      }
    };

    checkGoogleAuth();
  }, [token, onClear]);

  const toggleRole = (role: string) => {
    let newRoles;
    if (selectedRoles.includes(role)) {
      newRoles = selectedRoles.filter((r) => r !== role);
    } else {
      newRoles = [...selectedRoles, role];
    }
    setSelectedRoles(newRoles);
  };

  const isFormValid =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 6 &&
    password === confirmPass &&
    whatsapp.trim().length > 0 &&
    birthDate.length > 0 &&
    selectedRoles.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setErrorMsg("Por favor, insira um e-mail válido.");
      return;
    }

    if (!isFormValid) {
      setErrorMsg("Preencha todos os campos e selecione ao menos uma função.");
      return;
    }

    setRegistering(true);
    setErrorMsg("");

    const whatsappRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
    if (whatsapp && !whatsappRegex.test(whatsapp)) {
      setErrorMsg("Formato de WhatsApp inválido. Use (DD) XXXXX-XXXX");
      setRegistering(false);
      return;
    }

    try {
      const res = await registerWithInvite(token, {
        name,
        email,
        password,
        whatsapp,
        birthDate,
        roles: selectedRoles,
      });

      if (res.success) {
        setStatus("success");

        // Limpar a URL após o sucesso (validação e uso concluídos)
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("invite");
          window.history.replaceState({}, "", url.toString());
        } catch (e) {
          console.warn("Não foi possível limpar a URL", e);
        }

        setTimeout(() => {
          onClear();
        }, 2000);
      } else if ((res as any).isExistingUser) {
        setIsExistingUser(true);
        setLoginEmail(email);
        setErrorMsg(res.message || "");
      } else {
        setErrorMsg(res.message || "Erro ao registrar.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Erro desconhecido.");
    } finally {
      setRegistering(false);
    }
  };

  const handleLoginWithInvite = async () => {
    if (!loginEmail || !loginPassword) {
      setErrorMsg("Preencha e-mail e senha para entrar.");
      return;
    }

    setLoginLoading(true);
    setErrorMsg("");

    const sb = getSupabase();
    if (!sb) return;

    try {
      const { error: loginError } = await sb.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (loginError) throw loginError;

      // Se sucesso: aceitar convite
      await joinMinistry(
        inviteData.ministryId,
        inviteData.orgId,
        selectedRoles,
        true,
      );

      // Marcar token como usado
      await sb.from("invite_tokens").update({ used: true }).eq("token", token);

      setStatus("success");
      onClear(); // Limpar convite da URL
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao fazer login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (selectedRoles.length === 0 && availableRoles.length > 0) {
      setErrorMsg('Selecione pelo menos uma função antes de cadastrar com Google.');
      return;
    }
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      const res = await registerWithGoogleInvite(token, selectedRoles);
      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao conectar com Google.');
        setGoogleLoading(false);
      }
      // Se sucesso, o navegador será redirecionado para o Google
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro desconhecido.');
      setGoogleLoading(false);
    }
  };

  const handleGoogleLoginWithInvite = async () => {
    // Para usuários existentes que querem fazer login com Google e aceitar convite
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      const res = await registerWithGoogleInvite(token, selectedRoles);
      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao conectar com Google.');
        setGoogleLoading(false);
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro desconhecido.');
      setGoogleLoading(false);
    }
  };

  if (status === 'loading' || processingGoogleInvite) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-ministral-500 mb-4" size={32} />
        <p className="text-sm font-medium text-zinc-400">
          {processingGoogleInvite ? 'Processando seu cadastro...' : 'Validando convite...'}
        </p>
      </div>
    );
  }

  if (status === "invalid" || status === "network_error") {
    const isNetwork = status === "network_error";
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          {isNetwork ? (
            <RefreshCw className="text-amber-500 animate-spin" size={32} />
          ) : (
            <AlertOctagon className="text-red-500" size={32} />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {isNetwork ? "Erro de Conexão" : "Link Inválido"}
        </h1>
        <p className="text-zinc-400 mb-8 max-w-sm">{errorMsg}</p>
        <div className="flex gap-4">
          {isNetwork && (
            <button
              onClick={() => window.location.reload()}
              className="bg-ministral-500 hover:bg-ministral-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
            >
              Tentar Novamente
            </button>
          )}
          <button
            onClick={onClear}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-ministral-500/10 rounded-full flex items-center justify-center mb-6 animate-slide-up">
          <CheckCircle2 className="text-ministral-500" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Conta Criada!</h1>
        <p className="text-zinc-400 mb-4">Redirecionando para o painel...</p>
        <Loader2 className="animate-spin text-zinc-600" size={20} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-ministral-500/10 rounded-2xl mb-4">
            <UserPlus className="text-ministral-500" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cadastro de Membro
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Complete seus dados para entrar na equipe.
          </p>
        </div>

        {inviteData && (
          <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-ministral-500" />
              <span className="text-white text-sm font-bold">
                Você está entrando em:{" "}
                <span className="text-ministral-400">{ministryName}</span>
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {isExistingUser && (
            <div className="space-y-4 p-6 bg-ministral-gold/10 dark:bg-ministral-gold/20 rounded-2xl border border-ministral-gold/20 animate-slide-up">
              <p className="text-sm font-bold text-ministral-gold dark:text-ministral-gold flex items-center gap-2">
                <AlertOctagon size={16} /> Você já tem uma conta! Faça login
                para aceitar o convite.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-white outline-none focus:ring-1 focus:ring-ministral-gold text-sm"
                    placeholder="Seu e-mail"
                  />
                </div>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-white outline-none focus:ring-1 focus:ring-ministral-gold text-sm"
                    placeholder="Sua senha"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLoginWithInvite}
                  disabled={loginLoading}
                  className="w-full bg-ministral-gold hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Entrar e Aceitar Convite"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExistingUser(false)}
                  className="w-full text-zinc-500 text-[10px] font-bold uppercase hover:text-zinc-400 transition-colors"
                >
                  Voltar para cadastro
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink-0 mx-4 text-zinc-600 text-[9px] font-black uppercase tracking-widest">ou</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLoginWithInvite}
                  disabled={googleLoading}
                  className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Entrar com Google
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!isExistingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  E-mail (Login) *
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  WhatsApp *
                </label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 11) {
                        let formatted = val;
                        if (val.length > 2)
                          formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                        if (val.length > 7)
                          formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                        setWhatsapp(formatted);
                      }
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  Nascimento *
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    required
                  />
                </div>
              </div>

              {/* ROLES SELECTION */}
              <div className="md:col-span-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-3 block flex items-center gap-2">
                  <Briefcase size={12} /> Selecione suas Funções / Cargos *
                </label>

                {loadingRoles ? (
                  <div className="text-center py-4">
                    <Loader2
                      className="animate-spin text-zinc-500 mx-auto"
                      size={20}
                    />
                  </div>
                ) : availableRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map((role) => {
                      const isSelected = selectedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(role)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-ministral-500 text-white border-ministral-500 shadow-md ring-1 ring-ministral-500/50"
                              : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800"
                          }`}
                        >
                          {role}
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-red-400 italic mb-2">
                      Este ministério não possui funções cadastradas.
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Contate o administrador para configurar as funções.
                    </p>
                  </div>
                )}
                {selectedRoles.length === 0 && availableRoles.length > 0 && (
                  <p className="text-[10px] text-red-400 mt-2 ml-1">
                    * Selecione pelo menos uma função.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  Criar Senha *
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm"
                    placeholder="Repita a senha"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              {errorMsg}
            </p>
          )}

          {!isExistingUser && (
            <>
              <button
                type="submit"
                disabled={registering || !isFormValid}
                className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-ministral-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {registering ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <span className="flex items-center gap-2">
                    Finalizar Cadastro <ArrowRight size={16} />
                  </span>
                )}
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-600 text-[9px] font-black uppercase tracking-widest">ou</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading || (availableRoles.length > 0 && selectedRoles.length === 0)}
                className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3.5 rounded-xl shadow-lg shadow-white/5 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Cadastrar com Google
                  </>
                )}
              </button>
              {availableRoles.length > 0 && selectedRoles.length === 0 && (
                <p className="text-[10px] text-zinc-600 text-center">
                  Selecione suas funções acima para habilitar o cadastro com Google.
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
};

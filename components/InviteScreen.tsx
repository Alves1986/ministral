import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, UserPlus, AlertOctagon, Loader2, Mail, Lock, Phone, User, Calendar, Briefcase, Building2, Check, RefreshCw } from 'lucide-react';
import { validateInviteToken, registerWithInvite, getSupabase, joinMinistry } from '../services/supabaseService';
import { isValidEmail } from '../utils/validation';

interface Props {
    token: string;
    onClear: () => void;
}

export const InviteScreen: React.FC<Props> = ({ token, onClear }) => {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'network_error'>('loading');
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
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    useEffect(() => {
        const check = async () => {
            const res = await validateInviteToken(token);
            
            if (res.valid) {
                setInviteData(res.data);
                setStatus('valid');
                
                if (res.data?.ministryId) {
                    setMinistryName(res.data.ministryName || 'Ministério');
                    if (res.data.ministry_functions && res.data.ministry_functions.length > 0) {
                        setAvailableRoles(res.data.ministry_functions.filter((r: string) => !r.startsWith('__vocal_count:')));
                    } else {
                        setAvailableRoles([]);
                    }
                }
            } else {
                setErrorMsg(res.message || "Convite inválido");
                setStatus((res as any).isNetworkError ? 'network_error' : 'invalid');
            }
        };
        check();
    }, [token]);

    const toggleRole = (role: string) => {
        let newRoles;
        if (selectedRoles.includes(role)) {
            newRoles = selectedRoles.filter(r => r !== role);
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
            setErrorMsg('Formato de WhatsApp inválido. Use (DD) XXXXX-XXXX');
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
                roles: selectedRoles
            });

            if (res.success) {
                setStatus('success');
                
                // Limpar a URL após o sucesso (validação e uso concluídos)
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('invite');
                    window.history.replaceState({}, '', url.toString());
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
                password: loginPassword
            });

            if (loginError) throw loginError;

            // Se sucesso: aceitar convite
            await joinMinistry(inviteData.ministryId, inviteData.orgId, selectedRoles);
            
            // Marcar token como usado
            await sb.from('invite_tokens').update({ used: true }).eq('token', token);

            setStatus('success');
            onClear(); // Limpar convite da URL
        } catch (e: any) {
            setErrorMsg(e.message || "Erro ao fazer login.");
        } finally {
            setLoginLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-ministral-500 mb-4" size={32} />
                <p className="text-sm font-medium text-zinc-400">Validando convite...</p>
            </div>
        );
    }

    if (status === 'invalid' || status === 'network_error') {
        const isNetwork = status === 'network_error';
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    {isNetwork ? <RefreshCw className="text-amber-500 animate-spin" size={32} /> : <AlertOctagon className="text-red-500" size={32} />}
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

    if (status === 'success') {
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
                    <h1 className="text-2xl font-bold text-white tracking-tight">Cadastro de Membro</h1>
                    <p className="text-zinc-400 text-sm mt-1">Complete seus dados para entrar na equipe.</p>
                </div>

                {inviteData && (
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 mb-6 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-ministral-500"/>
                            <span className="text-white text-sm font-bold">
                                Você está entrando em: <span className="text-ministral-400">{ministryName}</span>
                            </span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    {isExistingUser && (
                        <div className="space-y-4 p-6 bg-ministral-gold/10 dark:bg-ministral-gold/20 rounded-2xl border border-ministral-gold/20 animate-slide-up">
                            <p className="text-sm font-bold text-ministral-gold dark:text-ministral-gold flex items-center gap-2">
                                <AlertOctagon size={16} /> Você já tem uma conta! Faça login para aceitar o convite.
                            </p>
                            <div className="space-y-3">
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                    <input 
                                        type="email" 
                                        value={loginEmail} 
                                        onChange={e => setLoginEmail(e.target.value)} 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-white outline-none focus:ring-1 focus:ring-ministral-gold text-sm" 
                                        placeholder="Seu e-mail"
                                    />
                                </div>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                    <input 
                                        type="password" 
                                        value={loginPassword} 
                                        onChange={e => setLoginPassword(e.target.value)} 
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
                                    {loginLoading ? <Loader2 className="animate-spin" size={18}/> : 'Entrar e Aceitar Convite'}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setIsExistingUser(false)}
                                    className="w-full text-zinc-500 text-[10px] font-bold uppercase hover:text-zinc-400 transition-colors"
                                >
                                    Voltar para cadastro
                                </button>
                            </div>
                        </div>
                    )}

                    {!isExistingUser && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nome Completo *</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm" 
                                    placeholder="Seu nome"
                                    required
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">E-mail (Login) *</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm" 
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">WhatsApp *</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="tel" 
                                    value={whatsapp} 
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
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
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nascimento *</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="date" 
                                    value={birthDate} 
                                    onChange={e => setBirthDate(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm" 
                                    required
                                />
                            </div>
                        </div>

                        {/* ROLES SELECTION */}
                        <div className="md:col-span-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-3 block flex items-center gap-2">
                                <Briefcase size={12}/> Selecione suas Funções / Cargos *
                            </label>
                            
                            {loadingRoles ? (
                                <div className="text-center py-4"><Loader2 className="animate-spin text-zinc-500 mx-auto" size={20}/></div>
                            ) : availableRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {availableRoles.map(role => {
                                        const isSelected = selectedRoles.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                                    isSelected 
                                                    ? 'bg-ministral-500 text-white border-ministral-500 shadow-md ring-1 ring-ministral-500/50' 
                                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
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
                                    <p className="text-xs text-red-400 italic mb-2">Este ministério não possui funções cadastradas.</p>
                                    <p className="text-[10px] text-zinc-500">Contate o administrador para configurar as funções.</p>
                                </div>
                            )}
                            {selectedRoles.length === 0 && availableRoles.length > 0 && <p className="text-[10px] text-red-400 mt-2 ml-1">* Selecione pelo menos uma função.</p>}
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Criar Senha *</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm" 
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1 block">Confirmar Senha *</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="password" 
                                    value={confirmPass} 
                                    onChange={e => setConfirmPass(e.target.value)} 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:ring-1 focus:ring-ministral-500 text-sm" 
                                    placeholder="Repita a senha"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                )}

                    {errorMsg && <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMsg}</p>}

                    {!isExistingUser && (
                        <button 
                            type="submit" 
                            disabled={registering || !isFormValid}
                            className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-ministral-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {registering ? <Loader2 className="animate-spin" size={18}/> : <span className="flex items-center gap-2">Finalizar Cadastro <ArrowRight size={16}/></span>}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};
import React, { useState } from 'react';
import { ArrowRight, Loader2, Building2, Mail, Lock, Phone, User, CheckCircle2, ChevronLeft, Music } from 'lucide-react';
import { registerNewOrganization } from '../services/supabase/auth';
import { getSystemLogo } from '../utils/branding';
import { isValidEmail } from '../utils/validation';

export const RegisterOrganizationScreen: React.FC = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        churchName: '',
        ministryName: '',
        name: '',
        email: '',
        whatsapp: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    };

    const handleNext = () => {
        if (step === 1) {
            if (!formData.churchName.trim() || !formData.ministryName.trim()) {
                setErrorMsg("Preencha o nome da organização e do ministério.");
                return;
            }
            setErrorMsg("");
            setStep(2);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim() || !formData.email.trim() || !formData.whatsapp.trim() || !formData.password) {
            setErrorMsg("Preencha todos os campos.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setErrorMsg("As senhas não coincidem.");
            return;
        }

        if (formData.password.length < 6) {
            setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (!isValidEmail(formData.email)) {
            setErrorMsg("Por favor, insira um e-mail válido.");
            return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
            const slug = generateSlug(formData.churchName);
            const result = await registerNewOrganization({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                whatsapp: formData.whatsapp,
                churchName: formData.churchName,
                slug: slug,
                ministryName: formData.ministryName
            });

            if (result.success) {
                setSuccess(true);
            } else {
                setErrorMsg(result.message || "Erro ao criar organização.");
            }
        } catch (error: any) {
            setErrorMsg(error.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
                <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2rem] p-8 text-center animate-fade-in shadow-2xl">
                    <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="text-secondary" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Organização Criada!</h2>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                        Sua conta foi criada com sucesso. Você já pode fazer login e começar a gerenciar suas escalas.
                    </p>
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-secondary hover:bg-secondaryHover text-white font-black py-4 rounded-2xl shadow-xl shadow-secondary/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
                    >
                        Fazer Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl overflow-hidden mb-6">
                        <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain p-3 bg-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Nova Organização</h1>
                    <p className="text-slate-400 text-sm">Crie sua conta e comece a gerenciar escalas</p>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                        <div 
                            className="h-full bg-secondary transition-all duration-500 ease-out"
                            style={{ width: step === 1 ? '50%' : '100%' }}
                        />
                    </div>

                    {errorMsg && (
                        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center">
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit}>
                        {step === 1 ? (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Igreja/Organização</label>
                                    <div className="relative group">
                                        <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                        <input 
                                            type="text" 
                                            name="churchName"
                                            value={formData.churchName}
                                            onChange={handleChange}
                                            placeholder="Ex: Igreja Batista Central" 
                                            className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Ministério Inicial</label>
                                    <div className="relative group">
                                        <Music size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                        <input 
                                            type="text" 
                                            name="ministryName"
                                            value={formData.ministryName}
                                            onChange={handleChange}
                                            placeholder="Ex: Ministério de Louvor" 
                                            className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full mt-8 bg-secondary hover:bg-secondaryHover text-white font-black py-4 rounded-2xl shadow-xl shadow-secondary/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                                >
                                    Continuar <ArrowRight size={18}/>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu Nome (Administrador)</label>
                                    <div className="relative group">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                        <input 
                                            type="text" 
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Seu nome completo" 
                                            className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                    <div className="relative group">
                                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                        <input 
                                            type="email" 
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="seu@email.com" 
                                            className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <div className="relative group">
                                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                        <input 
                                            type="tel" 
                                            name="whatsapp"
                                            value={formData.whatsapp}
                                            onChange={handleChange}
                                            placeholder="(00) 00000-0000" 
                                            className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                                        <div className="relative group">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                            <input 
                                                type="password" 
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="••••••" 
                                                className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-10 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar</label>
                                        <div className="relative group">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                            <input 
                                                type="password" 
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="••••••" 
                                                className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-10 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button 
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all active:scale-95"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="flex-1 bg-secondary hover:bg-secondaryHover text-white font-black py-4 rounded-2xl shadow-xl shadow-secondary/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <>Finalizar Cadastro <CheckCircle2 size={18}/></>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <button 
                        onClick={() => window.location.href = '/'} 
                        className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                    >
                        Já tem uma conta? Faça Login
                    </button>
                </div>
            </div>
        </div>
    );
};

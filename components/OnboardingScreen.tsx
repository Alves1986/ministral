import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, Layout, User, Phone, Church, Globe } from 'lucide-react';
import { registerNewOrganization } from '../services/supabaseService';
import { getSystemLogo } from '../utils/branding';

export const OnboardingScreen: React.FC = () => {
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [slug, setSlug] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Auto-generate slug from churchName
  useEffect(() => {
    const formattedSlug = churchName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric with hyphen
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
    
    setSlug(formattedSlug);
  }, [churchName]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminName || !email || !whatsapp || !password || !churchName || !slug) {
      setErrorMsg("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoadingAction(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const result = await registerNewOrganization({
        name: adminName,
        email: email.trim(),
        password: password.trim(),
        whatsapp: whatsapp.trim(),
        churchName: churchName.trim(),
        slug: slug.trim(),
        ministryName: 'Ministério Principal' // Default since it's not in the form
      });

      if (result.success) {
        setSuccessMsg("Conta criada com sucesso. Redirecionando...");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setErrorMsg(result.message || "Erro ao criar conta.");
        setLoadingAction(false);
      }
    } catch (err: any) {
      setErrorMsg("Erro de conexão. Verifique sua internet.");
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row relative overflow-hidden font-sans">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-ministral-500/10 blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ministral-600/10 blur-[120px] animate-pulse"></div>
      </div>

      {/* Hero Section (Left on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative z-10">
          <div>
              <div className="flex items-center gap-3 mb-12">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden bg-white">
                      <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                  <h1 className="text-2xl font-black tracking-widest text-white uppercase">Ministral</h1>
              </div>
              <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter mb-8">
                  Comece sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-ministral-400 to-ministral-200">jornada</span> hoje.
              </h2>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  Transforme a gestão da sua igreja com tecnologia de ponta. Organize ministérios, escalas e membros em um só lugar.
              </p>
          </div>
      </div>

      {/* Form Section (Right on Desktop) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 bg-slate-950/40 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-[500px] py-12">
              <div className="text-center lg:text-left mb-10">
                  <div className="lg:hidden flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-3xl flex items-center justify-center overflow-hidden bg-white">
                          <img src={getSystemLogo('dark')} alt="Logo" className="w-full h-full object-contain p-3" />
                      </div>
                  </div>
                  <h3 className="text-xs font-black text-ministral-500 uppercase tracking-[0.3em] mb-3">Onboarding</h3>
                  <h1 className="text-4xl font-black text-white tracking-tighter">
                      Crie sua conta
                  </h1>
              </div>

              {/* Form Card */}
              <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
                  
                  <form onSubmit={handleOnboardingSubmit} className="space-y-6">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Admin Name */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Administrador</label>
                            <div className="relative group">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                <input 
                                    type="text" 
                                    value={adminName} 
                                    onChange={e => setAdminName(e.target.value)}
                                    placeholder="Seu nome" 
                                    className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                    disabled={loadingAction}
                                />
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                            <div className="relative group">
                                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                                <input 
                                    type="text" 
                                    value={whatsapp} 
                                    onChange={e => setWhatsapp(e.target.value)}
                                    placeholder="(00) 00000-0000" 
                                    className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                    disabled={loadingAction}
                                />
                            </div>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                          <div className="relative group">
                              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type="email" 
                                  value={email} 
                                  onChange={e => setEmail(e.target.value)}
                                  placeholder="seu@email.com" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={loadingAction}
                              />
                          </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                          <div className="relative group">
                              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type={showPassword ? "text" : "password"} 
                                  value={password} 
                                  onChange={e => setPassword(e.target.value)}
                                  placeholder="••••••••" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-12 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={loadingAction}
                              />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                          </div>
                      </div>

                      <div className="h-px bg-white/5 my-2"></div>

                      {/* Church Name */}
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Igreja</label>
                          <div className="relative group">
                              <Church size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type="text" 
                                  value={churchName} 
                                  onChange={e => setChurchName(e.target.value)}
                                  placeholder="Ex: Igreja Central" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={loadingAction}
                              />
                          </div>
                      </div>

                      {/* Slug */}
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identificador (Slug)</label>
                          <div className="relative group">
                              <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-secondary transition-colors" />
                              <input 
                                  type="text" 
                                  value={slug} 
                                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                  placeholder="obpc-central" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={loadingAction}
                              />
                          </div>
                          <p className="text-[9px] text-slate-600 ml-1">Este será o endereço da sua igreja no sistema.</p>
                      </div>

                      {errorMsg && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-slide-up text-center">{errorMsg}</div>}
                      {successMsg && <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold animate-slide-up text-center">{successMsg}</div>}

                      <button 
                          type="submit" 
                          disabled={loadingAction}
                          className="w-full bg-secondary hover:bg-secondaryHover text-white font-black py-4 rounded-2xl shadow-xl shadow-secondary/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                      >
                          {loadingAction ? <Loader2 size={20} className="animate-spin" /> : <>Criar minha conta <ArrowRight size={18}/></>}
                      </button>
                  </form>
              </div>

              <div className="mt-8 text-center">
                  <p className="text-slate-500 text-xs font-bold">
                    Já tem uma conta? <a href="/" className="text-secondary hover:text-secondaryHover transition-colors">Fazer login</a>
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};

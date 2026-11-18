import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { UserIcon, Mail, Briefcase, Save, Key, Camera, Shield, Sparkles, MessageCircle, Download, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { useToast } from './Toast';
import { getSupabase } from '../services/supabase/client';
import { getSavedLocalUserFunctions } from '../utils/swapUtils';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { LegalModal, LegalDocType } from './LegalDocuments';

interface Props {
  user: User;
  onUpdateProfile: (name: string, whatsapp: string, avatar_url?: string, ministry_functions?: string[], birthDate?: string) => Promise<void>;
  availableRoles?: string[];
  events?: any[];
  schedule?: Record<string, string>;
  ministryName?: string;
  ministryId?: string;
}

export const ProfileScreen: React.FC<Props> = ({ user, onUpdateProfile, availableRoles: propAvailableRoles = [], events = [], schedule = {}, ministryName = "Ministério", ministryId }) => {
  const effectiveMinistryId = ministryId || user.ministryId || '';
  const [name, setName] = useState(user.name);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.ministry_functions || []);
  const [availableRoles, setAvailableRoles] = useState<string[]>(propAvailableRoles);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{name?: string; whatsapp?: string}>({});
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  // LGPD Art. 18 & Opt-Out / Opt-In Preferences
  const [aiTrainingOptOut, setAiTrainingOptOut] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`lgpd_ai_opt_out_${user.id || 'default'}`);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [marketingOptIn, setMarketingOptIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`lgpd_marketing_opt_in_${user.id || 'default'}`) === 'true';
    } catch {
      return false;
    }
  });
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (propAvailableRoles && propAvailableRoles.length > 0) {
      setAvailableRoles(propAvailableRoles);
    }
  }, [propAvailableRoles]);

  const myEvents = React.useMemo(() => {
    return events.filter(e => {
        return Object.entries(schedule).some(([key, memberName]) => key.startsWith(`${e.id}|`) && memberName === user.name);
    });
  }, [events, schedule, user.name]);

  useEffect(() => {
    const fetchRoles = async () => {
      const supabase = getSupabase();
      if (!supabase || !user.id || !effectiveMinistryId) return;

      try {
        const { data: settingsData } = await supabase
          .from("ministry_settings")
          .select("roles")
          .eq("ministry_id", effectiveMinistryId)
          .maybeSingle();
        
        if (settingsData?.roles) {
          const cleanRoles = settingsData.roles.filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:'));
          setAvailableRoles(cleanRoles);
        }

        const { data: memberRows } = await supabase
          .from("ministry_members")
          .select("functions")
          .eq("profile_id", user.id)
          .eq("ministry_id", effectiveMinistryId);

        const localSaved = getSavedLocalUserFunctions(effectiveMinistryId, user.id);

        if (Array.isArray(memberRows) && memberRows.length > 0) {
          const allFuncs = Array.from(
            new Set([
              ...memberRows.flatMap((row: { functions?: string[] | null }) =>
                Array.isArray(row.functions) ? row.functions : []
              ),
              ...(Array.isArray(localSaved) ? localSaved : []),
            ])
          );
          const cleanFunctions = allFuncs.filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:'));
          setSelectedRoles(cleanFunctions);
        } else if (Array.isArray(localSaved)) {
          const cleanFunctions = localSaved.filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:'));
          setSelectedRoles(cleanFunctions);
        }
      } catch (error) {
        console.error("Erro ao buscar funções:", error);
      }
    };

    fetchRoles();
  }, [user.id, effectiveMinistryId]);

  useEffect(() => {
    setName(user.name);
    setWhatsapp(user.whatsapp || '');
    setAvatar(user.avatar_url || '');
    setBirthDate(user.birthDate || '');
    if (Array.isArray(user.ministry_functions)) {
      setSelectedRoles(user.ministry_functions);
    }
  }, [user]);

  const validateField = (field: 'name' | 'whatsapp', value: string) => {
    let error = '';
    if (field === 'name' && !value.trim()) {
      error = 'O nome é obrigatório';
    } else if (field === 'whatsapp' && value && !/^\(\d{2}\) \d{5}-\d{4}$/.test(value)) {
      error = 'Formato: (00) 00000-0000';
    }
    setFieldErrors(prev => ({ ...prev, [field]: error || undefined }));
    return !error;
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250; 
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        addToast("A imagem deve ter no máximo 2MB.", "error");
        return;
      }

      try {
        const compressedBase64 = await compressImage(file);
        setAvatar(compressedBase64);
        addToast("Nova foto carregada! Salve para confirmar.", "info");
      } catch (err) {
        addToast("Erro ao processar imagem.", "error");
      }
    }
  };

  const toggleRole = (role: string) => {
    const isAdmin = user.access_role === 'admin' || user.isOrgAdmin || user.isSuperAdmin;
    if (role.toLowerCase().includes('ministro') && !isAdmin && !selectedRoles.includes(role)) {
        addToast("Solicitação enviada ao administrador.", "info");
        import('../services/supabase/notifications').then(({ notifySuperAdmins }) => {
            if (user.ministryId && user.organizationId) {
                notifySuperAdmins(
                    'Solicitação de Função: Ministro',
                    `O membro ${user.name} solicitou a função de Ministro. Você pode adicioná-lo acessando o menu Membros.`,
                    undefined,
                    user.ministryId,
                    user.organizationId,
                    'info'
                );
            }
        }).catch(console.error);
        return;
    }

    if (selectedRoles.includes(role)) {
        setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
        setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return addToast("O nome é obrigatório", "error");
    
    const whatsappRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
    if (whatsapp && !whatsappRegex.test(whatsapp)) {
      return addToast("Formato de WhatsApp inválido. Use (DD) XXXXX-XXXX", "error");
    }
    
    setLoading(true);
    try {
      const avatarToSend = avatar !== (user.avatar_url || '') ? avatar : undefined;
      await onUpdateProfile(name, whatsapp, avatarToSend, selectedRoles, birthDate);
    } catch (e) {
      addToast("Erro ao atualizar perfil", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacyPrefs = async (nextAiOptOut: boolean, nextMarketing: boolean) => {
    setAiTrainingOptOut(nextAiOptOut);
    setMarketingOptIn(nextMarketing);
    try {
      localStorage.setItem(`lgpd_ai_opt_out_${user.id || 'default'}`, String(nextAiOptOut));
      localStorage.setItem(`lgpd_marketing_opt_in_${user.id || 'default'}`, String(nextMarketing));
      const sb = getSupabase();
      if (sb && user.id) {
        await sb.auth.updateUser({
          data: {
            ai_training_opt_out: nextAiOptOut,
            marketing_opt_in: nextMarketing,
            privacy_updated_at: new Date().toISOString(),
          },
        });
      }
      addToast("Preferências de privacidade (LGPD) atualizadas!", "success");
    } catch {
      addToast("Preferências salvas localmente.", "info");
    }
  };

  // Portabilidade de Dados (LGPD art. 18, II e V)
  const handleExportPersonalData = async (format: 'json' | 'csv') => {
    setExportingData(true);
    try {
      const sb = getSupabase();
      let dbProfile: any = null;
      let dbAvailability: any[] = [];
      let dbSwaps: any[] = [];

      if (sb && user.id) {
        const [profRes, availRes, swapRes] = await Promise.all([
          sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          sb.from('availability').select('*').eq('profile_id', user.id),
          sb.from('swap_requests').select('*').eq('requester_id', user.id),
        ]);
        dbProfile = profRes.data;
        dbAvailability = availRes.data || [];
        dbSwaps = swapRes.data || [];
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        legalBasis: 'LGPD Art. 18 (Acesso e Portabilidade de Dados Pessoais)',
        profile: {
          id: user.id,
          name,
          email: user.email,
          whatsapp,
          birthDate,
          accessRole: user.access_role,
          ministryFunctions: selectedRoles,
          organizationId: user.organizationId,
          ministryId: effectiveMinistryId,
          aiTrainingOptOut,
          marketingOptIn,
          ...(dbProfile || {}),
        },
        scheduledEvents: myEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          date: e.iso,
        })),
        availabilityRecords: dbAvailability,
        swapRequests: dbSwaps,
      };

      let blob: Blob;
      let filename: string;
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'json') {
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        filename = `meus-dados-ministral-${dateStr}.json`;
      } else {
        const rows = [
          ['Campo', 'Valor'],
          ['ID', user.id || ''],
          ['Nome', name || ''],
          ['E-mail', user.email || ''],
          ['WhatsApp', whatsapp || ''],
          ['Data de Nascimento', birthDate || ''],
          ['Papel de Acesso', user.access_role || ''],
          ['Funções no Ministério', selectedRoles.join('; ')],
          ['Opt-out Treino de IA', aiTrainingOptOut ? 'Sim' : 'Não'],
          ['Opt-in Marketing', marketingOptIn ? 'Sim' : 'Não'],
          ['Total de Escalas Ativas', String(myEvents.length)],
          ['Exportado em (UTC)', payload.exportedAt],
        ];
        const csvContent = rows
          .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        filename = `meus-dados-ministral-${dateStr}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(`Seus dados foram exportados em ${format.toUpperCase()}!`, "success");
    } catch (e) {
      console.error("Erro ao exportar dados:", e);
      addToast("Erro ao exportar dados pessoais.", "error");
    } finally {
      setExportingData(false);
    }
  };

  // Exclusão de Conta e Dados Pessoais pelo Titular (LGPD art. 18, VI)
  const handleDeleteOwnAccount = async () => {
    setDeletingAccount(true);
    try {
      const sb = getSupabase();
      if (!sb || !user.id) throw new Error("Sessão não encontrada.");

      // Remove vínculos operacionais e dados pessoais não sujeitos a retenção fiscal obrigatória
      await Promise.allSettled([
        sb.from('ministry_members').delete().eq('profile_id', user.id),
        sb.from('availability').delete().eq('profile_id', user.id),
        sb.from('push_subscriptions').delete().eq('user_id', user.id),
        sb.from('profiles').delete().eq('id', user.id),
      ]);

      localStorage.clear();
      await sb.auth.signOut();
      addToast("Sua conta e seus dados pessoais foram excluídos.", "success");
      window.location.href = '/';
    } catch (e: any) {
      console.error("Erro ao excluir conta:", e);
      addToast("Erro ao processar exclusão: " + (e.message || "Tente novamente."), "error");
      setDeletingAccount(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12 overflow-hidden">
      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />
      
      <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-4">
          <div className="h-20 md:h-24 bg-gradient-to-r from-ministral-600 via-ministral-500 to-ministral-dark relative">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>

          <div className="px-4 pb-4 relative">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-3 -mt-8 md:-mt-10 mb-2">
                  <div 
                    role="button"
                    tabIndex={0}
                    aria-label="Alterar foto do perfil"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }
                    }}
                    className="relative group cursor-pointer shrink-0"
                  >
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-3 border-white dark:border-zinc-800 shadow-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center relative z-10">
                        {avatar ? (
                          <img src={avatar} alt={`Foto de perfil de ${user.name}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                            <UserIcon size={28} />
                          </div>
                        )}
                      </div>
                      
                      <div className="absolute inset-0 z-20 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity backdrop-blur-[2px]">
                        <Camera className="text-white drop-shadow-md" size={20} />
                      </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    accept="image/jpeg,image/png,image/webp" 
                    aria-label="Upload de foto do perfil"
                    className="hidden" 
                  />

                  <div className="flex-1 text-center md:text-left mb-1 w-full">
                      <h1 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white flex items-center justify-center md:justify-start gap-2 truncate">
                          {user.name} 
                          {user.access_role === 'admin' && <Shield size={15} className="text-ministral-500 dark:text-white fill-ministral-500/20"/>}
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                          {user.access_role === 'admin' ? 'Administrador do Sistema' : 'Membro da Equipe'}
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <UserIcon size={15}/> Dados Pessoais
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-0.5">
                              Nome Completo <span className="text-red-500">*</span>
                          </label>
                          <div className="relative group">
                              <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.name ? 'text-red-500' : 'text-zinc-400 group-focus-within:text-ministral-500'}`} size={16} />
                              <input 
                                  type="text" 
                                  value={name} 
                                  onChange={e => setName(e.target.value)}
                                  onBlur={() => validateField('name', name)}
                                  aria-invalid={!!fieldErrors.name}
                                  aria-describedby={fieldErrors.name ? 'error-name' : undefined}
                                  className={`w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border rounded-lg focus:ring-2 focus:ring-ministral-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-medium placeholder:text-zinc-400 ${
                                      fieldErrors.name ? 'border-red-500 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700/50'
                                  }`}
                              />
                          </div>
                          {fieldErrors.name && <p id="error-name" className="text-xs text-red-500 mt-1" role="alert">{fieldErrors.name}</p>}
                      </div>

                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-0.5 flex items-center justify-between">
                              WhatsApp
                          </label>
                          <div className="relative group">
                              <MessageCircle className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.whatsapp ? 'text-red-500' : 'text-zinc-400 group-focus-within:text-emerald-500'}`} size={16} />
                              <input 
                                  type="text" 
                                  value={whatsapp} 
                                  placeholder="(00) 00000-0000"
                                  onChange={e => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      if (val.length <= 11) {
                                          let formatted = val;
                                          if (val.length > 2) formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                                          if (val.length > 7) formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                                          setWhatsapp(formatted);
                                      }
                                  }}
                                  onBlur={() => validateField('whatsapp', whatsapp)}
                                  aria-invalid={!!fieldErrors.whatsapp}
                                  aria-describedby={fieldErrors.whatsapp ? 'error-whatsapp' : undefined}
                                  className={`w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-medium placeholder:text-zinc-400 ${
                                      fieldErrors.whatsapp ? 'border-red-500 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700/50'
                                  }`}
                              />
                          </div>
                          {fieldErrors.whatsapp && <p id="error-whatsapp" className="text-xs text-red-500 mt-1" role="alert">{fieldErrors.whatsapp}</p>}
                      </div>

                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-0.5">Data de Nascimento</label>
                          <div className="relative group">
                              <input 
                                  type="date" 
                                  value={birthDate} 
                                  onChange={e => setBirthDate(e.target.value)}
                                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg focus:ring-2 focus:ring-ministral-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-medium placeholder:text-zinc-400"
                              />
                          </div>
                      </div>

                      <div className="space-y-1 opacity-70">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-0.5 flex items-center gap-1">E-mail (Login) <Key size={10}/></label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                              <input 
                                  type="email" 
                                  value={user.email || ''} 
                                  disabled
                                  className="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 cursor-not-allowed text-xs sm:text-sm"
                              />
                          </div>
                      </div>
                  </div>
              </div>

              <button 
                  type="submit" 
                  disabled={loading}
                  className="hidden lg:flex w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-2.5 rounded-lg shadow-md shadow-ministral-500/20 items-center justify-center gap-2 text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {loading ? 'Salvando Alterações...' : <><Save size={16}/> Salvar Perfil</>}
              </button>
          </div>

          <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col">
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                      <Briefcase size={15}/> Minhas Funções
                  </h3>
                  <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                      Selecione as funções que você exerce na equipe. Algumas funções requerem aprovação.
                  </p>
                  
                  <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                          {availableRoles.length === 0 ? (
                              <div className="w-full py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                  <p className="text-zinc-400 text-sm italic">Configure as funções nas Configurações do ministério para selecionar aqui.</p>
                              </div>
                          ) : availableRoles.map(role => {
                              const isSelected = selectedRoles.includes(role);
                              return (
                                  <button
                                      key={role}
                                      type="button"
                                      onClick={() => toggleRole(role)}
                                      className={`group relative px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                                          isSelected 
                                          ? 'bg-accent/10 dark:bg-accent/20 border-accent/50 text-accent dark:text-accent shadow-sm ring-1 ring-accent/20' 
                                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                      }`}
                                  >
                                      {role}
                                      {isSelected && <Sparkles size={14} className="text-accent" />}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              </div>

              <button 
                  type="submit" 
                  disabled={loading}
                  className="lg:hidden w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-ministral-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {loading ? 'Salvando...' : <><Save size={20}/> Salvar Perfil</>}
              </button>
          </div>
      </form>

      <div className="mt-8">
          <GoogleCalendarSettings myEvents={myEvents} allEvents={events} ministryName={ministryName} />
      </div>

      {/* Central de Privacidade e Direitos do Titular (LGPD art. 18, art. 8 §4 e Opt-Out de IA) */}
      <div className="mt-8 bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-700 pb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center gap-2">
              <Shield size={17} className="text-ministral-500" /> Privacidade e Proteção de Dados (LGPD — Art. 18)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Gerencie seus consentimentos, baixe uma cópia integral dos seus dados ou solicite a exclusão da sua conta.
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => setLegalDoc('terms')} className="text-ministral-500 hover:underline font-bold flex items-center gap-1">
              <FileText size={13} /> Termos de Uso
            </button>
            <button type="button" onClick={() => setLegalDoc('privacy')} className="text-ministral-500 hover:underline font-bold flex items-center gap-1">
              <Shield size={13} /> Política de Privacidade
            </button>
          </div>
        </div>

        {/* Controles de Opt-Out de IA e Opt-In de Marketing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-700/60 cursor-pointer">
            <input
              type="checkbox"
              checked={aiTrainingOptOut}
              onChange={(e) => handleSavePrivacyPrefs(e.target.checked, marketingOptIn)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-ministral-500 focus:ring-ministral-500"
            />
            <div className="text-xs">
              <span className="font-bold text-zinc-800 dark:text-zinc-100 block">
                Não usar meus dados para treinamento de IA (Opt-Out ativo)
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                Seus dados pessoais nunca são vendidos nem usados para treinar modelos públicos de Inteligência Artificial.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-700/60 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => handleSavePrivacyPrefs(aiTrainingOptOut, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-ministral-500 focus:ring-ministral-500"
            />
            <div className="text-xs">
              <span className="font-bold text-zinc-800 dark:text-zinc-100 block">
                Comunicações opcionais de novidades (Opt-In de Marketing)
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                Desmarque a qualquer momento para cancelar o recebimento de comunicados promocionais (1 clique).
              </span>
            </div>
          </label>
        </div>

        {/* Portabilidade e Exclusão */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportingData}
              onClick={() => handleExportPersonalData('json')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Download size={15} /> Baixar Meus Dados (JSON)
            </button>
            <button
              type="button"
              disabled={exportingData}
              onClick={() => handleExportPersonalData('csv')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Download size={15} /> Baixar Meus Dados (CSV)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
          >
            <Trash2 size={15} /> Excluir Minha Conta e Dados
          </button>
        </div>

        {confirmDeleteOpen && (
          <div role="alertdialog" aria-labelledby="delete-account-title" className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 space-y-3 animate-fade-in">
            <div className="flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
              <div>
                <p id="delete-account-title" className="font-bold text-sm">Confirmar exclusão permanente da conta (LGPD art. 18, VI)</p>
                <p className="mt-1">
                  Esta ação removerá imediatamente seu perfil, funções, disponibilidades e inscrições de notificações. Serão mantidos apenas registros obrigatórios por lei (Marco Civil da Internet / obrigações fiscais).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deletingAccount}
                className="px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteOwnAccount}
                disabled={deletingAccount}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingAccount ? 'Excluindo...' : 'Confirmar Exclusão Definitiva'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

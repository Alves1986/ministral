import React, { useState, useEffect, useMemo } from 'react';
import { 
    Building2, Users, Layers, Activity, Plus, Edit2, 
    ToggleLeft, ToggleRight, Search, Loader2, Trash2, CreditCard, Lock, Link as LinkIcon,
    MessageSquare, BarChart3, Clock, Crown, ShieldAlert, Wifi, RefreshCw, Megaphone, Send,
    Headset, ShieldCheck, Gauge, AlertTriangle, CheckCircle2, Ticket
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../services/supabase/client';
import { Organization } from '../types';
import { fetchOrganizationsWithStats, saveOrganization, toggleOrganizationStatus, saveOrganizationMinistry, deleteOrganizationMinistry, deleteOrganizationSQL, notifyAllOrganizationAdmins, fetchGlobalUsers } from '../services/supabaseService';
import { checkMinistryLimit } from '../services/supabase/admin';
import { useToast } from './Toast';
import { getSystemLogo } from '../utils/branding';
import { GlobalWhatsAppConnect } from './GlobalWhatsAppConnect';

export const SuperAdminDashboard: React.FC<{ activeTab?: string }> = ({ activeTab = 'sa-organizations' }) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchUserTerm, setSearchUserTerm] = useState("");
    
    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState("");
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [broadcastType, setBroadcastType] = useState("info");
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    const handleSendBroadcast = async () => {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            addToast("Preencha o título e a mensagem", "warning");
            return;
        }

        if (!confirm("Tem certeza que deseja enviar este comunicado para TODOS os administradores de todas as organizações? Essa ação não pode ser desfeita.")) {
            return;
        }

        setSendingBroadcast(true);
        try {
            const { error } = await notifyAllOrganizationAdmins(broadcastTitle, broadcastMessage, broadcastType);
            if (error) throw error;
            addToast("Comunicado enviado globalmente com sucesso!", "success");
            setBroadcastTitle("");
            setBroadcastMessage("");
            setBroadcastType("info");
        } catch (e: any) {
            addToast(e.message || "Erro ao enviar comunicado global", "error");
        } finally {
            setSendingBroadcast(false);
        }
    };

    // Telemetria detalhada de WhatsApp
    const { data: usageLogs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
        queryKey: ['super_admin_whatsapp_logs'],
        queryFn: async () => {
            const sb = getSupabase();
            if (!sb) return [];
            const { data } = await sb
                .from('whatsapp_usage_logs')
                .select(`
                    id,
                    created_at,
                    organization_id,
                    ministry_id,
                    instance_name,
                    organizations ( name ),
                    organization_ministries ( label )
                `)
                .order('created_at', { ascending: false });
            return data || [];
        }
    });

    const logsByOrg = useMemo(() => {
        const map: Record<string, { name: string, count: number, ministries: Record<string, { label: string, count: number }> }> = {};
        usageLogs.forEach((log: any) => {
            const orgData = Array.isArray(log.organizations) ? log.organizations[0] : log.organizations;
            const minData = Array.isArray(log.organization_ministries) ? log.organization_ministries[0] : log.organization_ministries;
            
            const orgId = log.organization_id || 'unknown';
            const orgName = orgData?.name || `Org #${orgId}`;
            const minLabel = minData?.label || `Min #${log.ministry_id}`;
            
            if (!map[orgId]) {
                map[orgId] = { name: orgName, count: 0, ministries: {} };
            }
            map[orgId].count++;
            
            if (!map[orgId].ministries[log.ministry_id]) {
                map[orgId].ministries[log.ministry_id] = { label: minLabel, count: 0 };
            }
            map[orgId].ministries[log.ministry_id].count++;
        });
        return Object.entries(map).map(([id, val]) => ({ id, ...val }));
    }, [usageLogs]);

    const last24hCount = useMemo(() => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return usageLogs.filter((log: any) => new Date(log.created_at).getTime() > oneDayAgo).length;
    }, [usageLogs]);

    const { data: globalUsers = [], isLoading: loadingUsers } = useQuery({
        queryKey: ['super_admin_global_users'],
        queryFn: fetchGlobalUsers,
        enabled: activeTab === 'sa-users'
    });

    const billingStats = useMemo(() => {
        let proCount = 0;
        let enterpriseCount = 0;
        let trialCount = 0;
        let mrr = 0;

        organizations.forEach(org => {
            if (!org.active) return;
            if (org.plan_type === 'pro') {
                proCount++;
                if(org.billing_status !== 'trialing') mrr += 49.90;
            } else if (org.plan_type === 'enterprise') {
                enterpriseCount++;
                if(org.billing_status !== 'trialing') mrr += 99.90;
            } else if (org.billing_status === 'trialing' || org.plan_type === 'trial') {
                trialCount++;
            }
        });

        return { proCount, enterpriseCount, trialCount, mrr };
    }, [organizations]);

    // Support tickets hook
    const [globalTickets, setGlobalTickets] = useState<any[]>([]);
    const [activeTicket, setActiveTicket] = useState<any | null>(null);
    const [replyContent, setReplyContent] = useState("");

    const loadTickets = () => {
        try {
            const t = JSON.parse(localStorage.getItem('ministral_support_tickets') || '[]');
            setGlobalTickets(t.sort((a:any, b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            if(activeTicket) {
                const updated = t.find((x:any) => x.id === activeTicket.id);
                if(updated) setActiveTicket(updated);
            }
        } catch { }
    };

    useEffect(() => {
        if (activeTab === 'sa-support') {
            loadTickets();
            const interval = setInterval(loadTickets, 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, activeTicket?.id]);

    const handleReplyTicket = (e: React.FormEvent, statusChange?: 'resolved' | 'in_progress') => {
        e.preventDefault();
        if(!activeTicket) return;
        
        try {
            const all = JSON.parse(localStorage.getItem('ministral_support_tickets') || '[]');
            const tIndex = all.findIndex((t:any) => t.id === activeTicket.id);
            if(tIndex === -1) return;
            
            if (replyContent.trim()) {
                all[tIndex].replies.push({
                    id: 'RPL-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                    authorName: 'Equipe Ministral (Super Admin)',
                    isSuperAdmin: true,
                    content: replyContent,
                    createdAt: new Date().toISOString()
                });
            }

            if (statusChange) {
                all[tIndex].status = statusChange;
            } else if (all[tIndex].status === 'open') {
                all[tIndex].status = 'in_progress';
            }
            
            localStorage.setItem('ministral_support_tickets', JSON.stringify(all));
            setReplyContent("");
            loadTickets();
        } catch {}
    };

    const ticketsOpen = globalTickets.filter(t => t.status === 'open').length;
    const ticketsCritical = globalTickets.filter(t => t.priority === 'critical' && t.status !== 'resolved').length;
    const ticketsResolved = globalTickets.filter(t => t.status === 'resolved').length;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState<any>({ name: "", slug: "" });
    const [saving, setSaving] = useState(false);

    const [newMinistryCode, setNewMinistryCode] = useState("");
    const [newMinistryLabel, setNewMinistryLabel] = useState("");
    const [ministrySaving, setMinistrySaving] = useState(false);

    const { addToast, confirmAction } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchOrganizationsWithStats();
        setOrganizations(data);
        setLoading(false);
    };

    const handleEdit = (org: Organization) => {
        setEditingOrg(org);
        setFormData({ 
            name: org.name, 
            slug: org.slug || "",
            plan_type: org.plan_type || 'trial',
            billing_status: org.billing_status || 'active',
            trial_ends_at: org.trial_ends_at || '',
            checkout_url: org.checkout_url || '',
            access_locked: org.access_locked || false
        });
        setNewMinistryCode("");
        setNewMinistryLabel("");
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingOrg(null);
        setFormData({ name: "", slug: "", plan_type: 'trial', billing_status: 'trial' });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return addToast("Nome é obrigatório", "error");

        setSaving(true);
        const res = await saveOrganization(editingOrg?.id || null, formData.name, formData.slug, formData);
        
        if (res.success) {
            addToast(res.message, "success");
            if(!editingOrg) setIsModalOpen(false); 
            loadData();
        } else {
            addToast(res.message, "error");
        }
        setSaving(false);
    };

    const handleAddMinistry = async () => {
        if (!editingOrg) return;
        if (!newMinistryCode || !newMinistryLabel) return addToast("Preencha código e nome.", "warning");

        const plan = editingOrg.plan_type || 'trial';
        if (plan !== 'enterprise') {
            const check = await checkMinistryLimit(editingOrg.id, plan);
            if (!check.allowed) {
                addToast(check.reason || 'Limite atingido', 'error');
                return;
            }
        }

        setMinistrySaving(true);
        const res = await saveOrganizationMinistry(editingOrg.id, newMinistryCode, newMinistryLabel);
        if (res.success) {
            addToast(res.message, "success");
            setNewMinistryCode("");
            setNewMinistryLabel("");
            const data = await fetchOrganizationsWithStats();
            setOrganizations(data);
            const updatedOrg = data.find(o => o.id === editingOrg.id);
            if (updatedOrg) setEditingOrg(updatedOrg);
        } else {
            addToast(res.message, "error");
        }
        setMinistrySaving(false);
    };

    const handleDeleteMinistry = async (code: string) => {
        if (!editingOrg) return;
        confirmAction("Remover Ministério", `Isso pode quebrar o acesso de usuários vinculados ao ministério '${code}'. Continuar?`, async () => {
            const res = await deleteOrganizationMinistry(editingOrg.id, code);
            if (res.success) {
                addToast("Ministério removido.", "info");
                const data = await fetchOrganizationsWithStats();
                setOrganizations(data);
                const updatedOrg = data.find(o => o.id === editingOrg.id);
                if (updatedOrg) setEditingOrg(updatedOrg);
            } else {
                addToast(res.message, "error");
            }
        });
    };

    const handleToggleStatus = async (org: Organization) => {
        const newStatus = !org.active;
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, active: newStatus } : o));
        
        const success = await toggleOrganizationStatus(org.id, newStatus);
        if (!success) {
            addToast("Erro ao atualizar status", "error");
            loadData();
        }
    };

    const handleCopyRegisterLink = () => {
        const link = `${window.location.origin}?register=true`;
        navigator.clipboard.writeText(link).then(() => {
            addToast("Link de cadastro copiado para a área de transferência!", "success");
        }).catch(() => {
            addToast("Erro ao copiar o link.", "error");
        });
    };

    const handleDeleteOrganization = (org: Organization) => {
        confirmAction(
            "Excluir Organização",
            `Tem certeza que deseja excluir a organização "${org.name}"? Esta ação apagará todos os dados vinculados a ela e não pode ser desfeita.`,
            async () => {
                const res = await deleteOrganizationSQL(org.id);
                if (res.success) {
                    addToast("Organização excluída com sucesso.", "success");
                    loadData();
                } else {
                    addToast(res.message || "Erro ao excluir organização.", "error");
                }
            }
        );
    };

    const filteredOrgs = organizations.filter(o => 
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.slug && o.slug.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-28">
            {activeTab === 'sa-whatsapp' && (
                <GlobalWhatsAppConnect />
            )}
            
            {activeTab === 'sa-organizations' && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                <Building2 className="text-purple-600"/> Gestão Global
                            </h2>
                            <p className="text-zinc-500 text-sm mt-1">Administração de Organizações (Multi-Tenant)</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleCopyRegisterLink}
                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 border border-zinc-200 dark:border-zinc-700"
                                title="Copiar link público de cadastro"
                            >
                                <LinkIcon size={18}/> Link de Cadastro
                            </button>
                            <button 
                                onClick={handleCreate}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-600/20"
                            >
                                <Plus size={18}/> Nova Organização
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                                <Building2 size={24}/>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Organizações</p>
                                <p className="text-2xl font-bold text-zinc-800 dark:text-white">{organizations.length}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                <Users size={24}/>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Total de Usuários</p>
                                <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                                    {organizations.reduce((acc, curr) => acc + (curr.userCount || 0), 0)}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-secondary/10 dark:bg-secondary/20 rounded-lg text-secondary">
                                <Activity size={24}/>
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Ativas</p>
                                <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                                    {organizations.filter(o => o.active).length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar organização..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                                <Loader2 className="animate-spin mb-2" size={32}/> Carregando...
                            </div>
                        ) : filteredOrgs.length === 0 ? (
                            <div className="p-12 text-center text-zinc-400">Nenhuma organização encontrada.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 uppercase text-xs font-bold">
                                        <tr>
                                            <th className="px-6 py-3">Nome / Slug</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                            <th className="px-6 py-3 text-center">Plano</th>
                                            <th className="px-6 py-3 text-center">Usuários</th>
                                            <th className="px-6 py-3 text-center">Ministérios</th>
                                            <th className="px-6 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                                        {filteredOrgs.map(org => (
                                            <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className='flex items-center gap-2'>
                                                        <img
                                                            src={org.logo_url || getSystemLogo('light')}
                                                            alt={org.name}
                                                            className='w-7 h-7 rounded-lg object-contain bg-white border border-zinc-100 dark:border-zinc-700 p-0.5 shrink-0'
                                                            onError={(e) => { 
                                                                const fallback = getSystemLogo('light');
                                                                if (!e.currentTarget.src.endsWith(fallback)) {
                                                                    e.currentTarget.src = fallback;
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{org.name}</p>
                                                            <p className="text-xs text-zinc-500">{org.slug || '-'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => handleToggleStatus(org)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-colors ${org.active ? 'bg-secondary/10 text-secondary border-secondary/20 dark:bg-secondary/20 dark:text-secondary dark:border-secondary/30' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
                                                        {org.active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                                                        {org.active ? 'Ativo' : 'Inativo'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${org.plan_type === 'enterprise' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : org.plan_type === 'pro' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                                                        {org.plan_type || 'Trial'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                        <Users size={12}/> {org.userCount || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                                                        <Layers size={12}/> {org.ministryCount || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleEdit(org)}
                                                            className="p-2 text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                            title="Editar Organização"
                                                        >
                                                            <Edit2 size={16}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteOrganization(org)}
                                                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Excluir Organização"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'sa-broadcast' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-start gap-4 mb-8">
                            <div className="p-4 bg-ministral-500/10 rounded-2xl shrink-0">
                                <Megaphone className="text-ministral-500" size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-zinc-800 dark:text-white">Comunicado Global</h2>
                                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                    Envie uma notificação in-app (e push, se habilitado) para <strong>todos os administradores de todas as organizações</strong>.
                                    Ideal para avisos de manutenção, novas atualizações e alertas do sistema.
                                </p>
                            </div>
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                    Título do Comunicado
                                </label>
                                <input
                                    type="text"
                                    value={broadcastTitle}
                                    onChange={e => setBroadcastTitle(e.target.value)}
                                    placeholder="Ex: Atualização Importante do Sistema"
                                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-ministral-500 focus:border-transparent outline-none transition-all dark:text-white placeholder:text-zinc-400 font-medium"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                    Mensagem
                                </label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={e => setBroadcastMessage(e.target.value)}
                                    placeholder="Detalhes do aviso..."
                                    rows={5}
                                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-ministral-500 focus:border-transparent outline-none transition-all dark:text-white placeholder:text-zinc-400 font-medium resize-y"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                    Tipo de Alerta
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { id: 'info', label: 'Informativo', color: 'bg-blue-500' },
                                        { id: 'success', label: 'Sucesso/Novidade', color: 'bg-emerald-500' },
                                        { id: 'warning', label: 'Aviso Importante', color: 'bg-amber-500' },
                                        { id: 'error', label: 'Crítico/Problema', color: 'bg-red-500' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setBroadcastType(t.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                                                broadcastType === t.id 
                                                ? `${t.color} border-transparent text-white shadow-lg shadow-black/10 scale-[1.02]` 
                                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                                            }`}
                                        >
                                            <div className={`w-2.5 h-2.5 rounded-full ${broadcastType === t.id ? 'bg-white' : t.color}`} />
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-700/50 flex justify-end">
                                <button
                                    onClick={handleSendBroadcast}
                                    disabled={sendingBroadcast}
                                    className="flex items-center gap-2 px-6 py-3 bg-ministral-500 hover:bg-ministral-600 active:scale-95 text-white rounded-xl font-bold transition-all shadow-lg shadow-ministral-500/20 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    {sendingBroadcast ? (
                                        <><Loader2 className="animate-spin" size={20}/> Enviando...</>
                                    ) : (
                                        <><Send size={20}/> Disparar para Todos</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sa-telemetry' && (
                <div className="space-y-6 animate-slide-up">
                    {/* Telemetry Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-[#0f1f3d] to-[#1a2d52] p-6 rounded-3xl border border-[#c9a84c]/20 shadow-xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10"><MessageSquare size={80} /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a84c] bg-[#c9a84c]/10 px-2.5 py-1 rounded-full border border-[#c9a84c]/20">Geral</span>
                            <p className="text-sm font-bold text-slate-300 mt-4 uppercase tracking-wider">Total de Mensagens WhatsApp</p>
                            <p className="text-4xl font-black mt-2 text-white">{usageLogs.length}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5"><Building2 size={80} /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">Alcance</span>
                            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-4 uppercase tracking-wider">Igrejas Utilizando</p>
                            <p className="text-4xl font-black mt-2 text-zinc-800 dark:text-white">{logsByOrg.length}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5"><Clock size={80} /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">Atividade</span>
                            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-4 uppercase tracking-wider">Últimas 24 Horas</p>
                            <p className="text-4xl font-black mt-2 text-zinc-800 dark:text-white">{last24hCount}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Top Organizations Chart */}
                        <div className="lg:col-span-6 bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <h3 className="text-base font-black text-zinc-800 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 size={18} className="text-[#c9a84c]" /> Volumetria por Igreja
                            </h3>

                            {logsByOrg.length === 0 ? (
                                <p className="text-sm text-zinc-400 italic text-center py-12">Nenhum log de disparo registrado.</p>
                            ) : (
                                <div className="space-y-4">
                                    {logsByOrg.slice(0, 5).map((org: any) => {
                                        const percentage = usageLogs.length > 0 ? Math.round((org.count / usageLogs.length) * 100) : 0;
                                        return (
                                            <div key={org.id} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-zinc-700 dark:text-zinc-300">{org.name}</span>
                                                    <span className="text-zinc-500">{org.count} disparos ({percentage}%)</span>
                                                </div>
                                                <div className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-full h-3 overflow-hidden">
                                                    <div 
                                                        className="bg-gradient-to-r from-[#0f1f3d] to-[#c9a84c] h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Breakdown per Ministry */}
                        <div className="lg:col-span-6 bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <h3 className="text-base font-black text-zinc-800 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={18} className="text-blue-500" /> Distribuição por Ministério
                            </h3>

                            {logsByOrg.length === 0 ? (
                                <p className="text-sm text-zinc-400 italic text-center py-12">Nenhuma distribuição ativa.</p>
                            ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                                    {logsByOrg.map((org: any) => (
                                        <div key={org.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                                            <h4 className="text-xs font-black text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-2 border-b border-zinc-200/50 dark:border-zinc-800 pb-1">{org.name}</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(org.ministries).map(([minId, min]: any) => (
                                                    <div key={minId} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800/50 text-[11px] font-bold">
                                                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{min.label}</span>
                                                        <span className="px-1.5 py-0.5 rounded bg-[#c9a84c]/10 text-[#c9a84c] shrink-0 font-extrabold">{min.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detailed Activity Logs */}
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="text-sm font-black text-zinc-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Clock size={16} className="text-purple-500" /> Log em Tempo Real (Últimos 50 Envios)
                            </h3>
                            <button 
                                onClick={() => refetchLogs()}
                                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                {loadingLogs ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                                Atualizar
                            </button>
                        </div>

                        {loadingLogs ? (
                            <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                                <Loader2 className="animate-spin mb-2" size={32}/> Carregando Logs...
                            </div>
                        ) : usageLogs.length === 0 ? (
                            <div className="p-12 text-center text-zinc-400">Nenhum log registrado ainda.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 uppercase text-[10px] font-black tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Data / Hora</th>
                                            <th className="px-6 py-3">Organização</th>
                                            <th className="px-6 py-3">Ministério</th>
                                            <th className="px-6 py-3 text-center">Instância</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50 font-medium">
                                        {usageLogs.slice(0, 50).map((log: any) => (
                                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                                <td className="px-6 py-3.5 text-zinc-500">
                                                    {new Date(log.created_at).toLocaleString('pt-BR', {
                                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-6 py-3.5 font-bold text-zinc-800 dark:text-zinc-200">
                                                    {(Array.isArray(log.organizations) ? log.organizations[0]?.name : log.organizations?.name) || `Org #${log.organization_id}`}
                                                </td>
                                                <td className="px-6 py-3.5 text-zinc-600 dark:text-zinc-400 font-bold">
                                                    {(Array.isArray(log.organization_ministries) ? log.organization_ministries[0]?.label : log.organization_ministries?.label) || `Min #${log.ministry_id}`}
                                                </td>
                                                <td className="px-6 py-3.5 text-center">
                                                    <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                        {log.instance_name || 'Desconhecida'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3.5 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">
                                                        Sucesso
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'sa-billing' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">MRR Estimado</h3>
                                <div className="p-2 bg-emerald-500/10 rounded-xl">
                                    <CreditCard size={20} className="text-emerald-500" />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                                R$ {billingStats.mrr.toFixed(2).replace('.', ',')}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 font-medium">Assinaturas ativas cobradas</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">Plano Pro</h3>
                            </div>
                            <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                                {billingStats.proCount}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 font-medium">Contas baseadas no Pro</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">Acesso Enterprise</h3>
                            </div>
                            <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                                {billingStats.enterpriseCount}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 font-medium">Soluções dedicadas ativas</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">Trials Ativos</h3>
                            </div>
                            <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                                {billingStats.trialCount}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 font-medium">Novos clientes em teste</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sa-users' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Users className="text-ministral-500" size={24} /> 
                                    Gestão Global de Usuários
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Busque rapidamente qualquer usuário do sistema independente da organização</p>
                            </div>
                            <div className="relative w-full md:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou email..."
                                    value={searchUserTerm}
                                    onChange={(e) => setSearchUserTerm(e.target.value)}
                                    className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white"
                                />
                            </div>
                        </div>

                        {loadingUsers ? (
                            <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                                <Loader2 className="animate-spin mb-2" size={32} />
                                <p>Carregando diretório de usuários...</p>
                            </div>
                        ) : (
                            <div className="w-full overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                                            <th className="px-6 py-4 rounded-tl-2xl">Usuário</th>
                                            <th className="px-6 py-4">Organização</th>
                                            <th className="px-6 py-4 text-center">Permissão</th>
                                            <th className="px-6 py-4">Último Login</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {globalUsers
                                            .filter((u: any) => u.name?.toLowerCase().includes(searchUserTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchUserTerm.toLowerCase()))
                                            .slice(0, 100) // Limite de 100 resultados
                                            .map((u: any) => (
                                                <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-ministral-500/10 flex items-center justify-center text-ministral-500 font-bold shrink-0">
                                                                {u.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-zinc-900 dark:text-white">{u.name}</div>
                                                                <div className="text-sm text-zinc-500">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-zinc-900 dark:text-white font-medium">
                                                            {u.organizations?.name || <span className="text-zinc-500 italic">Sem Organização</span>}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {u.is_super_admin ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider border border-purple-500/20">
                                                                <Crown size={12} /> Super
                                                            </span>
                                                        ) : u.is_admin ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-ministral-500/10 text-ministral-600 dark:text-ministral-400 text-xs font-black uppercase tracking-wider border border-ministral-500/20">
                                                                Admin
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                                                Membro
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-zinc-500">
                                                        {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : 'Desconhecido'}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'sa-support' && (
                <div className="space-y-6 animate-slide-up">
                    {activeTicket ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
                            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-800/20">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-mono text-zinc-500 font-bold text-xs">{activeTicket.id}</span>
                                        {activeTicket.status === 'open' ? <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">Aberto</span> :
                                        activeTicket.status === 'in_progress' ? <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">Em Andamento</span> :
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500">Resolvido</span>}
                                        <span className="text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{activeTicket.orgName}</span>
                                    </div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">{activeTicket.subject}</h3>
                                    <p className="text-sm text-zinc-500 mt-1">Aberto por {activeTicket.authorName} em {new Date(activeTicket.createdAt).toLocaleString('pt-BR')}</p>
                                </div>
                                <button onClick={() => setActiveTicket(null)} className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                    X
                                </button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-zinc-50/50 dark:bg-zinc-900/50">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-zinc-500">
                                        {activeTicket.authorName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 p-4 rounded-b-2xl rounded-tr-2xl shadow-sm relative">
                                        <span className="absolute -top-3 left-4 text-xs font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-2 rounded-full">{activeTicket.authorName}</span>
                                        <p className="text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">{activeTicket.description}</p>
                                    </div>
                                </div>

                                {activeTicket.replies?.map((reply:any) => (
                                    <div key={reply.id} className={`flex gap-4 ${reply.isSuperAdmin ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${reply.isSuperAdmin ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                            {reply.isSuperAdmin ? <Headset size={18} /> : reply.authorName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={`border p-4 shadow-sm relative ${reply.isSuperAdmin ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/20 rounded-b-2xl rounded-tl-2xl' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/50 rounded-b-2xl rounded-tr-2xl'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-bold text-sm text-zinc-900 dark:text-white">{reply.isSuperAdmin ? 'Suporte Técnico' : reply.authorName}</span>
                                                <span className="text-xs text-zinc-400">{new Date(reply.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                {activeTicket.status === 'resolved' ? (
                                    <div className="text-center p-3 text-emerald-600 font-medium flex items-center justify-center gap-2 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                                        <CheckCircle2 size={18} /> Resolvido. O cliente não pode mais enviar mensagens aqui.
                                    </div>
                                ) : (
                                    <form onSubmit={handleReplyTicket} className="flex gap-3">
                                        <input type="text" value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Digite sua resposta..." className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"/>
                                        <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 shrink-0">Enviar (Em Andamento)</button>
                                        <button type="button" onClick={(e) => handleReplyTicket(e, 'resolved')} className="px-6 py-3 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shrink-0 flex items-center gap-2"><CheckCircle2 size={18}/> Resolver</button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                                        <Headset size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-zinc-900 dark:text-white">Help Desk Central</h3>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gerencie chamados de suporte técnico de todas as organizações</p>
                                    </div>
                                </div>
                                <button onClick={loadTickets} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold transition-all text-sm">
                                    <RefreshCw size={16} /> Atualizar Fila
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                                    <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">Abertos</div>
                                    <div className="text-3xl font-black text-zinc-900 dark:text-white">{ticketsOpen}</div>
                                </div>
                                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                                    <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">Criticos</div>
                                    <div className="text-3xl font-black text-red-500">{ticketsCritical}</div>
                                </div>
                                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                                    <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">Resolvidos</div>
                                    <div className="text-3xl font-black text-emerald-500">{ticketsResolved}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {globalTickets.length === 0 ? (
                                    <div className="p-12 text-center flex flex-col items-center border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50">
                                        <Ticket size={48} className="text-zinc-300 dark:text-zinc-600 mb-4" />
                                        <h4 className="font-bold text-zinc-800 dark:text-white text-lg">Fila Vazia</h4>
                                        <p className="text-zinc-500 mt-2 max-w-md">Nenhum chamado de suporte encontrado. Bom trabalho!</p>
                                    </div>
                                ) : (
                                    globalTickets.map((ticket:any) => (
                                        <div key={ticket.id} onClick={() => setActiveTicket(ticket)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-5 cursor-pointer transition-all group flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                                                    <MessageSquare size={20} className={ticket.status === 'resolved' ? 'text-emerald-500' : 'text-blue-500'} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-zinc-500 font-bold text-xs">{ticket.id}</span>
                                                        <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">{ticket.orgName}</span>
                                                        {ticket.priority === 'critical' ? <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500"><AlertCircle size={10}/> Crítica</span> :
                                                         ticket.priority === 'high' ? <span className="text-[10px] font-black uppercase text-orange-500">Alta</span> : null}
                                                    </div>
                                                    <h4 className="font-bold text-zinc-900 dark:text-white">{ticket.subject}</h4>
                                                    <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{ticket.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4 flex flex-col items-end gap-2">
                                                {ticket.status === 'open' ? <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">Aberto</span> :
                                                 ticket.status === 'in_progress' ? <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">Em Andamento</span> :
                                                 <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Resolvido</span>}
                                                <span className="text-xs text-zinc-400 font-medium flex items-center gap-1"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'sa-audit' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center shrink-0">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">Security & Audit Trail</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Monitoramento global de eventos críticos da plataforma</p>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar eventos..."
                                    className="w-full md:w-64 pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Evento</th>
                                        <th className="px-6 py-4">Org / Usuário</th>
                                        <th className="px-6 py-4">Ação / Ip</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-6 py-4 text-sm text-zinc-500 font-mono text-xs">Exibição Mock - Audit Log requer Supabase RLS policies especificas.</td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400">auth.login</span></td>
                                        <td className="px-6 py-4 font-medium text-sm text-zinc-900 dark:text-white">System Admin</td>
                                        <td className="px-6 py-4 text-sm font-mono text-zinc-500">192.168.1.1</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/30">
                                <ShieldAlert size={32} className="text-zinc-400 mx-auto mb-3" />
                                <p className="text-zinc-500 font-medium max-w-md mx-auto">Para armazenamento forense persistente dos logs, os webhooks do Supabase precisam estar direcionados para um endpoint dedicado do Applet (ou serviço de Log).</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sa-quotas' && (
                <div className="space-y-6 animate-slide-up">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                        <div className="flex flex-col gap-4 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                                    <Gauge size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">Rate Limiting & Quotas</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Monitoramento de uso de recursos das Organizações</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                        <MessageSquare size={18} className="text-emerald-500" /> WhatsApp API
                                    </h4>
                                    <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg">Saudável</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Mensagens Enviadas (Total)</span>
                                        <span className="font-mono text-zinc-900 dark:text-white font-medium">{usageLogs.length}</span>
                                    </div>
                                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (usageLogs.length / 5000) * 100)}%` }}></div>
                                    </div>
                                    <span className="text-xs text-zinc-500">Uso atual da quota global</span>
                                </div>
                            </div>
                            
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                        <Users size={18} className="text-amber-500" /> Usuários
                                    </h4>
                                    <span className="text-xs font-bold px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg">Monitorando</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500">Total Global de Usuários</span>
                                        <span className="font-mono text-zinc-900 dark:text-white font-medium">{globalUsers.length}</span>
                                    </div>
                                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (globalUsers.length / 1000) * 100)}%` }}></div>
                                    </div>
                                    <span className="text-xs text-zinc-500">Contabilizando inscritos em todas as organizações</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-white">
                                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Nome da Organização</label>
                                    <input 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                        placeholder="Ex: Igreja Central"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Slug</label>
                                    <input 
                                        value={formData.slug}
                                        onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    />
                                </div>

                                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                                    <h4 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2 text-sm uppercase">
                                        <CreditCard size={14}/> Assinatura & Controle
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Plano</label>
                                            <select 
                                                value={formData.plan_type}
                                                onChange={e => setFormData({...formData, plan_type: e.target.value})}
                                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none text-zinc-800 dark:text-white"
                                            >
                                                <option value="trial">Trial</option>
                                                <option value="pro">Pro</option>
                                                <option value="enterprise">Enterprise</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Status Pagamento</label>
                                            <select 
                                                value={formData.billing_status}
                                                onChange={e => setFormData({...formData, billing_status: e.target.value})}
                                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none text-zinc-800 dark:text-white"
                                            >
                                                <option value="active">Ativo</option>
                                                <option value="trial">Em Teste</option>
                                                <option value="past_due">Atrasado</option>
                                                <option value="canceled">Cancelado</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Fim do Trial (Data)</label>
                                        <input 
                                            type="datetime-local"
                                            value={formData.trial_ends_at ? new Date(formData.trial_ends_at).toISOString().slice(0, 16) : ''}
                                            onChange={e => setFormData({...formData, trial_ends_at: new Date(e.target.value).toISOString()})}
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none"
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Checkout URL (Link Pagamento)</label>
                                        <input 
                                            value={formData.checkout_url}
                                            onChange={e => setFormData({...formData, checkout_url: e.target.value})}
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none"
                                            placeholder="https://stripe..."
                                        />
                                    </div>

                                    <div 
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.access_locked ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900' : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700'}`}
                                        onClick={() => setFormData({...formData, access_locked: !formData.access_locked})}
                                    >
                                        <div className={formData.access_locked ? 'text-red-500' : 'text-zinc-400'}>
                                            <Lock size={18}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Bloquear Acesso</p>
                                            <p className="text-xs text-zinc-500">Impede login de todos os membros.</p>
                                        </div>
                                        <div className="ml-auto">
                                            {formData.access_locked ? <ToggleRight className="text-red-500" size={20}/> : <ToggleLeft className="text-zinc-400" size={20}/>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={saving}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saving && <Loader2 className="animate-spin" size={14}/>}
                                        Salvar Dados
                                    </button>
                                </div>
                            </form>

                            {editingOrg && (
                                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                                    <h4 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Layers size={18}/> Ministérios da Organização
                                    </h4>
                                    
                                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Código (ID)</label>
                                                <input 
                                                    value={newMinistryCode}
                                                    onChange={e => setNewMinistryCode(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                                    placeholder="ex: jovens"
                                                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                                                />
                                            </div>
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Nome Exibição</label>
                                                <input 
                                                    value={newMinistryLabel}
                                                    onChange={e => setNewMinistryLabel(e.target.value)}
                                                    placeholder="ex: Ministério de Jovens"
                                                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                                                />
                                            </div>
                                            <button 
                                                onClick={handleAddMinistry}
                                                disabled={ministrySaving}
                                                className="w-full sm:w-auto bg-secondary hover:bg-secondaryHover text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                                            >
                                                {ministrySaving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {editingOrg.ministries && editingOrg.ministries.length > 0 ? (
                                            editingOrg.ministries.map(min => (
                                                <div key={min.code} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg shadow-sm">
                                                    <div>
                                                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{min.label}</p>
                                                        <p className="text-xs text-zinc-500 font-mono">{min.code}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteMinistry(min.code)}
                                                        className="text-zinc-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-sm text-zinc-400 py-4 italic">Nenhum ministério cadastrado.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};
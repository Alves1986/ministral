import React, { useState, useEffect } from 'react';
import { 
    Building2, Users, Layers, Activity, Plus, Edit2, 
    ToggleLeft, ToggleRight, Search, Loader2, Trash2, CreditCard, Lock, Link as LinkIcon
} from 'lucide-react';
import { Organization } from '../types';
import { fetchOrganizationsWithStats, saveOrganization, toggleOrganizationStatus, saveOrganizationMinistry, deleteOrganizationMinistry, deleteOrganizationSQL } from '../services/supabaseService';
import { checkMinistryLimit } from '../services/supabase/admin';
import { useToast } from './Toast';
import { getSystemLogo } from '../utils/branding';

export const SuperAdminDashboard: React.FC = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
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
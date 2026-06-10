import React, { useState, useEffect } from 'react';
import { Headset, Plus, Clock, MessageSquare, Ticket, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { User } from '../types';
import { fetchSupportTickets, createSupportTicket, updateSupportTicket, deleteSupportTicket } from '../services/supabase/support';
import { useToast } from './Toast';

export interface SupportTicket {
  id: string;
  orgId: string;
  orgName: string;
  authorId: string;
  authorName: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  replies: {
    id: string;
    authorName: string;
    isSuperAdmin: boolean;
    content: string;
    createdAt: string;
  }[];
}

export const SupportAdminScreen: React.FC<{ orgId: string, user: User, orgName: string }> = ({ orgId, user, orgName }) => {
    const { addToast } = useToast();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<'low'|'medium'|'high'|'critical'>('medium');

    const [replyContent, setReplyContent] = useState("");

    const refresh = async () => {
        const all: any = await fetchSupportTickets();
        setTickets(all.filter((t: any) => t.orgId === orgId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        if (activeTicket) {
            const updated = all.find((t: any) => t.id === activeTicket.id);
            if (updated) setActiveTicket(updated);
        }
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [orgId, activeTicket?.id]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const created = await createSupportTicket(orgId, orgName, user.id, user.name, subject, description, priority);
        if (created) {
            addToast("Chamado criado com sucesso!", "success");
            setIsCreating(false);
            setSubject("");
            setDescription("");
            setPriority("medium");
            refresh();
        } else {
            addToast("Erro ao criar chamado.", "error");
        }
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!activeTicket || !replyContent.trim()) return;
        
        const newReply = {
            id: 'RPL-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            authorName: user.name,
            isSuperAdmin: user.isSuperAdmin || false,
            content: replyContent,
            createdAt: new Date().toISOString()
        };
        
        const updatedReplies = [...(activeTicket.replies || []), newReply];
        const success = await updateSupportTicket(activeTicket.id, { replies: updatedReplies });
        
        if (success) {
            setReplyContent("");
            refresh();
        } else {
            addToast("Falha ao enviar resposta.", "error");
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.")) {
            const success = await deleteSupportTicket(id);
            if (success) {
                addToast("Chamado excluído.", "success");
                if (activeTicket?.id === id) setActiveTicket(null);
                refresh();
            } else {
                addToast("Erro ao excluir chamado.", "error");
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-2 md:p-0 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight">
                        <Headset className="text-ministral-500" size={32} /> Help Desk / Suporte
                    </h2>
                    <p className="text-zinc-500 mt-2">Precisa de ajuda ou encontrou um problema? Abra um chamado diretamente com a equipe técnica.</p>
                </div>
                {!isCreating && !activeTicket && (
                    <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-5 py-2.5 bg-ministral-500 hover:bg-ministral-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-ministral-500/20 active:scale-95">
                        <Plus size={20} /> Novo Chamado
                    </button>
                )}
            </div>

            {isCreating ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 animate-slide-up relative overflow-hidden">
                    <button onClick={() => setIsCreating(false)} className="absolute top-6 right-6 p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6">Abrir Novo Chamado</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Assunto</label>
                            <input required type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Problema ao fechar escala" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white transition-all"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Prioridade</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white transition-all">
                                <option value="low">Baixa</option>
                                <option value="medium">Média</option>
                                <option value="high">Alta</option>
                                <option value="critical">Crítica (Sistema inoperante)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Descrição Detalhada</label>
                            <textarea required rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema com o máximo de detalhes..." className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white transition-all resize-none"></textarea>
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-6 py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-ministral-500 text-white hover:bg-ministral-600 transition-colors shadow-lg shadow-ministral-500/20">Enviar Chamado</button>
                        </div>
                    </form>
                </div>
            ) : activeTicket ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-800/20">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-zinc-500 font-bold text-xs">{activeTicket.id}</span>
                                {activeTicket.status === 'open' ? <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">Aberto</span> :
                                activeTicket.status === 'in_progress' ? <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">Em Andamento</span> :
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500">Resolvido</span>}
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">{activeTicket.subject}</h3>
                            <p className="text-sm text-zinc-500 mt-1">Aberto em {new Date(activeTicket.createdAt).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={(e) => handleDelete(e, activeTicket.id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Excluir Chamado">
                                <X size={20} />
                            </button>
                            <button onClick={() => setActiveTicket(null)} className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-zinc-50/50 dark:bg-zinc-900/50">
                        {/* Original description */}
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-zinc-500">
                                {activeTicket.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 p-4 rounded-b-2xl rounded-tr-2xl shadow-sm relative">
                                <span className="absolute -top-3 left-4 text-xs font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-2 rounded-full">{activeTicket.authorName}</span>
                                <p className="text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">{activeTicket.description}</p>
                            </div>
                        </div>

                        {/* Replies */}
                        {activeTicket.replies.map(reply => (
                            <div key={reply.id} className={`flex gap-4 ${reply.isSuperAdmin ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${reply.isSuperAdmin ? 'bg-ministral-500 text-white shadow-lg shadow-ministral-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                    {reply.isSuperAdmin ? <Headset size={18} /> : reply.authorName.charAt(0).toUpperCase()}
                                </div>
                                <div className={`border p-4 shadow-sm relative ${reply.isSuperAdmin ? 'bg-ministral-50 dark:bg-ministral-900/10 border-ministral-200 dark:border-ministral-500/20 rounded-b-2xl rounded-tl-2xl' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/50 rounded-b-2xl rounded-tr-2xl'}`}>
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
                            <div className="text-center p-3 text-emerald-600 font-medium flex items-center justify-center gap-2">
                                <CheckCircle2 size={18} /> Este chamado foi marcado como resolvido. Não é possível enviar novas mensagens.
                            </div>
                        ) : (
                            <form onSubmit={handleReply} className="flex gap-3">
                                <input required type="text" value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Digite sua resposta..." className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white transition-all"/>
                                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-ministral-500 text-white hover:bg-ministral-600 transition-colors shadow-lg shadow-ministral-500/20 shrink-0">Enviar</button>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {tickets.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                                <Ticket size={32} className="text-zinc-400" />
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Nenhum chamado aberto</h3>
                            <p className="text-zinc-500 mt-2 max-w-md">Seu histórico de suporte está vazio. Precisando de ajuda, clique no botão para abrir um novo chamado.</p>
                        </div>
                    ) : (
                        tickets.map(ticket => (
                            <div key={ticket.id} onClick={() => setActiveTicket(ticket)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-ministral-500 dark:hover:border-ministral-500 rounded-2xl p-5 cursor-pointer transition-all group flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                                        <MessageSquare size={20} className={ticket.status === 'resolved' ? 'text-emerald-500' : 'text-ministral-500'} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-zinc-500 font-bold text-xs">{ticket.id}</span>
                                            {ticket.priority === 'critical' ? <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500"><AlertCircle size={10}/> Crítica</span> :
                                             ticket.priority === 'high' ? <span className="text-[10px] font-black uppercase text-orange-500">Alta</span> : null}
                                        </div>
                                        <h4 className="font-bold text-zinc-900 dark:text-white">{ticket.subject}</h4>
                                        <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{ticket.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 shrink-0 ml-4">
                                    <div className="text-right flex flex-col items-end gap-2">
                                        {ticket.status === 'open' ? <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">Aberto</span> :
                                         ticket.status === 'in_progress' ? <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">Em Andamento</span> :
                                         <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Resolvido</span>}
                                        <span className="text-xs text-zinc-400 font-medium flex items-center gap-1"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <button onClick={(e) => handleDelete(e, ticket.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="Excluir Chamado">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

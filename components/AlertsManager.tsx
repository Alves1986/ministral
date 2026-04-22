
import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Megaphone, Send, Info, CheckCircle, AlertTriangle, AlertOctagon, CalendarClock, Sparkles, Loader2, Youtube, ExternalLink } from 'lucide-react';
import { useToast } from './Toast';
import { runAI, AI_TASKS } from '../services/aiOrchestrator';
import { RichTextEditor } from './RichTextEditor';

interface Props {
  onSend: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert', expirationDate: string, externalLink?: string) => Promise<void>;
  orgName: string;
  ministryName: string;
  members: any[];
  roles: string[];
}

export const AlertsManager: React.FC<Props> = ({ onSend, orgName, ministryName, members, roles }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'alert'>('info');
  const [durationDays, setDurationDays] = useState(7); // Default 7 days
  const [isSending, setIsSending] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  
  const { addToast } = useToast();

  const getAIContext = () => ({
    organization_name: orgName,
    ministry_name: ministryName,
    total_members: members.length,
    active_members: members.filter(m => m.status !== 'inactive').length,
    roles: roles
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      addToast("Preencha o título e a mensagem.", "error");
      return;
    }

    setIsSending(true);
    try {
        // Calcula a data de expiração
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + durationDays);
        const expirationIso = expirationDate.toISOString();

        // ALTERAÇÃO 3 — await direto sem timeout
        await onSend(title, message, type, expirationIso, externalLink.trim() || undefined);

        setTitle("");
        setMessage("");
        setExternalLink("");
        setType('info');
        addToast("Aviso enviado para toda a equipe!", "success");
    } catch (error: any) {
        console.error("[AlertsManager] Failed to send announcement:", error);
        addToast(error?.message || 'Falha ao enviar aviso.', "error");
    } finally {
        setIsSending(false);
    }
  };

  const handlePolish = async (tone: 'professional' | 'exciting' | 'urgent') => {
      if(!message.trim()) {
          addToast("Digite uma mensagem para melhorar.", "warning");
          return;
      }
      
      setIsPolishing(true);
      try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = message;
          const plainText = tempDiv.textContent || tempDiv.innerText || "";
          
          const refined = await runAI(AI_TASKS.TEXT_REWRITE, getAIContext(), { text: plainText, tone });
          const newHtml = refined?.html || refined;
          setMessage(newHtml);
          addToast("Texto melhorado com IA!", "success");
      } catch (error) {
          console.error("AI Polish error:", error);
          addToast("Erro ao processar com IA.", "error");
      } finally {
          setIsPolishing(false);
      }
  };

  const getIcon = (t: string) => {
      switch(t) {
          case 'success': return <CheckCircle size={20} className="text-green-500"/>;
          case 'warning': return <AlertTriangle size={20} className="text-amber-500"/>;
          case 'alert': return <AlertOctagon size={20} className="text-red-500"/>;
          default: return <Info size={20} className="text-blue-500"/>;
      }
  };

  const getBgColor = (t: string) => {
      switch(t) {
          case 'success': return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30';
          case 'warning': return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30';
          case 'alert': return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30';
          default: return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30';
      }
  };

  // Link Extraction for Preview
  const extractedLinks = (() => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = message;
      const linksFoundText: string[] = [];
      
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      const textMatches = tempDiv.innerText.match(urlRegex) || [];
      
      const anchorTags = Array.from(tempDiv.querySelectorAll('a'));
      anchorTags.forEach(a => {
          if (a.href) linksFoundText.push(a.href);
      });
      
      textMatches.forEach(url => {
          if (!linksFoundText.includes(url)) linksFoundText.push(url);
      });

      const uniqueLinks = [...new Set(linksFoundText)];
      
      // Adiciona o link externo se preenchido e já não estiver na lista
      if (externalLink && externalLink.trim()) {
          const trimmed = externalLink.trim();
          if (!uniqueLinks.includes(trimmed)) {
              uniqueLinks.unshift(trimmed);
          }
      }

      return uniqueLinks.map(url => {
          const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
          const match = url.match(ytRegex);
          return {
              url,
              isYoutube: !!match,
              youtubeId: match ? match[1] : undefined
          };
      });
  })();

  // Clean message for preview: Aggressively remove URLs and <a> tags from the text
  const cleanMessagePreview = (() => {
      let msg = message || "O conteúdo aparecerá aqui.";
      msg = msg.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '');
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      msg = msg.replace(urlRegex, '');
      msg = msg.replace(/<p>\s*<\/p>/gi, '');
      msg = msg.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
      return msg;
  })();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <Megaphone className="text-ministral-500"/> Central de Avisos
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Envie notificações importantes para o painel de todos os membros.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulário */}
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Novo Aviso</h3>
            <form onSubmit={handleSend} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Título</label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ex: Ensaio Cancelado"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none focus:ring-ministral-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Tipo de Alerta</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'info', icon: <Info size={18}/>, label: 'Info', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
                            { id: 'success', icon: <CheckCircle size={18}/>, label: 'Bom', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
                            { id: 'warning', icon: <AlertTriangle size={18}/>, label: 'Atenção', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
                            { id: 'alert', icon: <AlertOctagon size={18}/>, label: 'Urgente', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setType(opt.id as any)}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                    type === opt.id 
                                    ? `border-current ${opt.color} ring-1 ring-current` 
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {opt.icon}
                                <span className="text-[10px] font-bold mt-1">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Duração do Aviso (Validade)</label>
                    <div className="relative">
                        <CalendarClock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <select 
                            value={durationDays} 
                            onChange={e => setDurationDays(Number(e.target.value))}
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ministral-500 text-zinc-900 dark:text-zinc-100"
                        >
                            <option value={3}>3 dias</option>
                            <option value={7}>7 dias (1 Semana)</option>
                            <option value={15}>15 dias</option>
                            <option value={30}>30 dias (1 Mês)</option>
                        </select>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">O aviso será removido automaticamente dos painéis após este período.</p>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Link Externo (Opcional)</label>
                    <div className="relative">
                        <ExternalLink size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input 
                            type="url" 
                            value={externalLink}
                            onChange={e => setExternalLink(e.target.value)}
                            placeholder="https://exemplo.com ou link do YouTube"
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg py-3 pl-10 pr-3 text-sm outline-none focus:ring-ministral-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                        />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">O link será exibido como um botão destacado abaixo da mensagem.</p>
                </div>

                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Mensagem</label>
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex gap-1">
                                <button type="button" onClick={() => handlePolish('professional')} disabled={isPolishing} className="text-[10px] text-ministral-500 hover:bg-ministral-50 px-2 py-0.5 rounded border border-ministral-200 dark:border-ministral-900/30 disabled:opacity-50 font-bold">Formal</button>
                                <button type="button" onClick={() => handlePolish('exciting')} disabled={isPolishing} className="text-[10px] text-secondary hover:bg-secondary/10 px-2 py-0.5 rounded border border-secondary/30 disabled:opacity-50 font-bold">Animado</button>
                                <button type="button" onClick={() => handlePolish('urgent')} disabled={isPolishing} className="text-[10px] text-red-500 hover:bg-red-50 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/30 disabled:opacity-50 font-bold">Urgente</button>
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <RichTextEditor 
                            value={message}
                            onChange={setMessage}
                            placeholder="Digite o aviso aqui..."
                            className="min-h-[150px]"
                        />
                        {isPolishing && (
                            <div className="absolute right-3 bottom-3">
                                <Loader2 className="animate-spin text-ministral-500" size={16} />
                            </div>
                        )}
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSending}
                    className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-ministral-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                >
                    {isSending ? 'Enviando...' : <><Send size={18}/> Enviar Aviso</>}
                </button>
            </form>
        </div>

        {/* Preview */}
        <div>
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Pré-visualização</h3>
            <div className="bg-zinc-100 dark:bg-zinc-900/50 p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center min-h-[400px]">
                {title || message ? (
                    <div className={`w-full max-w-sm p-4 rounded-xl border shadow-sm h-fit ${getBgColor(type)}`}>
                        <div className="flex gap-3">
                            <div className="mt-1 shrink-0">{getIcon(type)}</div>
                            <div className="w-full min-w-0">
                                <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
                                    {title || "Título do Aviso"}
                                </h4>
                                <div 
                                    className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-a:hidden whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanMessagePreview, {
                                        ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3'],
                                        ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class']
                                    }) }}
                                />

                                {/* Link Previews */}
                                {extractedLinks.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                                            <ExternalLink size={8} /> Recursos Externos
                                        </p>
                                        {extractedLinks.map((link, idx) => (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between p-2 bg-white/40 dark:bg-black/20 rounded border border-black/5 dark:border-white/5 transition-all">
                                                    <div className="flex items-center gap-2 truncate">
                                                        {link.isYoutube ? <Youtube size={14} className="text-red-500" /> : <ExternalLink size={12} className="text-zinc-400" />}
                                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-300 truncate font-semibold italic">Link Detectado</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20 uppercase">Acessar</span>
                                                </div>
                                                {link.isYoutube && link.youtubeId && (
                                                    <div className="aspect-video w-full rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-black/10 overflow-hidden relative">
                                                         <img 
                                                            src={`https://img.youtube.com/vi/${link.youtubeId}/mqdefault.jpg`} 
                                                            alt="YouTube Thumbnail"
                                                            className="absolute inset-0 w-full h-full object-cover opacity-50"
                                                         />
                                                        <Youtube size={24} className="relative z-10 text-red-500 drop-shadow-md" />
                                                        <div className="absolute inset-0 bg-black/20" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <span className="text-[10px] text-zinc-400 mt-3 block">
                                    Agora • Válido por {durationDays} dias
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-400">
                        <Megaphone size={48} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-sm">Preencha o formulário para ver como ficará o aviso.</p>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-zinc-500 mt-4 text-center leading-tight">
                * Este aviso será notificado para toda a equipe do ministério e ficará disponível no painel de avisos.
            </p>
        </div>
      </div>
    </div>
  );
};

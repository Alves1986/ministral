
import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Announcement, User } from '../types';
import { Megaphone, CheckCircle2, Eye, Clock, AlertTriangle, AlertOctagon, Info, CheckCircle, ChevronDown, ChevronUp, Heart, ExternalLink, Youtube, Pin } from 'lucide-react';

interface Props {
  announcement: Announcement;
  currentUser: User;
  onMarkRead: (id: string) => void;
  onToggleLike?: (id: string) => void; 
  onTogglePin?: (id: string, isPinned: boolean) => void;
}

export const AnnouncementCard: React.FC<Props> = ({ announcement, currentUser, onMarkRead, onToggleLike, onTogglePin }) => {
  // Check if current user has read this announcement
  const hasRead = announcement.readBy.some(r => r.userId === currentUser.id);
  const isAdmin = currentUser.access_role === 'admin';

  const [showReaders, setShowReaders] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(hasRead && !isAdmin);
  
  // Like Logic
  const likes = announcement.likedBy || [];
  const hasLiked = likes.some(l => l.userId === currentUser.id);
  const likeCount = likes.length;

  // Link Extraction
  const extractedLinks = useMemo(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = announcement.message;
    const linksFoundText: string[] = [];
    
    // Find absolute URLs in text as well
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const textMatches = tempDiv.innerText.match(urlRegex) || [];
    
    // Find all <a> tags
    const anchorTags = Array.from(tempDiv.querySelectorAll('a'));
    anchorTags.forEach(a => {
        if (a.href) linksFoundText.push(a.href);
    });
    
    // Add text matches
    textMatches.forEach(url => {
        if (!linksFoundText.includes(url)) linksFoundText.push(url);
    });

    const uniqueLinks = [...new Set(linksFoundText)];
    
    // Inclui o link externo formal se existir e não estiver duplicado
    if (announcement.externalLink) {
        if (!uniqueLinks.includes(announcement.externalLink)) {
            uniqueLinks.unshift(announcement.externalLink);
        }
    }

    return uniqueLinks.map(url => {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(ytRegex);
        
        // Try to get a nicer name from the URL
        let domain = "";
        try {
            domain = new URL(url).hostname.replace('www.', '');
        } catch(e) { domain = 'Link Externo'; }

        return {
            url,
            domain,
            isYoutube: !!match,
            youtubeId: match ? match[1] : undefined
        };
    });
  }, [announcement.message]);

  // Clean message: Aggressively remove URLs and <a> tags from the text
  const cleanMessage = useMemo(() => {
    let msg = announcement.message;
    
    // 1. Remove <a> tags and their content if they look like URLs, 
    // or just hide the <a> tag entirely if it's meant to be "separate".
    // User specifically asked for the link to be "hidden" from text.
    
    // Replace <a> tags (and whatever is inside) with nothing
    msg = msg.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '');
    
    // 2. Remove raw URLs from the text
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    msg = msg.replace(urlRegex, '');
    
    // 3. Clean up potential empty paragraphs or excessive line breaks left behind
    msg = msg.replace(/<p>\s*<\/p>/gi, '');
    msg = msg.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    
    return msg;
  }, [announcement.message]);

  const handleRead = async () => {
      setIsReading(true);
      await onMarkRead(announcement.id);
      setIsReading(false);
  };

  const getTheme = (type: string) => {
    switch(type) {
        case 'success': return { 
            bg: 'bg-secondary/10 dark:bg-secondary/5', 
            border: 'border-secondary/20 dark:border-secondary/30',
            icon: <CheckCircle className="text-secondary" size={24} />,
            accent: 'text-secondary dark:text-secondary',
            btn: 'bg-secondary hover:bg-secondaryHover'
        };
        case 'warning': return { 
            bg: 'bg-accent/10 dark:bg-accent/5', 
            border: 'border-accent/20 dark:border-accent/30',
            icon: <AlertTriangle className="text-accent" size={24} />,
            accent: 'text-accent dark:text-accent',
            btn: 'bg-accent hover:bg-accent/80'
        };
        case 'alert': return { 
            bg: 'bg-red-50 dark:bg-red-900/10', 
            border: 'border-red-200 dark:border-red-800/30',
            icon: <AlertOctagon className="text-red-500" size={24} />,
            accent: 'text-red-700 dark:text-red-400',
            btn: 'bg-red-600 hover:bg-red-700'
        };
        default: return { 
            bg: 'bg-white dark:bg-zinc-900', 
            border: 'border-zinc-200 dark:border-zinc-800',
            icon: <Info className="text-secondary" size={24} />,
            accent: 'text-zinc-800 dark:text-zinc-100',
            btn: 'bg-secondary hover:bg-secondaryHover'
        };
    }
  };

  const theme = getTheme(announcement.type);

  return (
    <div className={`mb-6 rounded-2xl p-5 border shadow-sm animate-slide-up 
      ${theme.bg} ${theme.border}
      ${hasRead && !isAdmin ? 'opacity-60 grayscale-[30%]' : ''}
    `}>
        <div className="flex gap-4 items-start">
            <div className="shrink-0 mt-1">
                {theme.icon}
            </div>
            <div className="flex-1 min-w-0"> {/* min-w-0 ensures text wrap works inside flex */}
                {hasRead && !isAdmin && (
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Visualizado
                        </span>
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
                        >
                            {isCollapsed ? 'Expandir' : 'Recolher'}
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {announcement.isPinned && <Pin size={16} className="text-ministral-500 fill-ministral-500 rotate-45" />}
                        <h3 className={`font-bold text-lg ${theme.accent}`}>{announcement.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isAdmin && onTogglePin && (
                            <button 
                                onClick={() => onTogglePin(announcement.id, !!announcement.isPinned)}
                                className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${announcement.isPinned ? 'bg-ministral-100 text-ministral-600 dark:bg-ministral-900/30' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}
                                title={announcement.isPinned ? "Desafixar" : "Fixar no topo"}
                            >
                                <Pin size={10} className={announcement.isPinned ? 'fill-current' : ''} /> {announcement.isPinned ? 'Fixado' : 'Fixar'}
                            </button>
                        )}
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full">
                            <Clock size={10} /> {new Date(announcement.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                    </div>
                </div>
                
                {!isCollapsed && (
                    <>
                        {/* Safe HTML Rendering for Rich Text */}
                        <div 
                            className="text-zinc-700 dark:text-zinc-300 mt-2 text-sm leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-a:hidden whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanMessage, {
                                ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3'],
                                ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class']
                            }) }}
                        />

                        {/* Extracted Links / Attachments */}
                        {extractedLinks.length > 0 && (
                            <div className="mt-4 space-y-3">
                                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <ExternalLink size={10} /> Recursos Externos
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    {extractedLinks.map((link, idx) => (
                                        <div key={idx} className="group flex flex-col gap-2">
                                            {/* Button-like Card */}
                                            <a 
                                                href={link.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 hover:border-secondary transition-all hover:shadow-md group active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`p-2 rounded-lg ${link.isYoutube ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                                                        {link.isYoutube ? <Youtube size={18} /> : <ExternalLink size={18} />}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">{link.domain}</span>
                                                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-semibold">
                                                            {link.url}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-secondary dark:text-white bg-secondary/10 px-2 py-1 rounded-md shrink-0 ml-4 group-hover:bg-secondary group-hover:text-white transition-colors">
                                                    ACESSAR LINK
                                                </span>
                                            </a>
                                            
                                            {/* YouTube Preview Card */}
                                            {link.isYoutube && link.youtubeId && (
                                                <div className="aspect-video w-full max-w-lg bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-lg animate-fade-in group relative">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        src={`https://www.youtube.com/embed/${link.youtubeId}`}
                                                        title="YouTube video player"
                                                        frameBorder="0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                            <div className="text-xs text-zinc-500">
                                Enviado por: <span className="font-semibold">{announcement.author}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                                {/* Botão de Like (Visível para todos) */}
                                <div className="flex items-center gap-1 mr-2">
                                    <button
                                        onClick={() => onToggleLike && onToggleLike(announcement.id)}
                                        className={`p-2 rounded-full transition-all active:scale-95 flex items-center gap-1 ${
                                            hasLiked 
                                            ? 'text-red-500 bg-red-100 dark:bg-red-900/20' 
                                            : 'text-zinc-400 hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                        }`}
                                        title={hasLiked ? "Descurtir" : "Curtir"}
                                    >
                                        <Heart size={18} fill={hasLiked ? "currentColor" : "none"} />
                                    </button>
                                    
                                    {/* Contador e Toggle de Lista de Likes */}
                                    {likeCount > 0 && (
                                        <button 
                                            onClick={() => setShowLikers(!showLikers)}
                                            className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:underline"
                                        >
                                            {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
                                        </button>
                                    )}
                                </div>

                                {/* Botão de Marcar como Lido (Para Membros que ainda não leram) */}
                                {!hasRead && (
                                    <button 
                                        onClick={handleRead}
                                        disabled={isReading}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-bold text-sm shadow-md transition-all active:scale-95 ${theme.btn} ${isReading ? 'opacity-70' : ''}`}
                                    >
                                        {isReading ? 'Marcando...' : <><CheckCircle2 size={16} /> Marcar como Ciente</>}
                                    </button>
                                )}

                                {/* Visualização de Admin (Quem leu) */}
                                {isAdmin && (
                                    <button 
                                        onClick={() => setShowReaders(!showReaders)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <Eye size={14} /> 
                                        {showReaders ? 'Ocultar Leituras' : `Visto por ${announcement.readBy.length}`}
                                        {showReaders ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista de Quem Curtiu (Pública para a equipe) */}
                        {showLikers && likes.length > 0 && (
                            <div className="mt-3 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 text-xs animate-fade-in border border-red-100 dark:border-red-900/20">
                                <p className="font-bold text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-1">
                                    <Heart size={12} fill="currentColor"/> Curtido por:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {likes.map((liker, idx) => (
                                        <span key={idx} className="bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-sm text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700">
                                            {liker.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Lista de Leituras (Admin Apenas) */}
                        {isAdmin && showReaders && (
                            <div className="mt-3 bg-white/80 dark:bg-black/20 rounded-lg p-3 text-xs animate-fade-in border border-zinc-100 dark:border-zinc-700/50">
                                <p className="font-bold text-zinc-500 uppercase mb-2">Histórico de Visualização</p>
                                {announcement.readBy.length === 0 ? (
                                    <p className="text-zinc-400 italic">Ninguém visualizou ainda.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {announcement.readBy.map((reader, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                                                <CheckCircle2 size={12} className="text-green-500" />
                                                <span className="truncate" title={reader.name}>{reader.name}</span>
                                                <span className="text-[10px] text-zinc-400 ml-auto">
                                                    {new Date(reader.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { Music, Plus, Trash2, ExternalLink, Calendar, Settings, ListMusic, Loader2, Search, Youtube, Link, ArrowLeft, X, PlayCircle, Save, FileText, AlignLeft } from 'lucide-react';
import { RepertoireItem, User } from '../types';
import { useToast } from './Toast';
import { addToRepertoire, deleteFromRepertoire, sendNotificationSQL, updateRepertoireItem } from '../services/supabaseService';
import { searchSpotifyTracks, getLoginUrl, handleLoginCallback, isUserLoggedIn, logoutSpotify, getUserProfile, getUserPlaylists, getPlaylistTracks } from '../services/spotifyService';
import { searchYouTubeVideos } from '../services/youtubeService';
import { searchCifraClub } from '../services/cifraClubService';
import { ChordViewer } from './ChordViewer';
import { useQueryClient } from '@tanstack/react-query';
import { getSystemLogo } from '../utils/branding';

interface Props {
  repertoire: RepertoireItem[];
  setRepertoire: (items: RepertoireItem[]) => Promise<void>;
  currentUser: User | null;
  mode: 'view' | 'manage';
  onItemAdd?: (title: string) => void;
  ministryId?: string | null;
  integrations?: any;
}

export const RepertoireScreen: React.FC<Props> = ({ repertoire, setRepertoire, currentUser, mode, onItemAdd, ministryId, integrations }) => {
  const { addToast, confirmAction } = useToast();
  const queryClient = useQueryClient();
  
  // UI State
  const [activeTab, setActiveTab] = useState<'manual' | 'spotify' | 'playlists' | 'youtube' | 'cifra'>('spotify');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [selectedChordItem, setSelectedChordItem] = useState<RepertoireItem | null>(null);
  
  // Staging / Draft State
  const [draftItems, setDraftItems] = useState<{title: string, link: string, content?: string}[]>([]);

  // Persist Date
  const [date, setDate] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('repertoire_draft_date') || "";
      }
      return "";
  });

  // Manual Form
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [content, setContent] = useState("");

  // Spotify Auth & Data
  const [isSpotifyLoggedIn, setIsSpotifyLoggedIn] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Search State
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const [youtubeQuery, setYoutubeQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  const [cifraQuery, setCifraQuery] = useState("");
  const [cifraResults, setCifraResults] = useState<any[]>([]);
  const [cifraLoading, setCifraLoading] = useState(false);

  const orgId = currentUser?.organizationId;

  // Init
  useEffect(() => {
      const tokenFromHash = handleLoginCallback();
      if (tokenFromHash) {
          setIsSpotifyLoggedIn(true);
          setActiveTab('playlists');
          addToast("Spotify conectado com sucesso!", "success");
      } else if (isUserLoggedIn()) {
          setIsSpotifyLoggedIn(true);
      }
      if (isUserLoggedIn()) loadUserProfile();
  }, []);

  const handleDateChange = (val: string) => {
      setDate(val);
      localStorage.setItem('repertoire_draft_date', val);
  };

  const loadUserProfile = async () => {
      const profile = await getUserProfile();
      if (profile) setSpotifyUser(profile);
  };

  const handleSpotifyLogin = () => {
      if (!ministryId) {
          addToast("Erro: ID do ministério não encontrado.", "error");
          return;
      }
      if(date) localStorage.setItem('repertoire_draft_date', date);
      const url = getLoginUrl();
      if (url) window.location.href = url;
      else addToast("A chave do Spotify não está configurada no servidor (.env).", "error");
  };

  const handleLoadPlaylists = async () => {
      setIsLoadingPlaylists(true);
      try {
          const playlists = await getUserPlaylists();
          setUserPlaylists(playlists);
      } catch (e: any) {
          addToast(e.message || "Erro ao carregar playlists.", "error");
      }
      setIsLoadingPlaylists(false);
  };

  const handleOpenPlaylist = async (playlist: any) => {
      setSelectedPlaylist(playlist);
      setIsLoadingPlaylists(true);
      try {
          const tracks = await getPlaylistTracks(playlist.id);
          setPlaylistTracks(tracks);
      } catch (e: any) {
          addToast(e.message || "Erro ao carregar faixas.", "error");
      }
      setIsLoadingPlaylists(false);
  };

  const handleSpotifySearch = async () => {
      if (!spotifyQuery.trim() || !ministryId) return;
      setSpotifyLoading(true);
      try {
          const results = await searchSpotifyTracks(spotifyQuery);
          setSpotifyResults(results);
          if (results.length === 0) addToast("Nenhum resultado no Spotify.", "warning");
      } catch (e: any) {
          addToast(e.message || "Erro ao buscar no Spotify.", "error");
      } finally {
          setSpotifyLoading(false);
      }
  };

  const handleYouTubeSearch = async () => {
      if (!youtubeQuery.trim()) return;
      setYoutubeLoading(true);
      try {
          const results = await searchYouTubeVideos(youtubeQuery);
          setYoutubeResults(results);
          if (results.length === 0) addToast("Nenhum vídeo encontrado.", "warning");
      } catch (e: any) {
          addToast(e.message || "Erro ao buscar no YouTube.", "error");
      } finally {
          setYoutubeLoading(false);
      }
  };

  const handleCifraSearch = async () => {
      if (!cifraQuery.trim()) return;
      setCifraLoading(true);
      const results = await searchCifraClub(cifraQuery);
      setCifraResults(results);
      setCifraLoading(false);
      if (results.length === 0) addToast("Nenhuma cifra encontrada.", "warning");
  };

  const handleAddToDraft = (overrideTitle?: string, overrideLink?: string, overrideContent?: string) => {
    const finalTitle = overrideTitle || title;
    const finalLink = overrideLink || link;
    const finalContent = overrideContent || content;

    if (!finalTitle) {
        addToast("O título da música é obrigatório.", "error");
        return;
    }

    if (draftItems.some(i => i.title === finalTitle)) {
        addToast("Essa música já está na lista de envio.", "warning");
        return;
    }

    setDraftItems(prev => [...prev, { title: finalTitle, link: finalLink, content: finalContent }]);
    if (!overrideTitle) { setTitle(""); setLink(""); setContent(""); }
    addToast("Adicionado à lista de seleção!", "success");
  };

  const handleRemoveFromDraft = (idx: number) => {
      setDraftItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCommitDraft = async () => {
    if (!date) {
        addToast("Selecione a Data do Culto antes de salvar!", "warning");
        dateInputRef.current?.focus();
        dateInputRef.current?.classList.add('ring-4', 'ring-red-500');
        setTimeout(() => dateInputRef.current?.classList.remove('ring-4', 'ring-red-500'), 2000);
        return;
    }

    if (!currentUser?.ministryId || !orgId) {
        addToast("Erro: Ministério ou Organização não identificados.", "error");
        return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    
    // Optimistic update
    const newItems = draftItems.map(item => ({
        id: `temp-${Date.now()}-${Math.random()}`,
        title: item.title,
        link: item.link,
        date,
        addedBy: currentUser.name,
        content: item.content
    }));
    queryClient.setQueryData(['repertoire', currentUser.ministryId, orgId], (old: any) => {
        if (!old) return old;
        return [...old, ...newItems];
    });

    for (const item of draftItems) {
        const success = await addToRepertoire(currentUser.ministryId, orgId, {
            title: item.title,
            link: item.link,
            date,
            addedBy: currentUser.name,
            content: item.content
        });
        if (success) successCount++;
    }

    if (successCount > 0) {
        if (onItemAdd) onItemAdd(`${successCount} músicas`);
        await setRepertoire([]); 
        setDraftItems([]); 
        addToast(`${successCount} músicas salvas no repertório!`, "success");

        if (ministryId) {
            const dateFormatted = date.split('-').reverse().join('/');
            await sendNotificationSQL(ministryId, orgId, {
                title: "Novo Repertório",
                message: `${successCount} músicas foram adicionadas para o culto de ${dateFormatted}.`,
                type: 'info',
                actionLink: 'repertoire'
            });
        }
    } else {
        addToast("Erro ao salvar músicas.", "error");
        await setRepertoire([]); // Revert optimistic update
    }
    setIsSubmitting(false);
  };

  const handleDelete = (id: string) => {
      if (!orgId) {
          console.error("Organization ID missing");
          return;
      }
      confirmAction("Excluir Item", "Tem certeza que deseja remover este item do repertório?", async () => {
          // Optimistic update
          queryClient.setQueryData(['repertoire', currentUser?.ministryId, orgId], (old: any) => {
              if (!old) return old;
              return old.filter((item: any) => item.id !== id);
          });
          
          await deleteFromRepertoire(id, orgId);
          await setRepertoire([]); 
          addToast("Item removido.", "success");
      });
  };

  const handleSaveChordPreference = async (newKey: string, newContent: string) => {
      if (selectedChordItem && orgId) {
          await updateRepertoireItem(selectedChordItem.id, orgId, { content: newContent, key: newKey });
          // No need to refresh full list instantly, keeps UI smooth
          addToast("Cifra atualizada!", "success");
      }
  };

  const groupedRepertoire = repertoire.reduce((acc, item) => {
      const dateKey = item.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
  }, {} as Record<string, RepertoireItem[]>);

  const sortedDates = Object.keys(groupedRepertoire).sort((a, b) => b.localeCompare(a));
  const isLouvor = ministryId === 'louvor';

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-28">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            {mode === 'manage' ? <Settings className="text-zinc-500"/> : <Music className="text-secondary dark:text-white"/>}
            {mode === 'manage' ? 'Gerenciar Repertório' : 'Repertório Musical'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'manage' ? 'Selecione as músicas e envie para o repertório do culto.' : 'Lista de louvores para os próximos cultos.'}
          </p>
        </div>
      </div>

      {mode === 'manage' && (
          <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in w-full overflow-hidden">
                  
                  {/* Full Bleed Mobile Tabs */}
                  <div className="flex gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-1 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
                      <button onClick={() => setActiveTab('spotify')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'spotify' ? 'text-secondary dark:text-white border-secondary bg-secondary/10' : 'text-zinc-500 border-transparent'}`}><Search size={14}/> Spotify</button>
                      <button onClick={() => setActiveTab('youtube')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'youtube' ? 'text-red-500 border-red-500 bg-red-50 dark:bg-red-900/10' : 'text-zinc-500 border-transparent'}`}><Youtube size={14}/> YouTube</button>
                      {isLouvor && <button onClick={() => setActiveTab('cifra')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'cifra' ? 'text-accent border-accent bg-accent/10 dark:bg-accent/20' : 'text-zinc-500 border-transparent'}`}><FileText size={14}/> Cifras</button>}
                      {isSpotifyLoggedIn && <button onClick={() => { setActiveTab('playlists'); if(userPlaylists.length === 0) handleLoadPlaylists(); }} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'playlists' ? 'text-secondary dark:text-white border-secondary bg-secondary/10' : 'text-zinc-500 border-transparent'}`}><ListMusic size={14}/> Playlists</button>}
                      <button onClick={() => setActiveTab('manual')} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${activeTab === 'manual' ? 'text-secondaryHover border-secondaryHover bg-secondary/10' : 'text-zinc-500 border-transparent'}`}><AlignLeft size={14}/> Manual / Cifra</button>
                  </div>

                  {activeTab === 'spotify' && (
                      <div className="space-y-4 animate-fade-in">
                          <div className="flex gap-2">
                              <input type="text" placeholder="Digite música ou artista..." value={spotifyQuery} onChange={e => setSpotifyQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSpotifySearch()} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100" />
                              <button onClick={handleSpotifySearch} disabled={spotifyLoading} className="bg-secondary hover:bg-secondaryHover text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">{spotifyLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                          </div>
                          {spotifyResults.length > 0 && <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">{spotifyResults.map(track => (<div key={track.id} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group"><div className="flex items-center gap-3 overflow-hidden"><img src={track.album.images[2]?.url || track.album.images[0]?.url} className="w-10 h-10 rounded shadow-sm shrink-0" /><div className="min-w-0"><p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{track.name}</p><p className="text-xs text-zinc-500 truncate">{track.artists[0].name}</p></div></div><button onClick={() => handleAddToDraft(`${track.name} - ${track.artists[0].name}`, track.external_urls.spotify)} className="shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-secondary/10 text-secondary hover:bg-secondary/20 flex items-center gap-1"><Plus size={14}/> Add</button></div>))}</div>}
                          {!isSpotifyLoggedIn && <div className="p-3 bg-secondary/10 rounded-lg text-xs text-secondary dark:text-white flex justify-between items-center"><span>Conecte sua conta para acessar playlists.</span><button onClick={handleSpotifyLogin} className="font-bold underline hover:text-secondaryHover">Conectar Spotify</button></div>}
                      </div>
                  )}

                  {activeTab === 'youtube' && (
                      <div className="space-y-4 animate-fade-in">
                          <div className="flex gap-2">
                              <input type="text" placeholder="Buscar vídeo no YouTube..." value={youtubeQuery} onChange={e => setYoutubeQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleYouTubeSearch()} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500 text-zinc-900 dark:text-zinc-100" />
                              <button onClick={handleYouTubeSearch} disabled={youtubeLoading} className="bg-red-600 hover:bg-red-700 text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">{youtubeLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                          </div>
                          {youtubeResults.length > 0 && <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">{youtubeResults.map(video => (<div key={video.id} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group"><div className="flex items-center gap-3 overflow-hidden w-full"><img src={video.thumbnail} className="w-16 h-10 object-cover rounded shadow-sm shrink-0" /><div className="min-w-0 flex-1"><p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1" title={video.title}>{video.title}</p><p className="text-xs text-zinc-500 truncate">{video.channelTitle}</p></div></div><button onClick={() => handleAddToDraft(video.title, video.link)} className="shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-1 ml-2"><Plus size={14}/> Add</button></div>))}</div>}
                      </div>
                  )}

                  {activeTab === 'cifra' && isLouvor && (
                      <div className="space-y-4 animate-fade-in">
                          <div className="flex gap-2">
                              <input type="text" placeholder="Música ou Artista..." value={cifraQuery} onChange={e => setCifraQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCifraSearch()} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent text-zinc-900 dark:text-zinc-100" />
                              <button onClick={handleCifraSearch} disabled={cifraLoading} className="bg-accent hover:bg-accent/80 text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">{cifraLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                          </div>
                          {cifraResults.length > 0 && <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">{cifraResults.map((result, idx) => (<div key={idx} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group"><div className="flex items-center gap-3 w-full overflow-hidden"><div className="w-10 h-10 rounded bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0"><span className="font-bold text-xs">{result.key || '?'}</span></div><div className="min-w-0 flex-1"><p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{result.title}</p><p className="text-xs text-zinc-500 truncate">{result.artist}</p></div></div><button onClick={() => handleAddToDraft(result.title + (result.key ? ` (${result.key})` : ''), result.url)} className="shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-accent/10 dark:bg-accent/20 text-accent hover:bg-accent/20 dark:hover:bg-accent/30 flex items-center gap-1 ml-1"><Plus size={14}/> Add</button></div>))}</div>}
                      </div>
                  )}

                  {activeTab === 'playlists' && isSpotifyLoggedIn && (
                      <div className="animate-fade-in">
                          {selectedPlaylist ? (
                              <div>
                                  <button onClick={() => setSelectedPlaylist(null)} className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2"><ArrowLeft size={14}/> Voltar</button>
                                  {isLoadingPlaylists ? <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary dark:text-white" /></div> : <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1">{playlistTracks.map((track, idx) => (<div key={idx} className="flex items-center justify-between p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg group"><div className="flex-1 min-w-0 pr-2"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{track.name}</p><p className="text-xs text-zinc-500 truncate">{track.artists[0].name}</p></div><button onClick={() => handleAddToDraft(`${track.name} - ${track.artists[0].name}`, track.external_urls.spotify)} className="text-[10px] font-bold px-2 py-1 rounded transition-colors bg-zinc-200 dark:bg-zinc-700 hover:bg-secondary hover:text-white"><Plus size={12}/></button></div>))}</div>}
                              </div>
                          ) : (
                              <div>
                                  {isLoadingPlaylists ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-secondary dark:text-white"/></div> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto custom-scrollbar">{userPlaylists.map(pl => (<button key={pl.id} onClick={() => handleOpenPlaylist(pl)} className="flex flex-col items-start p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors text-left group"><img src={pl.images?.[0]?.url || getSystemLogo('light')} className="w-full aspect-square object-cover rounded-lg mb-2 shadow-sm bg-zinc-200" /><span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 line-clamp-1 w-full">{pl.name}</span></button>))}</div>}
                              </div>
                          )}
                      </div>
                  )}

                  {activeTab === 'manual' && (
                      <div className="space-y-4 animate-fade-in">
                          <div><label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Título</label><input type="text" placeholder="Ex: Todavia Me Alegrarei" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"/></div>
                          <div><label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Link (URL)</label><input type="text" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"/></div>
                          <div><label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Cifra / Letra</label><textarea placeholder="Cole a cifra aqui..." value={content} onChange={e => setContent(e.target.value)} className="w-full h-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100 resize-none" /></div>
                          <div className="flex justify-end"><button onClick={() => handleAddToDraft()} className="bg-secondary hover:bg-secondaryHover text-white font-bold py-2.5 px-6 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"><Plus size={16}/> Adicionar</button></div>
                      </div>
                  )}
              </div>

              <div className="w-full lg:w-80 bg-zinc-50 dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 h-fit sticky top-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2"><ListMusic size={14}/> Músicas Selecionadas</h3>
                  <div className="mb-4"><label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Data do Culto</label><input ref={dateInputRef} type="date" value={date} onChange={e => handleDateChange(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-secondary font-medium transition-all text-zinc-900 dark:text-zinc-100"/></div>
                  {draftItems.length === 0 ? <div className="py-8 text-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg"><p className="text-xs">Nenhuma música selecionada.</p></div> : <div className="space-y-2 mb-4">{draftItems.map((item, idx) => (<div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm animate-slide-up"><span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate flex-1 pr-2">{item.title}</span><button onClick={() => handleRemoveFromDraft(idx)} className="text-red-400 hover:text-red-500 p-1"><X size={14}/></button></div>))}</div>}
                  <button onClick={handleCommitDraft} disabled={isSubmitting || draftItems.length === 0} className="w-full bg-secondary hover:bg-secondaryHover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}{isSubmitting ? 'Salvando...' : 'Salvar no Culto'}</button>
              </div>
          </div>
      )}

      <div className="space-y-8 mt-8">
          {sortedDates.length === 0 ? <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800"><Music className="mx-auto mb-3 opacity-20" size={48}/><p>Nenhum louvor cadastrado ainda.</p></div> : sortedDates.map(dateKey => {
              const [y, m, d] = dateKey.split('-');
              return (
                  <div key={dateKey} className="animate-slide-up">
                      <div className="flex items-center gap-2 mb-3 px-1 border-b border-zinc-100 dark:border-zinc-700 pb-2"><div className="bg-secondary/10 dark:bg-secondary/5 text-secondary dark:text-white p-1.5 rounded-lg"><Calendar size={16} /></div><h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-lg">Culto {d}/{m}/{y}</h3></div>
                      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                          {groupedRepertoire[dateKey].map((item, idx) => (
                              <div key={item.id} className={`flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group ${idx !== groupedRepertoire[dateKey].length - 1 ? 'border-b border-zinc-100 dark:border-zinc-700/50' : ''}`}>
                                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1 cursor-pointer" onClick={() => setSelectedChordItem(item)}>
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.link.includes('spotify') ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : item.link.includes('youtu') ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                          {item.link.includes('youtu') ? <Youtube size={20}/> : (item.link.includes('cifra') || item.content) ? <FileText size={20}/> : <Music size={20} />}
                                      </div>
                                      <div className="min-w-0">
                                          <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate pr-2">{item.title}</h4>
                                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                              <span>• Adicionado por {item.addedBy.split(' ')[0]}</span>
                                              {item.content && <span className="bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-zinc-200 dark:border-zinc-600">CIFRA</span>}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><ExternalLink size={18} /></a>
                                      {mode === 'manage' && <button onClick={() => handleDelete(item.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={18} /></button>}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              );
          })}
      </div>

      {/* Chord Viewer Modal */}
      {selectedChordItem && (
          <ChordViewer 
              isOpen={!!selectedChordItem} 
              onClose={() => setSelectedChordItem(null)} 
              title={selectedChordItem.title} 
              initialContent={selectedChordItem.content || ""} 
              initialKey={selectedChordItem.key}
              onSavePreference={handleSaveChordPreference}
              readOnly={mode !== 'manage'}
          />
      )}
    </div>
  );
};
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Music, Plus, Trash2, ExternalLink, Calendar, Settings, ListMusic, 
  Loader2, Search, Youtube, Link, ArrowLeft, X, PlayCircle, Save, 
  FileText, AlignLeft, ListPlus, Clock, Sun, Moon, ChevronLeft, 
  ChevronRight, Eye, EyeOff, Sparkles, Check, CheckCircle2
} from 'lucide-react';
import { RepertoireItem, User } from '../types';
import { useToast } from './Toast';
import { addToRepertoire, deleteFromRepertoire, notifyRepertoirePlaylistPublished, sendNotificationSQL, updateRepertoireItem } from '../services/supabaseService';
import { getSupabase } from '../services/supabase/client';
import { searchSpotifyTracks, getLoginUrl, handleLoginCallback, isUserLoggedIn, logoutSpotify, getUserProfile, getUserPlaylists, getPlaylistTracks } from '../services/spotifyService';
import { searchYouTubeVideos, extractPlaylistId } from '../services/youtubeService';
import { searchCifraClub, getVagalumeLyrics } from '../services/cifraClubService';
import { ChordViewer } from './ChordViewer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSystemLogo } from '../utils/branding';
import { getLocalDateISOString, getMonthName, adjustMonth } from '../utils/dateUtils';
import { generateEvents } from '../domain/events/generateEvents';

interface Props {
  repertoire: RepertoireItem[];
  setRepertoire: (items: RepertoireItem[]) => Promise<void>;
  currentUser: User | null;
  mode: 'view' | 'manage';
  onItemAdd?: (title: string) => void;
  ministryId?: string | null;
  integrations?: any;
  events?: any[];
  currentMonth?: string;
  onMonthChange?: (month: string) => void;
}

export const RepertoireScreen: React.FC<Props> = ({ 
  repertoire, 
  setRepertoire, 
  currentUser, 
  mode, 
  onItemAdd, 
  ministryId, 
  integrations,
  events = [],
  currentMonth,
  onMonthChange
}) => {
  const { addToast, confirmAction } = useToast();
  const queryClient = useQueryClient();
  
  // UI State
  const [activeTab, setActiveTab] = useState<'manual' | 'spotify' | 'playlists' | 'youtube' | 'cifra'>('youtube');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const cultoSelectRef = useRef<HTMLSelectElement>(null);
  const [selectedChordItem, setSelectedChordItem] = useState<RepertoireItem | null>(null);
  
  // Staging / Draft State
  const [draftItems, setDraftItems] = useState<{title: string, link: string, content?: string}[]>([]);

  // Mês vigente e referências de data
  const todayIso = useMemo(() => getLocalDateISOString(), []);
  const realCurrentMonth = useMemo(() => todayIso.slice(0, 7), [todayIso]);
  const viewMonth = currentMonth || realCurrentMonth;

  const handlePrevMonth = () => {
    if (onMonthChange) {
      onMonthChange(adjustMonth(viewMonth, -1));
    }
  };

  const handleNextMonth = () => {
    if (onMonthChange) {
      onMonthChange(adjustMonth(viewMonth, 1));
    }
  };

  const handleResetMonth = () => {
    if (onMonthChange) {
      onMonthChange(realCurrentMonth);
    }
  };

  // Nomes de dias da semana em português
  const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const WEEKDAY_NAMES_FULL = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  // Helper para verificar se um culto já passou
  const isEventPast = (dateStr: string, timeStr?: string | null): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;

    if (timeStr) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const nowTimeStr = `${hours}:${minutes}`;
      const cleanTime = timeStr.slice(0, 5);
      return cleanTime < nowTimeStr;
    }
    return false;
  };

  // Persist Date
  const [date, setDate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('repertoire_draft_date') || "";
    }
    return "";
  });

  // Persist Culto Selection
  const [selectedCultoKey, setSelectedCultoKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('repertoire_draft_culto_key') || "";
    }
    return "";
  });

  const [customCultoTitle, setCustomCultoTitle] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('repertoire_draft_culto_custom') || "";
    }
    return "";
  });

  // Controle de exibição dos cultos anteriores no seletor ("nem mostra" por padrão)
  const [showPastCultos, setShowPastCultos] = useState(false);

  // Filtro de listagem das playlists do repertório
  const [playlistFilter, setPlaylistFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');

  const orgId = currentUser?.organizationId;

  // Buscar regras de cultos da organização/ministério
  const { data: eventRules = [] } = useQuery({
    queryKey: ['event_rules_repertoire', orgId, ministryId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !orgId) return [];
      let query = sb
        .from('event_rules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('active', true);
      
      if (ministryId && ministryId.length === 36) {
        query = query.eq('ministry_id', ministryId);
      }
      
      const { data, error } = await query.order('time', { ascending: true });
      if (error) {
        console.warn('Erro ao carregar regras de culto:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Replicar os cultos existentes do calendário com precisão absoluta
  const allCalendarCultos = useMemo(() => {
    const cultosMap = new Map<string, {
      key: string;
      id: string;
      ruleId?: string | null;
      title: string;
      date: string;
      time: string;
      iso: string;
      weekday: number;
      weekdayShort: string;
      weekdayFull: string;
      dateDisplay: string;
      isPast: boolean;
      isNext?: boolean;
    }>();

    const addEventItem = (e: any) => {
      if (!e || !e.date || !e.title) return;
      const ruleId = e.ruleId || (typeof e.id === 'string' && e.id.includes('|') ? e.id.split('|')[0] : null);
      const time = e.time ? e.time.slice(0, 5) : '19:30';
      const [y, m, d] = e.date.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      const weekday = dt.getDay();
      const weekdayShort = WEEKDAY_NAMES_SHORT[weekday];
      const weekdayFull = WEEKDAY_NAMES_FULL[weekday];
      const dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
      const isPast = isEventPast(e.date, time);
      // Chave única para o culto específico naquele dia e horário
      const key = `${e.date}_${ruleId || e.title.trim().toLowerCase()}_${time}`;

      if (!cultosMap.has(key)) {
        cultosMap.set(key, {
          key,
          id: e.id || key,
          ruleId,
          title: e.title,
          date: e.date,
          time,
          iso: `${e.date}T${time}`,
          weekday,
          weekdayShort,
          weekdayFull,
          dateDisplay,
          isPast,
        });
      }
    };

    // 1. Prioridade para os eventos reais sincronizados do calendário da aplicação (com exclusões aplicadas)
    if (events && Array.isArray(events)) {
      events.forEach(addEventItem);
    }

    // 2. Geração determinística de cultos a partir das regras cadastradas (cobre transição de meses)
    if (eventRules && eventRules.length > 0) {
      const prevMonthStr = adjustMonth(viewMonth, -1);
      const nextMonthStr = adjustMonth(viewMonth, 2);
      const gen = generateEvents(eventRules as any, `${prevMonthStr}-01`, `${nextMonthStr}-28`);
      gen.forEach(addEventItem);
    }

    const sorted = Array.from(cultosMap.values()).sort((a, b) => a.iso.localeCompare(b.iso));

    // Identificar determinísticamente o "Próximo Culto da Agenda Sempre"
    let foundNext = false;
    return sorted.map(c => {
      if (!foundNext && !c.isPast) {
        foundNext = true;
        return { ...c, isNext: true };
      }
      return { ...c, isNext: false };
    });
  }, [events, eventRules, viewMonth]);

  // Próximo culto da agenda sempre
  const nextCulto = useMemo(() => {
    return allCalendarCultos.find(c => c.isNext) || allCalendarCultos.find(c => !c.isPast) || null;
  }, [allCalendarCultos]);

  // Cultos do mês vigente/exibido
  const monthCultos = useMemo(() => {
    return allCalendarCultos.filter(c => c.date.startsWith(viewMonth));
  }, [allCalendarCultos, viewMonth]);

  const upcomingMonthCultos = useMemo(() => {
    return monthCultos.filter(c => !c.isPast);
  }, [monthCultos]);

  const pastMonthCultos = useMemo(() => {
    return monthCultos.filter(c => c.isPast);
  }, [monthCultos]);

  // Pré-selecionar o próximo culto da agenda automaticamente se nada estiver selecionado ou se o item salvo não existir mais
  useEffect(() => {
    if (!selectedCultoKey && nextCulto) {
      setSelectedCultoKey(nextCulto.key);
      setDate(nextCulto.date);
      localStorage.setItem('repertoire_draft_culto_key', nextCulto.key);
      localStorage.setItem('repertoire_draft_date', nextCulto.date);
    }
  }, [selectedCultoKey, nextCulto]);

  // Informações completas do culto selecionado
  const selectedCultoInfo = useMemo(() => {
    if (selectedCultoKey === 'custom') {
      return {
        id: null,
        title: customCultoTitle.trim(),
        time: '',
        date: date,
        isCustom: true,
        culto: null
      };
    }
    const found = allCalendarCultos.find(c => c.key === selectedCultoKey);
    if (found) {
      return {
        id: found.ruleId || null,
        title: found.title,
        time: found.time,
        date: found.date,
        isCustom: false,
        culto: found
      };
    }
    return { id: null, title: '', time: '', date: '', isCustom: false, culto: null };
  }, [selectedCultoKey, customCultoTitle, allCalendarCultos, date]);

  const handleSelectCulto = (cultoItem: any) => {
    setSelectedCultoKey(cultoItem.key);
    setDate(cultoItem.date);
    localStorage.setItem('repertoire_draft_culto_key', cultoItem.key);
    localStorage.setItem('repertoire_draft_date', cultoItem.date);
  };

  const handleDateChange = (val: string) => {
    setDate(val);
    localStorage.setItem('repertoire_draft_date', val);
  };

  const handleCustomCultoChange = (val: string) => {
    setCustomCultoTitle(val);
    localStorage.setItem('repertoire_draft_culto_custom', val);
  };

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
  const [addingToDraftId, setAddingToDraftId] = useState<string | null>(null);

  // Init
  useEffect(() => {
    const checkConnection = () => {
      const justConnected = localStorage.getItem('spotify_just_connected') === 'true';
      if (justConnected || isUserLoggedIn()) {
        if (justConnected) {
          localStorage.removeItem('spotify_just_connected');
          addToast("Spotify conectado com sucesso!", "success");
        }
        setIsSpotifyLoggedIn(true);
        // setActiveTab('playlists'); // Ocultado até solicitação do usuário
        loadUserProfile();
      } else {
        setIsSpotifyLoggedIn(false);
        setSpotifyUser(null);
      }
    };

    checkConnection();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'spotify_just_connected' && e.newValue === 'true') {
        checkConnection();
      }
    };
    
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loadUserProfile = async () => {
    const profile = await getUserProfile();
    if (profile) {
      setSpotifyUser(profile);
      setIsSpotifyLoggedIn(true);
    } else {
      logoutSpotify();
      setIsSpotifyLoggedIn(false);
      setSpotifyUser(null);
      setUserPlaylists([]);
      setPlaylistTracks([]);
      setSelectedPlaylist(null);
    }
  };

  const handleSpotifyLogin = async () => {
    if (!ministryId) {
      addToast("Erro: ID do ministério não encontrado.", "error");
      return;
    }
    if (date) localStorage.setItem('repertoire_draft_date', date);
    localStorage.setItem('spotify_login_origin_tab', mode === 'manage' ? 'repertoire-manager' : 'repertoire');
    try {
      const url = await getLoginUrl(integrations?.spotifyClientId);
      if (url) {
        window.open(url, '_blank');
      } else {
        addToast("A chave do Spotify não está configurada no servidor (.env) nem nas configurações do ministério.", "error");
      }
    } catch (err) {
      addToast("Erro ao carregar link de conexão com o Spotify.", "error");
    }
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
      const results = await searchSpotifyTracks(spotifyQuery, integrations?.spotifyClientId, integrations?.spotifyClientSecret);
      setSpotifyResults(results);
      if (results.length === 0) addToast("Nenhum resultado no Spotify.", "warning");
    } catch (e: any) {
      addToast(e.message || "Erro ao buscar no Spotify.", "error");
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleYouTubeSearch = async () => {
    const query = youtubeQuery.trim();
    if (!query) return;
    const isPlaylist = !!extractPlaylistId(query);
    setYoutubeLoading(true);
    try {
      const results = await searchYouTubeVideos(query);
      setYoutubeResults(results);
      if (results.length === 0) {
        addToast(isPlaylist ? "Nenhum vídeo localizado nesta playlist do YouTube." : "Nenhum vídeo encontrado.", "warning");
      } else if (isPlaylist) {
        addToast(`Playlist carregada com sucesso! ${results.length} louvor(es) encontrado(s).`, "success");
      }
    } catch (e: any) {
      addToast(e.message || "Erro ao buscar no YouTube.", "error");
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleAddAllYouTubeToDraft = () => {
    if (youtubeResults.length === 0) return;
    let addedCount = 0;
    setDraftItems(prev => {
      const existing = new Set(prev.map(i => i.title.toLowerCase().trim()));
      const next = [...prev];
      for (const v of youtubeResults) {
        if (v.title && !existing.has(v.title.toLowerCase().trim())) {
          next.push({
            title: v.title,
            link: v.link,
            content: ''
          });
          existing.add(v.title.toLowerCase().trim());
          addedCount++;
        }
      }
      return next;
    });
    if (addedCount > 0) {
      addToast(`${addedCount} músicas da playlist adicionadas à seleção!`, 'success');
    } else {
      addToast("Todas as músicas desta lista já foram adicionadas.", "info");
    }
  };

  const handleCifraSearch = async () => {
    if (!cifraQuery.trim()) return;
    setCifraLoading(true);
    const results = await searchCifraClub(cifraQuery);
    setCifraResults(results);
    setCifraLoading(false);
    if (results.length === 0) addToast("Nenhum resultado encontrado no Vagalume.", "warning");
  };

  const handleAddVagalumeToDraft = async (result: any, idx: number) => {
    setAddingToDraftId(`vagalume-${idx}`);
    try {
      const lyrics = await getVagalumeLyrics(result.artist, result.title, result.url);
      const overrideTitle = result.title + (result.key && result.key !== '-' ? ` (${result.key})` : '');
      handleAddToDraft(overrideTitle, result.url, lyrics);
    } catch (err) {
      addToast("Erro ao buscar letra.", "error");
    } finally {
      setAddingToDraftId(null);
    }
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
      addToast("Selecione o Culto antes de salvar!", "warning");
      cultoSelectRef.current?.focus();
      cultoSelectRef.current?.classList.add('ring-4', 'ring-red-500');
      setTimeout(() => cultoSelectRef.current?.classList.remove('ring-4', 'ring-red-500'), 2000);
      return;
    }

    if (!selectedCultoInfo.title) {
      addToast("Selecione o Culto antes de salvar!", "warning");
      cultoSelectRef.current?.focus();
      cultoSelectRef.current?.classList.add('ring-4', 'ring-red-500');
      setTimeout(() => cultoSelectRef.current?.classList.remove('ring-4', 'ring-red-500'), 2000);
      return;
    }

    if (!ministryId || !orgId) {
      addToast("Erro: Ministério ou Organização não identificados.", "error");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let lastErrorMsg = "";

    const cultoTitle = selectedCultoInfo.title;
    const cultoTime = selectedCultoInfo.time;
    const observation = cultoTitle ? `Culto: ${cultoTitle}${cultoTime ? ` (${cultoTime})` : ''}` : undefined;
    const eventRuleId = selectedCultoInfo.id || null;
    
    // Optimistic update
    const newItems: RepertoireItem[] = draftItems.map(item => ({
      id: `temp-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      title: item.title,
      link: item.link,
      date,
      addedBy: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
      content: item.content,
      eventRuleId,
      eventRuleTitle: cultoTitle,
      eventRuleTime: cultoTime,
      observation: observation || null
    }));
    queryClient.setQueryData(['repertoire', ministryId, orgId], (old: any) => {
      if (!old) return old;
      return [...old, ...newItems];
    });

    for (const item of draftItems) {
      try {
        const success = await addToRepertoire(ministryId, orgId, {
          title: item.title,
          link: item.link,
          date,
          addedBy: currentUser?.name || 'Admin',
          content: item.content,
          eventRuleId,
          observation
        }, true); // skipNotification = true para não disparar por música
        if (success) successCount++;
      } catch (err: any) {
        console.error("Erro ao adicionar:", err);
        lastErrorMsg = err?.message || err?.details || JSON.stringify(err);
      }
    }

    if (successCount > 0) {
      if (onItemAdd) onItemAdd(`${successCount} músicas`);
      await setRepertoire([]); 
      setDraftItems([]); 
      addToast(`${successCount} músicas salvas no repertório!`, "success");

      // Notifica UMA ÚNICA VEZ sobre a playlist completa do culto
      if (ministryId) {
        try {
          await notifyRepertoirePlaylistPublished(ministryId, orgId, {
            cultoTitle,
            cultoTime,
            date,
            songsCount: successCount,
            addedBy: currentUser?.name || 'Ministro de Louvor',
            eventRuleId
          });
        } catch (err) {
          console.error("Erro ao enviar notificação de repertório:", err);
        }
      }
    } else {
      addToast(`Erro ao salvar: ${lastErrorMsg}`, "error");
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
      queryClient.setQueryData(['repertoire', ministryId, orgId], (old: any) => {
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
      addToast("Cifra atualizada!", "success");
    }
  };

  // Agrupamento de repertório com indicação de Próximo Culto e status de Culto Passado
  const groupedRepertoire = useMemo(() => {
    const groupsMap = new Map<string, {
      groupKey: string;
      date: string;
      eventRuleId?: string | null;
      cultoTitle: string;
      cultoTime?: string | null;
      items: RepertoireItem[];
      isPast: boolean;
      isNext: boolean;
    }>();

    for (const item of repertoire) {
      const itemDate = item.date || '0000-00-00';
      
      let title = item.eventRuleTitle || '';
      let time = item.eventRuleTime || '';
      
      if (!title && item.observation) {
        const obsMatch = item.observation.match(/^Culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
        if (obsMatch) {
          title = obsMatch[1].trim();
          if (obsMatch[2]) time = obsMatch[2].trim();
        }
      }

      const displayTitle = title || 'Culto Geral';
      const displayTime = time || '';
      const ruleId = item.eventRuleId || '';
      
      // Chave única para agrupar cultos diferentes no mesmo dia de forma independente
      const groupKey = `${itemDate}_${ruleId || displayTitle.toLowerCase().trim()}_${displayTime}`;

      if (!groupsMap.has(groupKey)) {
        const isPast = isEventPast(itemDate, displayTime);
        const isNext = !!nextCulto && itemDate === nextCulto.date && (
          (ruleId && ruleId === nextCulto.ruleId) ||
          displayTitle.toLowerCase().trim() === nextCulto.title.toLowerCase().trim()
        );

        groupsMap.set(groupKey, {
          groupKey,
          date: itemDate,
          eventRuleId: item.eventRuleId || null,
          cultoTitle: displayTitle,
          cultoTime: displayTime,
          items: [],
          isPast,
          isNext
        });
      }

      groupsMap.get(groupKey)!.items.push(item);
    }

    return Array.from(groupsMap.values()).sort((a, b) => {
      // 1. Próximo culto da agenda sempre ganha destaque no topo absoluto
      if (a.isNext && !b.isNext) return -1;
      if (!a.isNext && b.isNext) return 1;

      // 2. Cultos futuros vêm antes dos cultos passados
      if (!a.isPast && b.isPast) return -1;
      if (a.isPast && !b.isPast) return 1;

      // 3. Entre futuros: cronológico crescente (mais próximo primeiro)
      if (!a.isPast && !b.isPast) {
        const dComp = a.date.localeCompare(b.date);
        if (dComp !== 0) return dComp;
        return (a.cultoTime || '').localeCompare(b.cultoTime || '');
      }

      // 4. Entre passados: mais recente primeiro (decrescente)
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.cultoTime || '').localeCompare(a.cultoTime || '');
    });
  }, [repertoire, nextCulto]);

  // Lista filtrada para exibição conforme a aba selecionada
  const filteredRepertoire = useMemo(() => {
    if (playlistFilter === 'upcoming') {
      // Mostra os próximos cultos e cultos vigentes do mês atual; cultos anteriores de outros meses são filtrados
      return groupedRepertoire.filter(g => !g.isPast || g.date.startsWith(viewMonth));
    }
    if (playlistFilter === 'past') {
      return groupedRepertoire.filter(g => g.isPast);
    }
    return groupedRepertoire;
  }, [groupedRepertoire, playlistFilter, viewMonth]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-28">
      {/* Header com Navegador de Mês Vigente */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            {mode === 'manage' ? <Settings className="text-zinc-500"/> : <Music className="text-secondary dark:text-white"/>}
            {mode === 'manage' ? 'Gerenciar Repertório' : 'Repertório Musical'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'manage' ? 'Selecione o culto da agenda e monte o repertório oficial.' : 'Lista de louvores integrados com a equipe de Louvor para os cultos e ensaios.'}
          </p>
        </div>

        {/* Mês Vigente & Navegação de Calendário */}
        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
          <button
            onClick={handlePrevMonth}
            title="Mês Anterior"
            className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors active:scale-95"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-1.5 px-2">
            <Calendar size={14} className="text-secondary" />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
              {getMonthName(viewMonth)}
            </span>
            {viewMonth === realCurrentMonth && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-md">
                Mês Vigente
              </span>
            )}
          </div>

          <button
            onClick={handleNextMonth}
            title="Próximo Mês"
            className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors active:scale-95"
          >
            <ChevronRight size={16} />
          </button>

          {viewMonth !== realCurrentMonth && (
            <button
              onClick={handleResetMonth}
              className="text-[10px] font-bold text-secondary hover:underline px-1.5 ml-1 border-l border-zinc-300 dark:border-zinc-600"
            >
              Mês Atual
            </button>
          )}
        </div>
      </div>

      {/* Banner de Destaque: PRÓXIMO CULTO DA AGENDA SEMPRE */}
      {nextCulto && (
        <div className="p-4 bg-gradient-to-r from-secondary/15 via-secondary/5 to-transparent border border-secondary/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-secondary text-white flex items-center justify-center font-bold shadow-md shadow-secondary/25 shrink-0">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black tracking-wider uppercase bg-secondary text-white px-2 py-0.5 rounded-full shadow-xs">
                  ⭐ Próximo Culto da Agenda
                </span>
                <span className="text-xs font-bold text-secondary capitalize">
                  {nextCulto.weekdayFull}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white mt-0.5">
                {nextCulto.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 mt-0.5">
                <Clock size={12} className="text-secondary" />
                <span>{nextCulto.dateDisplay} às {nextCulto.time}</span>
              </p>
            </div>
          </div>

          {mode === 'manage' && (
            <button
              onClick={() => handleSelectCulto(nextCulto)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 shadow-md ${selectedCultoKey === nextCulto.key ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20' : 'bg-secondary hover:bg-secondaryHover text-white shadow-secondary/25 active:scale-95'}`}
            >
              {selectedCultoKey === nextCulto.key ? <><Check size={14} /> Culto Selecionado</> : 'Selecionar Próximo Culto'}
            </button>
          )}
        </div>
      )}

      {mode === 'manage' && (
          <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in w-full overflow-hidden">
                  
                  {/* Tabs de Fontes de Músicas - Apenas YouTube ativo conforme solicitado */}
                  <div className="flex gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-1 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
                      <button onClick={() => setActiveTab('youtube')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap text-red-500 border-red-500 bg-red-50 dark:bg-red-900/10">
                          <Youtube size={14}/> YouTube
                      </button>
                      {/* As opções Cifras / Letras, Spotify e Manual foram ocultadas conforme solicitado pelo usuário */}
                  </div>

                  {activeTab === 'spotify' && (
                      <div className="space-y-4 animate-fade-in">
                          {isSpotifyLoggedIn ? (
                              <div className="flex items-center justify-between p-3.5 bg-green-500/10 dark:bg-green-500/5 border border-green-500/25 dark:border-green-500/10 rounded-xl">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                      {spotifyUser?.images?.[0]?.url ? (
                                          <img src={spotifyUser.images[0].url} className="w-9 h-9 rounded-full object-cover shadow-sm border border-green-500/20 shrink-0" referrerPolicy="no-referrer" />
                                      ) : (
                                          <div className="w-9 h-9 rounded-full bg-[#1DB954] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                              {spotifyUser?.display_name?.[0]?.toUpperCase() || 'S'}
                                          </div>
                                      )}
                                      <div className="min-w-0">
                                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-wider text-green-600 dark:text-green-400 uppercase">
                                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Spotify Conectado
                                          </span>
                                          <p className="text-sm font-bold text-zinc-800 dark:text-white truncate leading-tight">{spotifyUser?.display_name || 'Sua Conta Spotify'}</p>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={() => {
                                          logoutSpotify();
                                          setIsSpotifyLoggedIn(false);
                                          setSpotifyUser(null);
                                          setUserPlaylists([]);
                                          setPlaylistTracks([]);
                                          setSelectedPlaylist(null);
                                          localStorage.removeItem('spotify_just_connected');
                                          localStorage.removeItem('spotify_login_origin_tab');
                                          addToast("Desconectado do Spotify com sucesso.", "info");
                                      }} 
                                      className="text-xs text-red-500 font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all shrink-0 active:scale-95"
                                  >
                                      Desconectar
                                  </button>
                              </div>
                          ) : (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-700/60 rounded-xl">
                                  <div className="space-y-1">
                                      <h4 className="text-xs font-black tracking-wider text-[#1DB954] uppercase flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping" /> Desconectado (Modo Público Ativo)
                                      </h4>
                                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal max-w-md">
                                          Você pode buscar músicas públicas de imediato. Conecte sua conta do Spotify se quiser sincronizar e adicionar músicas de suas <strong>Playlists particulares</strong>.
                                      </p>
                                  </div>
                                  <button 
                                      onClick={handleSpotifyLogin} 
                                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shrink-0 shadow-md shadow-[#1DB954]/15"
                                  >
                                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.782-8.892-.98-.336.075-.668-.135-.744-.47-.077-.336.135-.668.47-.743 3.856-.88 7.15-.502 9.822 1.13.295.178.387.563.204.856zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.075-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.666-1.112 8.232-.574 11.34 1.334.368.228.488.708.26 1.08zm.105-2.833C14.492 8.89 8.784 8.7 5.467 9.707a1 1 0 01-.577-1.915c3.81-1.155 10.12-.93 14.07 1.417a1 1 0 01-1.042 1.708z"/></svg>
                                      Conectar Spotify
                                  </button>
                              </div>
                          )}

                          <div className="flex gap-2">
                              <input type="text" placeholder="Digite música ou artista..." value={spotifyQuery} onChange={e => setSpotifyQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSpotifySearch()} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100" />
                              <button onClick={handleSpotifySearch} disabled={spotifyLoading} className="bg-secondary hover:bg-secondaryHover text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">{spotifyLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                          </div>
                          {spotifyResults.length > 0 && <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">{spotifyResults.map(track => (<div key={track.id} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group"><div className="flex items-center gap-3 overflow-hidden"><img src={track.album.images[2]?.url || track.album.images[0]?.url} className="w-10 h-10 rounded shadow-sm shrink-0" /><div className="min-w-0"><p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{track.name}</p><p className="text-xs text-zinc-500 truncate">{track.artists[0].name}</p></div></div><button onClick={() => handleAddToDraft(`${track.name} - ${track.artists[0].name}`, track.external_urls.spotify)} className="shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-secondary/10 text-secondary hover:bg-secondary/20 flex items-center gap-1"><Plus size={14}/> Add</button></div>))}</div>}
                      </div>
                  )}

                  {activeTab === 'youtube' && (
                      <div className="space-y-4 animate-fade-in">
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  placeholder="Cole a URL da Playlist, do Vídeo ou busque por música..." 
                                  value={youtubeQuery} 
                                  onChange={e => setYoutubeQuery(e.target.value)} 
                                  onKeyDown={e => e.key === 'Enter' && handleYouTubeSearch()} 
                                  className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-red-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" 
                              />
                              <button 
                                  onClick={handleYouTubeSearch} 
                                  disabled={youtubeLoading} 
                                  className="bg-red-600 hover:bg-red-700 text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
                                  title="Buscar no YouTube"
                              >
                                  {youtubeLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                              </button>
                          </div>

                          {youtubeResults.length > 0 && (
                              <div className="flex items-center justify-between p-2.5 bg-red-500/10 dark:bg-red-900/20 border border-red-500/20 rounded-xl">
                                  <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
                                      <Youtube size={16} />
                                      <span>
                                          {extractPlaylistId(youtubeQuery) 
                                              ? `Playlist: ${youtubeResults.length} louvor(es)` 
                                              : `${youtubeResults.length} vídeo(s) encontrado(s)`}
                                      </span>
                                  </div>
                                  <button
                                      onClick={handleAddAllYouTubeToDraft}
                                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                                  >
                                      <ListPlus size={14} />
                                      <span>Adicionar Todas</span>
                                  </button>
                              </div>
                          )}

                          {youtubeResults.length > 0 && (
                              <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">
                                  {youtubeResults.map(video => (
                                      <div key={video.id} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                                          <div className="flex items-center gap-3 overflow-hidden w-full">
                                              <img src={video.thumbnail} className="w-16 h-10 object-cover rounded shadow-sm shrink-0" alt={video.title} />
                                              <div className="min-w-0 flex-1">
                                                  <p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1" title={video.title}>
                                                      {video.title}
                                                  </p>
                                                  {video.channelTitle && (
                                                      <p className="text-xs text-zinc-500 truncate">{video.channelTitle}</p>
                                                  )}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                              <a 
                                                  href={video.link} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                  title="Ouvir no YouTube"
                                              >
                                                  <ExternalLink size={14} />
                                              </a>
                                              <button 
                                                  onClick={() => handleAddToDraft(video.title, video.link)} 
                                                  className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-1"
                                              >
                                                  <Plus size={14}/> Add
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  {activeTab === 'cifra' && (
                      <div className="space-y-4 animate-fade-in">
                          <div className="flex gap-2">
                              <input type="text" placeholder="Música ou Artista..." value={cifraQuery} onChange={e => setCifraQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCifraSearch()} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent text-zinc-900 dark:text-zinc-100" />
                              <button onClick={handleCifraSearch} disabled={cifraLoading} className="bg-accent hover:bg-accent/80 text-white px-4 rounded-lg font-bold flex items-center justify-center disabled:opacity-50">{cifraLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                          </div>
                          {cifraResults.length > 0 && <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 border border-zinc-100 dark:border-zinc-700 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">{cifraResults.map((result, idx) => (<div key={idx} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors group"><div className="flex items-center gap-3 w-full overflow-hidden"><div className="w-10 h-10 rounded bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0"><span className="font-bold text-xs">{result.key || '?'}</span></div><div className="min-w-0 flex-1"><p className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{result.title}</p><p className="text-xs text-zinc-500 truncate">{result.artist}</p></div></div><button onClick={() => handleAddVagalumeToDraft(result, idx)} disabled={addingToDraftId === `vagalume-${idx}`} className="shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-colors bg-accent/10 dark:bg-accent/20 text-accent hover:bg-accent/20 dark:hover:bg-accent/30 flex items-center gap-1 ml-1 disabled:opacity-50">{addingToDraftId === `vagalume-${idx}` ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14}/>} Add</button></div>))}</div>}
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

              {/* Sidebar: Seletor de Culto Real do Calendário & Músicas Selecionadas */}
              <div className="w-full lg:w-80 bg-zinc-50 dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 h-fit sticky top-4 shadow-sm">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                      <ListMusic size={14}/> Músicas Selecionadas
                  </h3>

                  {/* Campo Selecionar Culto do Calendário */}
                  <div className="mb-4">
                      <label className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 font-bold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><Calendar size={12} className="text-secondary" /> Culto do Calendário</span>
                          {selectedCultoInfo.time && (
                              <span className="text-[10px] font-mono font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                                  {selectedCultoInfo.time}
                              </span>
                          )}
                      </label>
                      <select
                          ref={cultoSelectRef}
                          value={selectedCultoKey}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setSelectedCultoKey('custom');
                              localStorage.setItem('repertoire_draft_culto_key', 'custom');
                            } else {
                              const c = allCalendarCultos.find(item => item.key === val);
                              if (c) handleSelectCulto(c);
                            }
                          }}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-secondary font-medium transition-all text-zinc-900 dark:text-zinc-100 shadow-sm"
                      >
                          <option value="">Selecione o Culto...</option>

                          {/* Próximo Culto da Agenda Sempre no Topo */}
                          {nextCulto && (
                              <optgroup label="⭐ Próximo Culto da Agenda">
                                  <option value={nextCulto.key}>
                                      ⭐ [PRÓXIMO] {nextCulto.weekdayFull}, {nextCulto.dateDisplay} às {nextCulto.time} - {nextCulto.title}
                                  </option>
                              </optgroup>
                          )}

                          {/* Cultos Agendados do Mês Vigente */}
                          {upcomingMonthCultos.filter(c => !nextCulto || c.key !== nextCulto.key).length > 0 && (
                              <optgroup label={`📅 Cultos Agendados de ${getMonthName(viewMonth)}`}>
                                  {upcomingMonthCultos
                                      .filter(c => !nextCulto || c.key !== nextCulto.key)
                                      .map(c => (
                                          <option key={c.key} value={c.key}>
                                              {c.weekdayShort}, {c.dateDisplay} às {c.time} - {c.title}
                                          </option>
                                      ))}
                              </optgroup>
                          )}

                          {/* Cultos Anteriores (Exibidos apenas se showPastCultos for true, com estilo apagado/dimmed) */}
                          {showPastCultos && pastMonthCultos.length > 0 && (
                              <optgroup label="⏳ Cultos Anteriores do Mês (Já Realizados)">
                                  {pastMonthCultos.map(c => (
                                      <option key={c.key} value={c.key} className="text-zinc-400">
                                          ⏳ {c.weekdayShort}, {c.dateDisplay} às {c.time} - {c.title} (Realizado)
                                      </option>
                                  ))}
                              </optgroup>
                          )}

                          {/* Opção para culto avulso se necessário */}
                          <optgroup label="Outro">
                              <option value="custom">✏️ Culto Avulso / Extra (Data personalizada)</option>
                          </optgroup>
                      </select>

                      {/* Toggle para mostrar/ocultar cultos anteriores ("nem mostra" por padrão) */}
                      {pastMonthCultos.length > 0 && (
                          <div className="mt-1.5 flex justify-end">
                              <button
                                  type="button"
                                  onClick={() => setShowPastCultos(prev => !prev)}
                                  className="text-[10px] text-zinc-500 hover:text-secondary flex items-center gap-1 transition-colors"
                              >
                                  {showPastCultos ? <EyeOff size={11} /> : <Eye size={11} />}
                                  <span>{showPastCultos ? 'Ocultar cultos anteriores' : `Ver cultos anteriores (${pastMonthCultos.length})`}</span>
                              </button>
                          </div>
                      )}

                      {/* Se for culto avulso/customizado, exibe os campos de título e data manual */}
                      {selectedCultoKey === 'custom' && (
                          <div className="mt-3 space-y-2 p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-fade-in">
                              <div>
                                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Título do Culto</label>
                                  <input
                                      type="text"
                                      placeholder="Ex: Culto de Vigília, Ensaio Geral..."
                                      value={customCultoTitle}
                                      onChange={e => handleCustomCultoChange(e.target.value)}
                                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"
                                      autoFocus
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Data</label>
                                  <input
                                      ref={dateInputRef}
                                      type="date"
                                      value={date}
                                      onChange={e => handleDateChange(e.target.value)}
                                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"
                                  />
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Prévia da playlist sendo montada com identificação de próximo culto / realizado */}
                  {date && selectedCultoInfo.title && (
                      <div className="mb-4 p-3 bg-secondary/10 dark:bg-secondary/15 border border-secondary/30 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-secondary">
                              <span className="font-extrabold truncate text-sm flex items-center gap-1.5">
                                  {selectedCultoInfo.title.toLowerCase().includes('manh') ? <Sun size={15}/> : selectedCultoInfo.title.toLowerCase().includes('noite') ? <Moon size={15}/> : <Music size={15}/>}
                                  {selectedCultoInfo.title}
                              </span>
                              {selectedCultoInfo.time && (
                                  <span className="font-mono text-[11px] font-bold bg-white/70 dark:bg-zinc-800/80 px-2 py-0.5 rounded shadow-xs">
                                      {selectedCultoInfo.time}
                                  </span>
                              )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300 flex-wrap">
                              <span className="font-semibold">{date.split('-').reverse().join('/')}</span>
                              {selectedCultoInfo.culto?.isNext && (
                                  <span className="text-[10px] font-black text-secondary bg-secondary/15 px-1.5 py-0.2 rounded-full">
                                      ⭐ PRÓXIMO CULTO
                                  </span>
                              )}
                              {selectedCultoInfo.culto?.isPast && (
                                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.2 rounded-full">
                                      ⏳ Culto Realizado
                                  </span>
                              )}
                          </div>
                      </div>
                  )}

                  {/* Lista de músicas em rascunho */}
                  {draftItems.length === 0 ? (
                      <div className="py-7 text-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl mb-4">
                          <p className="text-xs">Nenhuma música selecionada.</p>
                      </div>
                  ) : (
                      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                          {draftItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm animate-slide-up">
                                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate flex-1 pr-2">
                                      {item.title}
                                  </span>
                                  <button onClick={() => handleRemoveFromDraft(idx)} className="text-red-400 hover:text-red-500 p-1 transition-colors">
                                      <X size={14}/>
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  <button 
                      onClick={handleCommitDraft} 
                      disabled={isSubmitting || draftItems.length === 0} 
                      className="w-full bg-secondary hover:bg-secondaryHover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                      {isSubmitting ? 'Salvando...' : `Salvar no Repertório (${draftItems.length})`}
                  </button>
              </div>
          </div>
      )}

      {/* Listagem do Repertório com Filtros e Destaque Visual */}
      <div className="space-y-6 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 pb-3">
              <div className="flex items-center gap-2">
                  <ListMusic size={18} className="text-secondary" />
                  <h3 className="text-base font-bold text-zinc-800 dark:text-white">
                      Playlists de Culto
                  </h3>
              </div>

              {/* Filtro: Próximos & Vigentes, Todos, Anteriores */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                  <button
                      onClick={() => setPlaylistFilter('upcoming')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${playlistFilter === 'upcoming' ? 'bg-white dark:bg-zinc-700 text-secondary shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                  >
                      Próximos & Vigentes
                  </button>
                  <button
                      onClick={() => setPlaylistFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${playlistFilter === 'all' ? 'bg-white dark:bg-zinc-700 text-secondary shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                  >
                      Todos ({groupedRepertoire.length})
                  </button>
                  <button
                      onClick={() => setPlaylistFilter('past')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${playlistFilter === 'past' ? 'bg-white dark:bg-zinc-700 text-secondary shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                  >
                      Anteriores ({groupedRepertoire.filter(g => g.isPast).length})
                  </button>
              </div>
          </div>

          {filteredRepertoire.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Music className="mx-auto mb-3 opacity-20" size={48}/>
                  <p>Nenhuma playlist encontrada para o filtro selecionado.</p>
              </div>
          ) : filteredRepertoire.map(group => {
              const [y, m, d] = (group.date || '').split('-');
              const isMorning = group.cultoTitle.toLowerCase().includes('manh');
              const isNight = group.cultoTitle.toLowerCase().includes('noite');

              return (
                  <div 
                      key={group.groupKey} 
                      className={`animate-slide-up transition-all ${group.isNext ? 'p-1 rounded-2xl ring-2 ring-secondary/40 shadow-md' : ''} ${group.isPast ? 'opacity-65 grayscale-[15%] hover:opacity-100 transition-opacity' : ''}`}
                  >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-1 border-b border-zinc-100 dark:border-zinc-700 pb-2">
                          <div className="flex items-center gap-3 flex-wrap">
                              <div className={`p-2 rounded-xl flex items-center justify-center shadow-xs ${group.isNext ? 'bg-secondary text-white shadow-md shadow-secondary/30' : isMorning ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/40' : isNight ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/40' : 'bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-white border border-secondary/20'}`}>
                                  {group.isNext ? <Sparkles size={18} /> : isMorning ? <Sun size={18} /> : isNight ? <Moon size={18} /> : <Calendar size={18} />}
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">
                                          {group.cultoTitle}
                                      </h3>
                                      {group.isNext && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-secondary text-white shadow-xs">
                                              ⭐ PRÓXIMO CULTO
                                          </span>
                                      )}
                                      {group.isPast && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                              ⏳ Realizado
                                          </span>
                                      )}
                                      {group.cultoTime && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-600">
                                              <Clock size={11} /> {group.cultoTime}
                                          </span>
                                      )}
                                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                                          {d}/{m}/{y}
                                      </span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700">
                                  {group.items.length} {group.items.length === 1 ? 'louvor' : 'louvores'}
                              </span>
                          </div>
                      </div>

                      <div className={`rounded-xl border overflow-hidden shadow-sm ${group.isNext ? 'bg-white dark:bg-zinc-800 border-secondary/40' : group.isPast ? 'bg-zinc-50/70 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                          {group.items.map((item, idx) => (
                              <div key={item.id} className={`flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group ${idx !== group.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-700/50' : ''}`}>
                                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1 cursor-pointer" onClick={() => setSelectedChordItem(item)}>
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.link?.includes('spotify') ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : item.link?.includes('youtu') ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                          {item.link?.includes('youtu') ? <Youtube size={20}/> : (item.link?.includes('cifra') || item.content) ? <FileText size={20}/> : <Music size={20} />}
                                      </div>
                                      <div className="min-w-0">
                                          <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate pr-2">{item.title}</h4>
                                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap mt-0.5">
                                              {item.isFromWorship ? (
                                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black border border-amber-200 dark:border-amber-700/50 flex items-center gap-1">
                                                      <Music size={10} /> Louvor
                                                  </span>
                                              ) : (
                                                  <span>• Adicionado por {(item.addedBy || 'Admin').split(' ')[0]}</span>
                                              )}
                                              {item.key && <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-bold">Tom: {item.key}</span>}
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
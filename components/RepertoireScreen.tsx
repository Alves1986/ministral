import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Music, Plus, Trash2, ExternalLink, Calendar, Settings, ListMusic, 
  Loader2, Search, Youtube, Link, ArrowLeft, X, PlayCircle, Save, 
  FileText, AlignLeft, ListPlus, Clock, Sun, Moon, ChevronLeft, 
  ChevronRight, Eye, EyeOff, Sparkles, Check, CheckCircle2,
  Trophy, Archive, History, ChevronDown, ChevronUp, BarChart3, TrendingUp, Music2
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
import { 
  calculateSongsRanking, 
  partitionPlaylists, 
  filterSongRanking, 
  SongRankingItem,
  deduplicateEventRules,
  organizeCultosForSelection,
  normalizeCultoLabel,
  CalendarCultoItem
} from '../utils/repertoireUtils';

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
  
  // UI State: Sub-Aba Principal (Playlists vs Ranking de Louvores)
  const [mainView, setMainView] = useState<'playlists' | 'ranking'>('playlists');
  const [activeTab, setActiveTab] = useState<'manual' | 'spotify' | 'playlists' | 'youtube' | 'cifra'>('youtube');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const cultoSelectRef = useRef<HTMLSelectElement>(null);
  const [selectedChordItem, setSelectedChordItem] = useState<RepertoireItem | null>(null);

  // Controle de Arquivo de Playlists Passadas e Ranking
  const [expandedPastKeys, setExpandedPastKeys] = useState<Set<string>>(new Set());
  const [rankingSearch, setRankingSearch] = useState('');
  const [expandedSongHistoryKey, setExpandedSongHistoryKey] = useState<string | null>(null);
  
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

  const [customCultoTime, setCustomCultoTime] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('repertoire_draft_culto_time') || "19:30";
    }
    return "19:30";
  });

  // Controle de exibição dos cultos anteriores no seletor ("nem mostra" por padrão)
  const [showPastCultos, setShowPastCultos] = useState(false);

  // Filtro de listagem das playlists do repertório
  const [playlistFilter, setPlaylistFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');

  const orgId = currentUser?.organizationId;

  // Buscar regras de cultos do ministério atual (com fallback para organização apenas se o ministério não tiver regras próprias)
  const { data: eventRules = [] } = useQuery({
    queryKey: ['event_rules_repertoire', orgId, ministryId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !orgId) return [];

      let query = sb
        .from('event_rules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('time', { ascending: true });

      if (ministryId) {
        query = query.eq('ministry_id', ministryId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar regras de culto:', error);
        return [];
      }

      if (data && data.length > 0) {
        return deduplicateEventRules(data, ministryId);
      }

      // Fallback apenas caso o ministério atual ainda não tenha regras próprias
      const { data: orgData } = await sb
        .from('event_rules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('time', { ascending: true });

      return deduplicateEventRules(orgData || [], ministryId);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Replicar os cultos existentes do calendário com precisão absoluta e sem duplicidades
  const allCalendarCultos = useMemo(() => {
    const cultosMap = new Map<string, CalendarCultoItem>();
    const seenDateAndTime = new Set<string>();
    const seenDateAndLabel = new Set<string>();

    const addEventItem = (e: any) => {
      if (!e || !e.date || !e.title) return;
      const ruleId = e.ruleId || (typeof e.id === 'string' && e.id.includes('|') ? e.id.split('|')[0] : null);
      const time = e.time ? String(e.time).slice(0, 5) : '19:30';
      const timeKey = `${e.date}|${time}`;
      const labelKey = `${e.date}|${normalizeCultoLabel(e.title)}`;

      // Evita duplicar cultos no mesmo dia/horário ou com variações de grafia do mesmo culto
      if (seenDateAndTime.has(timeKey) || seenDateAndLabel.has(labelKey)) {
        return;
      }

      const [y, m, d] = e.date.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      const weekday = dt.getDay();
      const weekdayShort = WEEKDAY_NAMES_SHORT[weekday];
      const weekdayFull = WEEKDAY_NAMES_FULL[weekday];
      const dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
      const isPast = isEventPast(e.date, time);
      const key = `${e.date}_${ruleId || e.title.trim().toLowerCase()}_${time}`;

      if (!cultosMap.has(key)) {
        seenDateAndTime.add(timeKey);
        seenDateAndLabel.add(labelKey);
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

    // 2. Geração determinística de cultos a partir das regras cadastradas (cobre mês anterior + próximos 2 meses completos)
    if (eventRules && eventRules.length > 0) {
      const minMonth = viewMonth < realCurrentMonth ? viewMonth : realCurrentMonth;
      const maxMonth = viewMonth > realCurrentMonth ? viewMonth : realCurrentMonth;
      const prevMonthStr = adjustMonth(minMonth, -1);
      const nextMonthStr = adjustMonth(maxMonth, 2);
      const gen = generateEvents(eventRules as any, `${prevMonthStr}-01`, `${nextMonthStr}-28`);
      gen.forEach(addEventItem);
    }

    // 3. Incluir também cultos já criados no repertório que ainda não estejam no mapa (ex: cultos avulsos já salvos)
    if (repertoire && Array.isArray(repertoire)) {
      repertoire.forEach(item => {
        if (!item?.date) return;
        let cTitle = item.eventRuleTitle || '';
        let cTime = item.eventRuleTime || '';
        if (!cTitle && item.observation) {
          const obsMatch = item.observation.match(/^Culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
          if (obsMatch) {
            cTitle = obsMatch[1].trim();
            if (obsMatch[2]) cTime = obsMatch[2].trim();
          }
        }
        if (cTitle) {
          addEventItem({
            id: item.eventRuleId ? `${item.eventRuleId}|${item.date}` : undefined,
            ruleId: item.eventRuleId || null,
            title: cTitle,
            date: item.date.split('T')[0],
            time: cTime || '19:30',
          });
        }
      });
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
  }, [events, eventRules, viewMonth, realCurrentMonth, repertoire]);

  // Organização inteligente dos cultos para o seletor (inclui próximos meses, contagem de músicas e atalhos rápidos)
  const organizedCultos = useMemo(() => {
    return organizeCultosForSelection(allCalendarCultos, repertoire, 4);
  }, [allCalendarCultos, repertoire]);

  const nextCulto = organizedCultos.nextCulto;
  const quickPickCultos = organizedCultos.quickPickCultos;
  const upcomingByMonth = organizedCultos.upcomingByMonth;
  const upcomingCultos = organizedCultos.upcomingCultos;
  const pastCultos = organizedCultos.pastCultos;

  // Pré-selecionar o próximo culto da agenda automaticamente se nada estiver selecionado,
  // ou se o item salvo no localStorage já passou / não existe mais (quando o rascunho está vazio)
  useEffect(() => {
    if (!nextCulto) return;
    if (!selectedCultoKey) {
      setSelectedCultoKey(nextCulto.key);
      setDate(nextCulto.date);
      localStorage.setItem('repertoire_draft_culto_key', nextCulto.key);
      localStorage.setItem('repertoire_draft_date', nextCulto.date);
      return;
    }

    if (draftItems.length === 0) {
      if (selectedCultoKey === 'custom' && !customCultoTitle.trim()) {
        setSelectedCultoKey(nextCulto.key);
        setDate(nextCulto.date);
        localStorage.setItem('repertoire_draft_culto_key', nextCulto.key);
        localStorage.setItem('repertoire_draft_date', nextCulto.date);
        return;
      }

      if (selectedCultoKey !== 'custom') {
        const found = allCalendarCultos.find(c => c.key === selectedCultoKey);
        if (!found || found.isPast) {
          setSelectedCultoKey(nextCulto.key);
          setDate(nextCulto.date);
          localStorage.setItem('repertoire_draft_culto_key', nextCulto.key);
          localStorage.setItem('repertoire_draft_date', nextCulto.date);
        }
      }
    }
  }, [selectedCultoKey, nextCulto, allCalendarCultos, draftItems.length, customCultoTitle]);

  // Informações completas do culto selecionado
  const selectedCultoInfo = useMemo(() => {
    if (selectedCultoKey === 'custom') {
      return {
        id: null,
        title: customCultoTitle.trim(),
        time: customCultoTime.trim(),
        date: date,
        isCustom: true,
        culto: null
      };
    }
    const found = organizedCultos.upcomingCultos.find(c => c.key === selectedCultoKey) 
      || organizedCultos.pastCultos.find(c => c.key === selectedCultoKey)
      || allCalendarCultos.find(c => c.key === selectedCultoKey);
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
  }, [selectedCultoKey, customCultoTitle, customCultoTime, organizedCultos, allCalendarCultos, date]);

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

  const handleCustomCultoTimeChange = (val: string) => {
    setCustomCultoTime(val);
    localStorage.setItem('repertoire_draft_culto_time', val);
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

  // Particionamento determinístico das playlists (Próximo Culto em Destaque, Futuras e Passadas Arquivadas)
  const { nextPlaylist, upcomingPlaylists, pastPlaylists } = useMemo(() => {
    return partitionPlaylists(groupedRepertoire);
  }, [groupedRepertoire]);

  // Contabilização e Ranking Histórico de Louvores Escolhidos
  const songsRanking = useMemo(() => {
    return calculateSongsRanking(repertoire);
  }, [repertoire]);

  const filteredRanking = useMemo(() => {
    return filterSongRanking(songsRanking, rankingSearch);
  }, [songsRanking, rankingSearch]);

  const totalSongPlays = repertoire.length;
  const topSong = songsRanking[0] || null;

  const togglePastCulto = (groupKey: string) => {
    setExpandedPastKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleExpandAllPast = () => {
    setExpandedPastKeys(new Set(pastPlaylists.map(p => p.groupKey)));
  };

  const handleCollapseAllPast = () => {
    setExpandedPastKeys(new Set());
  };

  const handleAddFromRankingToDraft = (song: SongRankingItem) => {
    const existingLink = song.links[0] || '';
    setDraftItems(prev => [...prev, {
      title: song.displayTitle,
      link: existingLink,
      content: song.content
    }]);
    addToast(`"${song.displayTitle}" adicionada ao rascunho da playlist!`, "success");
    setMainView('playlists');
  };

  const renderPlaylistCard = (group: typeof groupedRepertoire[0], isHighlight = false, isCollapsible = false) => {
    const [y, m, d] = (group.date || '').split('-');
    const isMorning = group.cultoTitle.toLowerCase().includes('manh');
    const isNight = group.cultoTitle.toLowerCase().includes('noite');
    const isExpanded = !isCollapsible || expandedPastKeys.has(group.groupKey);

    return (
      <div 
        key={group.groupKey} 
        className={`animate-slide-up transition-all ${
          isHighlight 
            ? 'p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-secondary/15 via-secondary/5 to-white dark:to-zinc-800 border-2 border-secondary shadow-lg shadow-secondary/15 ring-2 ring-secondary/20' 
            : isCollapsible
              ? 'p-3 rounded-xl bg-zinc-50/90 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 shadow-xs'
              : 'p-1 rounded-2xl'
        }`}
      >
        <div 
          onClick={isCollapsible ? () => togglePastCulto(group.groupKey) : undefined}
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 pb-2 ${
            isCollapsible ? 'cursor-pointer select-none hover:opacity-90' : 'border-b border-zinc-100 dark:border-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`p-2.5 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
              isHighlight 
                ? 'bg-secondary text-white shadow-md shadow-secondary/30' 
                : isMorning 
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/40' 
                  : isNight 
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/40' 
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}>
              {isHighlight ? <Sparkles size={20} className="animate-pulse" /> : isMorning ? <Sun size={18} /> : isNight ? <Moon size={18} /> : <Calendar size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-extrabold ${isHighlight ? 'text-lg sm:text-xl text-zinc-900 dark:text-white' : 'text-base text-zinc-800 dark:text-zinc-100'}`}>
                  {group.cultoTitle}
                </h3>
                {isHighlight && (
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-600">
                    <Clock size={11} /> {group.cultoTime}
                  </span>
                )}
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                  {d}/{m}/{y}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700">
              {group.items.length} {group.items.length === 1 ? 'louvor' : 'louvores'}
            </span>
            {isCollapsible && (
              <button 
                type="button" 
                aria-label={isExpanded ? 'Recolher louvores' : 'Ver louvores'}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className={`mt-3 rounded-xl border overflow-hidden shadow-sm ${
            isHighlight 
              ? 'bg-white dark:bg-zinc-800 border-secondary/30' 
              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
          }`}>
            {group.items.map((item, idx) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group ${
                  idx !== group.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-700/50' : ''
                }`}
              >
                {item.link ? (
                  <a 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1 cursor-pointer group/song"
                    title="Abrir no YouTube / Link"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover/song:scale-105 ${
                      item.link?.includes('spotify') ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 
                      item.link?.includes('youtu') ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 
                      'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {item.link?.includes('youtu') ? <Youtube size={20}/> : (item.link?.includes('cifra') || item.content) ? <FileText size={20}/> : <Music size={20} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate pr-2 group-hover/song:text-red-600 dark:group-hover/song:text-red-400 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap mt-0.5">
                        {item.isFromWorship ? (
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black border border-amber-200 dark:border-amber-700/50 flex items-center gap-1">
                            <Music size={10} /> Louvor
                          </span>
                        ) : (
                          <span>• Adicionado por {(item.addedBy || 'Admin').split(' ')[0]}</span>
                        )}
                        {item.key && <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-bold">Tom: {item.key}</span>}
                        {item.content && (
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedChordItem(item);
                            }}
                            className="bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-zinc-200 dark:border-zinc-600 transition-colors cursor-pointer"
                            title="Ver cifra"
                          >
                            CIFRA
                          </button>
                        )}
                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                      {item.content ? <FileText size={20}/> : <Music size={20} />}
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
                        {item.content && (
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChordItem(item);
                            }}
                            className="bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-zinc-200 dark:border-zinc-600 transition-colors cursor-pointer"
                            title="Ver cifra"
                          >
                            CIFRA
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Abrir no YouTube">
                      <ExternalLink size={18} />
                    </a>
                  )}
                  {mode === 'manage' && (
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir música">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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

      {/* Sub-Abas de Navegação: Playlists de Culto vs Ranking de Louvores */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
        <button
          type="button"
          onClick={() => setMainView('playlists')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mainView === 'playlists'
              ? 'bg-secondary text-white shadow-md shadow-secondary/25'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ListMusic size={16} />
          <span>Playlists de Culto</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
            mainView === 'playlists' ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }`}>
            {groupedRepertoire.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainView('ranking')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mainView === 'ranking'
              ? 'bg-secondary text-white shadow-md shadow-secondary/25'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Trophy size={16} />
          <span>Ranking de Louvores</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
            mainView === 'ranking' ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }`}>
            {songsRanking.length}
          </span>
        </button>
      </div>

      {/* Visão de Playlists */}
      {mainView === 'playlists' && (
        <div className="space-y-6">
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
                      </div>

                      {activeTab === 'youtube' && (
                          <div className="space-y-4 animate-fade-in">
                              <div className="relative">
                                  <input 
                                      type="text" 
                                      placeholder="Pesquisar louvor no YouTube (ex: Bondade de Deus)..." 
                                      value={youtubeQuery} 
                                      onChange={e => setYoutubeQuery(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleYouTubeSearch()}
                                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 pl-10 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-red-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                                  />
                                  <Search className="absolute left-3.5 top-3.5 text-zinc-400" size={16}/>
                                  <button 
                                      onClick={handleYouTubeSearch} 
                                      disabled={youtubeLoading || !youtubeQuery.trim()} 
                                      className="absolute right-2 top-2 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50"
                                  >
                                      {youtubeLoading ? <Loader2 className="animate-spin" size={14}/> : 'Buscar'}
                                  </button>
                              </div>

                              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                  {youtubeResults.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-900/40 hover:bg-red-50/50 dark:hover:bg-red-900/10 rounded-xl border border-zinc-200/60 dark:border-zinc-800 transition-all">
                                          <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
                                              {item.thumbnail ? (
                                                  <img src={item.thumbnail} alt="" className="w-12 h-9 object-cover rounded-md shrink-0 shadow-xs"/>
                                              ) : (
                                                  <div className="w-12 h-9 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center rounded-md shrink-0">
                                                      <Youtube size={16}/>
                                                  </div>
                                              )}
                                              <div className="min-w-0">
                                                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.title}</p>
                                                  <p className="text-[10px] text-zinc-400 truncate">{item.channelTitle || 'YouTube'}</p>
                                              </div>
                                          </div>
                                          <button 
                                              onClick={() => handleAddToDraft(item.title, item.link)}
                                              className="bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg text-xs font-bold transition-all shrink-0"
                                              title="Adicionar à playlist"
                                          >
                                              <Plus size={16}/>
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Staging / Rascunho da Playlist */}
                  <div className="w-full lg:w-96 bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between shrink-0">
                      <div>
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-700">
                              <h4 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                  <ListPlus size={16} className="text-secondary" />
                                  <span>Playlist em Montagem</span>
                              </h4>
                              <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">
                                  {draftItems.length} {draftItems.length === 1 ? 'música' : 'músicas'}
                              </span>
                          </div>

                          <div className="mb-4 space-y-3">
                              {/* 1. ATALHOS RÁPIDOS (1 CLIQUE) PARA OS PRÓXIMOS CULTOS EXISTENTES NO SISTEMA */}
                              {quickPickCultos.length > 0 && (
                                  <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                          <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
                                              <Sparkles size={11} className="text-secondary" />
                                              Próximos Cultos (Toque para selecionar)
                                          </label>
                                          <span className="text-[10px] text-zinc-400 font-medium">
                                              {upcomingCultos.length} agendados
                                          </span>
                                      </div>

                                      <div className="grid grid-cols-1 gap-1.5">
                                          {quickPickCultos.map(c => {
                                              const isSelected = selectedCultoKey === c.key;
                                              const lowerTitle = c.title.toLowerCase();
                                              const isMorning = lowerTitle.includes('manh') || lowerTitle.includes('ebd') || (c.time && parseInt(c.time.split(':')[0], 10) < 12);
                                              const isNight = lowerTitle.includes('noite') || (c.time && parseInt(c.time.split(':')[0], 10) >= 18);

                                              return (
                                                  <button
                                                      key={c.key}
                                                      type="button"
                                                      onClick={() => handleSelectCulto(c)}
                                                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 group ${
                                                          isSelected
                                                              ? 'bg-secondary/15 dark:bg-secondary/20 border-secondary ring-1 ring-secondary/40 shadow-xs'
                                                              : 'bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700/80 hover:border-secondary/50 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                                      }`}
                                                  >
                                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                                              isSelected
                                                                  ? 'bg-secondary text-white shadow-xs'
                                                                  : isMorning
                                                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                                                    : isNight
                                                                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                                                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                                          }`}>
                                                              {isMorning ? <Sun size={15} /> : isNight ? <Moon size={15} /> : <Calendar size={15} />}
                                                          </div>

                                                          <div className="min-w-0 flex-1">
                                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                                  <span className={`text-xs font-extrabold truncate ${isSelected ? 'text-secondary dark:text-white' : 'text-zinc-800 dark:text-zinc-100'}`}>
                                                                      {c.title}
                                                                  </span>
                                                                  {c.isNext && (
                                                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-secondary text-white shrink-0">
                                                                          ⭐ Próximo
                                                                      </span>
                                                                  )}
                                                              </div>
                                                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                                      {c.weekdayShort}, {c.dateDisplay}
                                                                  </span>
                                                                  <span>•</span>
                                                                  <span className="font-mono font-bold">{c.time}</span>
                                                                  {typeof c.songsCount === 'number' && c.songsCount > 0 && (
                                                                      <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-md border border-emerald-200/60 dark:border-emerald-800/50">
                                                                          <Music size={9} /> {c.songsCount}
                                                                      </span>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>

                                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                                                          isSelected
                                                              ? 'bg-secondary border-secondary text-white scale-105'
                                                              : 'border-zinc-300 dark:border-zinc-600 text-transparent group-hover:border-secondary/60'
                                                      }`}>
                                                          <Check size={12} strokeWidth={3} />
                                                      </div>
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              )}

                              {/* 2. SELETOR COMPLETO DE TODOS OS CULTOS DO CALENDÁRIO (AGRUPADOS POR MÊS) */}
                              <div>
                                  <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] uppercase font-bold text-zinc-500">
                                          Todos os Cultos do Calendário
                                      </label>
                                      <div className="flex items-center gap-2">
                                          {pastCultos.length > 0 && (
                                              <button
                                                  type="button"
                                                  onClick={() => setShowPastCultos(prev => !prev)}
                                                  className="text-[10px] text-zinc-500 hover:text-secondary flex items-center gap-1 transition-colors font-semibold"
                                              >
                                                  {showPastCultos ? <EyeOff size={11} /> : <Eye size={11} />}
                                                  <span>{showPastCultos ? 'Ocultar realizados' : `Realizados (${pastCultos.length})`}</span>
                                              </button>
                                          )}
                                      </div>
                                  </div>

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
                                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-secondary font-semibold transition-all text-zinc-900 dark:text-zinc-100 shadow-xs"
                                  >
                                      <option value="">Selecione um culto na lista completa...</option>

                                      {/* Próximo Culto da Agenda Sempre no Topo */}
                                      {nextCulto && (
                                          <optgroup label="⭐ Próximo Culto da Agenda">
                                              <option value={nextCulto.key}>
                                                  ⭐ [PRÓXIMO] {nextCulto.weekdayFull}, {nextCulto.dateDisplay} às {nextCulto.time} — {nextCulto.title}{nextCulto.songsCount ? ` (${nextCulto.songsCount} músicas)` : ''}
                                              </option>
                                          </optgroup>
                                      )}

                                      {/* Todos os Cultos Futuros Agrupados por Mês (não esconde o mês seguinte no fim do mês!) */}
                                      {upcomingByMonth.map(group => {
                                          const items = group.cultos.filter(c => !nextCulto || c.key !== nextCulto.key);
                                          if (items.length === 0) return null;
                                          return (
                                              <optgroup key={group.monthKey} label={`📅 Cultos de ${getMonthName(group.monthKey)}`}>
                                                  {items.map(c => (
                                                      <option key={c.key} value={c.key}>
                                                          {c.weekdayShort}, {c.dateDisplay} às {c.time} — {c.title}{c.songsCount ? ` (🎵 ${c.songsCount})` : ''}
                                                      </option>
                                                  ))}
                                              </optgroup>
                                          );
                                      })}

                                      {/* Cultos Anteriores / Já Realizados */}
                                      {showPastCultos && pastCultos.length > 0 && (
                                          <optgroup label="⏳ Cultos Já Realizados (Mais recentes primeiro)">
                                              {pastCultos.map(c => (
                                                  <option key={c.key} value={c.key} className="text-zinc-400">
                                                      ⏳ {c.weekdayShort}, {c.dateDisplay} às {c.time} — {c.title}{c.songsCount ? ` (${c.songsCount} músicas)` : ' (Realizado)'}
                                                  </option>
                                              ))}
                                          </optgroup>
                                      )}

                                      <optgroup label="Outro / Data Especial">
                                          <option value="custom">✏️ Culto Avulso / Extra (Escolher outra data)</option>
                                      </optgroup>
                                  </select>

                                  {/* Botão Rápido para Culto Extra / Outra Data */}
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                      <button
                                          type="button"
                                          onClick={() => {
                                              if (selectedCultoKey === 'custom' && nextCulto) {
                                                  handleSelectCulto(nextCulto);
                                              } else {
                                                  setSelectedCultoKey('custom');
                                                  localStorage.setItem('repertoire_draft_culto_key', 'custom');
                                                  if (!date && nextCulto) {
                                                      handleDateChange(nextCulto.date);
                                                  }
                                              }
                                          }}
                                          className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                              selectedCultoKey === 'custom'
                                                  ? 'bg-secondary text-white border-secondary shadow-xs'
                                                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-secondary/50'
                                          }`}
                                      >
                                          <Calendar size={12} />
                                          <span>
                                              {selectedCultoKey === 'custom'
                                                  ? '✓ Modo Culto Avulso / Data Personalizada Ativo'
                                                  : '✏️ Criar para Culto Extra ou Outra Data'}
                                          </span>
                                      </button>
                                  </div>
                              </div>

                              {/* 3. PAINEL DE CULTO AVULSO / EXTRA */}
                              {selectedCultoKey === 'custom' && (
                                  <div className="mt-2 space-y-2.5 p-3 bg-zinc-100 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-fade-in">
                                      <div>
                                          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Título do Culto</label>
                                          <input
                                              type="text"
                                              placeholder="Ex: Culto Dom - Noite, Santa Ceia, Vigília..."
                                              value={customCultoTitle}
                                              onChange={e => handleCustomCultoChange(e.target.value)}
                                              className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"
                                              autoFocus
                                          />
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                          <div>
                                              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Data do Culto</label>
                                              <input
                                                  ref={dateInputRef}
                                                  type="date"
                                                  value={date}
                                                  onChange={e => handleDateChange(e.target.value)}
                                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Horário</label>
                                              <input
                                                  type="time"
                                                  value={customCultoTime}
                                                  onChange={e => handleCustomCultoTimeChange(e.target.value)}
                                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* Prévia do culto selecionado */}
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
              </div>
          )}

          {/* 1. SEÇÃO DE DESTAQUE: PLAYLIST DO PRÓXIMO CULTO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-secondary" />
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  Playlist em Destaque (Próximo Culto)
                </h3>
              </div>
              {nextPlaylist && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary">
                  ⭐ Destaque Oficial
                </span>
              )}
            </div>

            {nextPlaylist ? (
              renderPlaylistCard(nextPlaylist, true, false)
            ) : (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-secondary/15 via-secondary/5 to-transparent border-2 border-dashed border-secondary/40 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0 shadow-xs">
                    <Music2 size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase bg-secondary text-white px-2 py-0.5 rounded-full">
                      ⭐ Próximo Culto da Agenda
                    </span>
                    <h4 className="text-base font-bold text-zinc-800 dark:text-zinc-100 mt-1">
                      {nextCulto ? `${nextCulto.title} (${nextCulto.dateDisplay} às ${nextCulto.time})` : 'Próximo culto da agenda'}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      A playlist para este culto ainda não foi publicada pela equipe de louvor.
                    </p>
                  </div>
                </div>
                {mode === 'manage' && nextCulto && (
                  <button
                    onClick={() => handleSelectCulto(nextCulto)}
                    className="px-4 py-2 bg-secondary hover:bg-secondaryHover text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-secondary/20 flex items-center gap-1.5 shrink-0"
                  >
                    <Plus size={14} /> Montar Playlist do Próximo Culto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. OUTRAS PLAYLISTS FUTURAS (SE HOUVER) */}
          {upcomingPlaylists.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                <Calendar size={18} className="text-secondary" />
                <h3 className="text-base font-bold text-zinc-800 dark:text-white">
                  Outras Playlists Agendadas ({upcomingPlaylists.length})
                </h3>
              </div>
              <div className="space-y-4">
                {upcomingPlaylists.map(g => renderPlaylistCard(g, false, false))}
              </div>
            </div>
          )}

          {/* 3. ARMAZENAMENTO DE PLAYLISTS QUE JÁ PASSARAM (HISTÓRICO ACORDEÃO) */}
          {pastPlaylists.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl">
                    <Archive size={18} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      Histórico de Playlists Anteriores
                      <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full border border-zinc-200 dark:border-zinc-700">
                        {pastPlaylists.length} {pastPlaylists.length === 1 ? 'culto realizado' : 'cultos realizados'}
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Playlists de cultos já realizados mantidas de forma compacta. Clique em qualquer culto para abrir ou recolher.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleExpandAllPast}
                    className="text-xs font-bold text-secondary hover:underline px-2 py-1"
                  >
                    Expandir todos
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={handleCollapseAllPast}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1"
                  >
                    Recolher todos
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {pastPlaylists.map(g => renderPlaylistCard(g, false, true))}
              </div>
            </div>
          )}

          {groupedRepertoire.length === 0 && (
            <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <Music className="mx-auto mb-3 opacity-20" size={48}/>
              <p>Nenhuma playlist encontrada no repertório.</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-Aba: Ranking de Louvores */}
      {mainView === 'ranking' && (
        <div className="space-y-6 animate-fade-in">
          {/* Métricas do Catálogo de Louvores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Louvores Únicos</span>
                <Music size={16} className="text-secondary" />
              </div>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">
                {songsRanking.length}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">músicas no catálogo</p>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Ministrações</span>
                <TrendingUp size={16} className="text-green-500" />
              </div>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">
                {totalSongPlays}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">escolhas em cultos</p>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Mais Tocada (#1)</span>
                <Trophy size={16} className="text-amber-500" />
              </div>
              <p className="text-base font-black text-zinc-900 dark:text-white truncate" title={topSong?.displayTitle || '-'}>
                {topSong?.displayTitle || '-'}
              </p>
              <p className="text-[11px] text-secondary font-bold mt-0.5">
                {topSong ? `${topSong.count} ${topSong.count === 1 ? 'vez escolhida' : 'vezes escolhida'}` : 'Nenhuma'}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Última Atualização</span>
                <Clock size={16} className="text-blue-500" />
              </div>
              <p className="text-base font-black text-zinc-900 dark:text-white">
                {topSong?.lastDate ? topSong.lastDate.split('-').reverse().join('/') : '-'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">culto mais recente</p>
            </div>
          </div>

          {/* Barra de Pesquisa e Filtros do Ranking */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar louvor pelo título (ex: Bondade de Deus, Porque Ele Vive)..."
                value={rankingSearch}
                onChange={e => setRankingSearch(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 pl-9 pr-8 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
              <Search className="absolute left-3 top-3 text-zinc-400" size={16} />
              {rankingSearch && (
                <button
                  onClick={() => setRankingSearch('')}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 self-end sm:self-auto">
              <BarChart3 size={14} className="text-secondary" />
              <span>
                Exibindo <strong className="text-zinc-800 dark:text-zinc-200">{filteredRanking.length}</strong> de {songsRanking.length} louvores
              </span>
            </div>
          </div>

          {/* Lista do Ranking de Músicas */}
          {filteredRanking.length === 0 ? (
            <div className="text-center py-14 text-zinc-400 bg-white dark:bg-zinc-800 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
              <Trophy className="mx-auto mb-3 opacity-20" size={48} />
              <p className="font-semibold text-sm">Nenhum louvor encontrado para a busca.</p>
              {rankingSearch && (
                <button
                  onClick={() => setRankingSearch('')}
                  className="mt-2 text-xs font-bold text-secondary hover:underline"
                >
                  Limpar termo de busca
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRanking.map((song, index) => {
                const isFirst = index === 0 && !rankingSearch;
                const isSecond = index === 1 && !rankingSearch;
                const isThird = index === 2 && !rankingSearch;
                const maxCount = topSong?.count || 1;
                const frequencyPercent = Math.max(8, Math.round((song.count / maxCount) * 100));
                const isHistoryOpen = expandedSongHistoryKey === song.normalizedTitle;
                const [y, m, d] = song.lastDate ? song.lastDate.split('-') : ['', '', ''];

                return (
                  <div
                    key={song.normalizedTitle}
                    className={`p-4 rounded-2xl border transition-all animate-slide-up ${
                      isFirst
                        ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white dark:to-zinc-800 border-amber-500/40 shadow-md ring-1 ring-amber-500/20'
                        : isSecond
                          ? 'bg-zinc-50/80 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 shadow-xs'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/80 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Medalha / Posição no Ranking */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          isFirst
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-300'
                            : isSecond
                              ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-900 shadow-zinc-400/20'
                              : isThird
                                ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-amber-700/20'
                                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 font-mono text-xs'
                        }`}>
                          {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${index + 1}`}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-base text-zinc-900 dark:text-white truncate">
                              {song.displayTitle}
                            </h4>
                            {isFirst && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                                Mais Tocada
                              </span>
                            )}
                            {song.key && (
                              <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                                Tom: {song.key}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap">
                            <span className="font-semibold text-secondary">
                              {song.count} {song.count === 1 ? 'vez escolhida' : 'vezes escolhida'}
                            </span>
                            <span>•</span>
                            <span>Última vez em {d}/{m}/{y} ({song.lastCultoTitle})</span>
                          </div>

                          {/* Barra de Frequência Proporcional */}
                          <div className="w-full max-w-xs bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${isFirst ? 'bg-amber-500' : 'bg-secondary'}`}
                              style={{ width: `${frequencyPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação do Louvor */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {song.links[0] && (
                          <a
                            href={song.links[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Ouvir no YouTube"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedSongHistoryKey(isHistoryOpen ? null : song.normalizedTitle)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${
                            isHistoryOpen
                              ? 'bg-secondary/15 text-secondary border-secondary/30'
                              : 'bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                          }`}
                          title="Ver histórico de cultos"
                        >
                          <History size={13} />
                          <span>Histórico ({song.occurrences.length})</span>
                          {isHistoryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {mode === 'manage' && (
                          <button
                            type="button"
                            onClick={() => handleAddFromRankingToDraft(song)}
                            className="px-3 py-1.5 bg-secondary hover:bg-secondaryHover text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95"
                            title="Adicionar à playlist do culto selecionado"
                          >
                            <Plus size={14} />
                            <span className="hidden sm:inline">Adicionar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Acordeão de Histórico dos Cultos onde a música foi tocada */}
                    {isHistoryOpen && (
                      <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-700/80 space-y-2 animate-fade-in">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                          Cultos em que "{song.displayTitle}" foi ministrada:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {song.occurrences.map((occ, oIdx) => {
                            const [oy, om, od] = occ.date.split('-');
                            return (
                              <div
                                key={oIdx}
                                className="p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-bold text-zinc-800 dark:text-zinc-200">{occ.cultoTitle}</p>
                                  <p className="text-[11px] text-zinc-500">{od}/{om}/{oy} {occ.cultoTime ? `às ${occ.cultoTime}` : ''}</p>
                                </div>
                                {occ.link && (
                                  <a
                                    href={occ.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-400 hover:text-red-500 p-1"
                                    title="Link do culto"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
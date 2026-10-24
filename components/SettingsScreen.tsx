import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Moon,
  Sun,
  BellRing,
  Monitor,
  Loader2,
  CalendarClock,
  Lock,
  Unlock,
  BellOff,
  Check,
  ShieldCheck,
  ArrowRight,
  CreditCard,
  Zap,
  ExternalLink,
  X,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Plus,
  Building2,
  AlertCircle,
  Clock,
  Bell,
  CalendarCheck,
  CalendarX,
  CalendarRange,
  Send,
} from "lucide-react";

import { useToast } from "./Toast";
import { LegalModal, LegalDocType } from "./LegalDocuments";
import {
  ThemeMode,
  Organization,
  MinistryDef,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../types";
export type { NotificationSettings };
export { DEFAULT_NOTIFICATION_SETTINGS };
import { sendNotificationSQL, getSupabase } from "../services/supabaseService";
import { getSystemLogo } from "../utils/branding";

interface NewMinistryData {
  code: string;
  label: string;
}

interface Props {
  initialTitle: string;
  ministryId: string | null;
  events?: any[];
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSaveTheme?: () => void;
  onSaveTitle: (newTitle: string) => Promise<void>;
  onAnnounceUpdate?: () => Promise<void>;
  onEnableNotifications?: () => Promise<void>;
  onSaveAvailabilityWindow?: (start: string, end: string) => Promise<void>;
  availabilityWindow?: { start?: string; end?: string };
  isAdmin?: boolean;
  orgId: string;
  onSaveEnabledTabs?: (tabs: string[]) => Promise<void>;
  ministryConfig?: any;
  organization: Organization | null;
  onSaveIntegrations?: (
    spotifyId?: string,
    spotifySecret?: string,
    youtubeKey?: string,
    quickAccessItems?: string[],
  ) => Promise<void>;
  onSaveGuidelines?: (guidelines: string) => Promise<void>;
  onSaveOrgLogo?: (file: File | null) => Promise<string | null>;
  onSaveReminderHour?: (hour: number) => Promise<void>;
  onSaveNotificationSettings?: (settings: NotificationSettings) => Promise<void>;
  ministries?: MinistryDef[];
  isOrgAdmin?: boolean;
  onRefreshMinistries?: () => Promise<void>;
}

const MEMBER_TABS = [
  { id: "dashboard", label: "Início" },
  { id: "announcements", label: "Avisos" },
  { id: "calendar", label: "Calendário" },
  { id: "availability", label: "Ausências" },
  { id: "swaps", label: "Trocas" },
  { id: "repertoire", label: "Repertório" },
  { id: "ranking", label: "Destaques" },
  { id: "history", label: "Histórico de Escala" },
];

const QUICK_ACCESS_OPTIONS = [
  { id: "calendar", label: "Ver Escala" },
  { id: "availability", label: "Ausências" },
  { id: "history", label: "Histórico de Escala" },
  { id: "swaps", label: "Trocas" },
  { id: "repertoire", label: "Repertório" },
];

export const SettingsScreen: React.FC<Props> = ({
  initialTitle,
  ministryId,
  themeMode,
  onSetThemeMode,
  onSaveTheme,
  onSaveTitle,
  onAnnounceUpdate,
  onEnableNotifications,
  onSaveAvailabilityWindow,
  availabilityWindow,
  isAdmin = false,
  orgId,
  onSaveEnabledTabs,
  ministryConfig,
  organization,
  onSaveIntegrations,
  onSaveGuidelines,
  onSaveOrgLogo,
  onSaveReminderHour,
  onSaveNotificationSettings,
  ministries = [],
  events,
  isOrgAdmin = false,
  onRefreshMinistries,
}) => {
  const [tempTitle, setTempTitle] = useState(
    initialTitle && initialTitle !== "Carregando..." ? initialTitle : ""
  );
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");
  const [selectedReminderHour, setSelectedReminderHour] = useState<number>(
    typeof ministryConfig?.reminderHour === "number" ? ministryConfig.reminderHour : 8,
  );
  const [isSavingReminderHour, setIsSavingReminderHour] = useState(false);
  const [tempGuidelines, setTempGuidelines] = useState(
    ministryConfig?.practicalGuidelines || "",
  );
  const [fieldErrors, setFieldErrors] = useState<{ministryName?: string; availStart?: string; availEnd?: string}>({});

  const [logoPreview, setLogoPreview] = useState(
    organization?.logo_url ||
      getSystemLogo(themeMode === "dark" ? "dark" : "light"),
  );
  const [logoLoading, setLogoLoading] = useState(false);
  const isEnterprise = organization?.plan_type === "enterprise";

  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>("default");
  
  const [activeTab, setActiveTab] = useState<
    "geral" | "admin" | "notif" | "ministries"
  >("geral");

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => {
    const cfg = ministryConfig?.notificationSettings;
    if (cfg && typeof cfg === "object") {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...cfg };
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  });
  const [isSavingNotif, setIsSavingNotif] = useState(false);

  const [isNewMinistryModalOpen, setIsNewMinistryModalOpen] = useState(false);
  const [newMinistryData, setNewMinistryData] = useState<NewMinistryData>({
    code: "",
    label: "",
  });
  const [isCreatingMinistry, setIsCreatingMinistry] = useState(false);

  const { addToast } = useToast();

    const toLocalInput = (isoString?: string) => {
    if (!isoString) return "";
    if (isoString.includes("1970")) return "";
    const d = new Date(isoString);
    if (d.getFullYear() === 1970 || d.getUTCFullYear() === 1970) return "";
    try {
      // Evita deslocamento de fuso: mantém o horário exatamente como salvo
      return new Date(isoString).toISOString().slice(0, 16);
    } catch (e) {
      return "";
    }
  };

  const fromLocalInput = (localString: string) => {
    if (!localString) return "";
    // Trata o valor do input como UTC para não haver deslocamento de fuso
    return new Date(localString + "Z").toISOString();
  };

  const validateField = (field: 'ministryName' | 'availStart' | 'availEnd', value: string) => {
    let error = '';
    if (field === 'ministryName' && (!value.trim() || value.trim() === 'Carregando...')) {
      error = 'Nome do ministério é obrigatório';
    } else if (field === 'availStart' && availEnd && value && value >= availEnd) {
      error = 'Abertura deve ser antes do fechamento';
    } else if (field === 'availEnd' && availStart && value && value <= availStart) {
      error = 'Fechamento deve ser após a abertura';
    }
    setFieldErrors(prev => ({ ...prev, [field]: error || undefined }));
    return !error;
  };

  useEffect(() => {
    if (initialTitle && initialTitle !== "Carregando...") {
      setTempTitle(initialTitle);
    }
  }, [initialTitle]);

  useEffect(() => {
    if (availabilityWindow) {
      setAvailStart(toLocalInput(availabilityWindow.start));
      setAvailEnd(toLocalInput(availabilityWindow.end));
    }
  }, [availabilityWindow]);

  useEffect(() => {
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof ministryConfig?.reminderHour === "number") {
      setSelectedReminderHour(ministryConfig.reminderHour);
    }
  }, [ministryConfig?.reminderHour]);

  useEffect(() => {
    const cfg = ministryConfig?.notificationSettings;
    if (cfg && typeof cfg === "object") {
      setNotifSettings((prev) => ({ ...prev, ...cfg }));
    }
  }, [ministryConfig?.notificationSettings]);

  const handleSaveNotifSettings = async () => {
    if (!onSaveNotificationSettings) return;
    setIsSavingNotif(true);
    try {
      // Sync scale_day hour with the existing reminderHour so both stay aligned
      const merged: NotificationSettings = {
        ...notifSettings,
        scale_day: { ...notifSettings.scale_day },
      };
      await onSaveNotificationSettings(merged);
      if (onSaveReminderHour) {
        await onSaveReminderHour(merged.scale_day.hour);
      }
      addToast("Configurações de notificações salvas!", "success");
    } catch {
      addToast("Erro ao salvar configurações de notificações.", "error");
    } finally {
      setIsSavingNotif(false);
    }
  };

  const handleSaveReminderHour = async () => {
    if (!onSaveReminderHour) return;
    setIsSavingReminderHour(true);
    try {
      await onSaveReminderHour(selectedReminderHour);
    } finally {
      setIsSavingReminderHour(false);
    }
  };

  const isWindowActive = () => {
    const dbStart = availabilityWindow?.start;
    const isDbBlocked =
      dbStart &&
      (dbStart.includes("1970") || new Date(dbStart).getUTCFullYear() === 1970);

    if (isDbBlocked) return false;
    if (!dbStart && !availabilityWindow?.end && !availStart && !availEnd)
      return true;

    const startIso = availStart ? fromLocalInput(availStart) : dbStart;
    const endIso = availEnd
      ? fromLocalInput(availEnd)
      : availabilityWindow?.end;

    if (!startIso || !endIso) return true;

    const now = new Date();
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (s.getUTCFullYear() === 1970) return false;

    return now >= s && now <= e;
  };

  const status = isWindowActive();

  const handleSaveAdvanced = async () => {
    const startValid = validateField('availStart', availStart);
    const endValid = validateField('availEnd', availEnd);
    if (!startValid || !endValid) return;

    if (onSaveAvailabilityWindow && ministryId && orgId) {
      const startISO = fromLocalInput(availStart);
      const endISO = fromLocalInput(availEnd);

      await onSaveAvailabilityWindow(startISO, endISO);

      const now = new Date();
      const s = new Date(startISO);
      const e = new Date(endISO);

      const isOpenNow = now >= s && now <= e;

      if (isOpenNow) {
        await sendNotificationSQL(ministryId, orgId, {
          title: "🗓️ Apontamento de Ausências Liberado!",
          message: `O prazo para registrar ausências na escala está aberto até ${e.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
          type: "info",
          actionLink: "availability",
        });
      } else {
        await sendNotificationSQL(ministryId, orgId, {
          title: "🔒 Janela Encerrada",
          message:
            "O período para apontamento de ausências na escala foi encerrado/alterado.",
          type: "warning",
          actionLink: "availability",
        }).catch(() => {});
      }

      addToast("Período atualizado e notificação enviada!", "success");
    }
  };

  const handleQuickAction = async (action: "block" | "open") => {
    if (!onSaveAvailabilityWindow || !ministryId || !orgId) return;

    const now = new Date();
    let newStartStr = "";
    let newEndStr = "";

    if (action === "block") {
      newStartStr = "1970-01-01T00:00:00.000Z";
      newEndStr = "1970-01-01T00:00:00.000Z";

      await sendNotificationSQL(ministryId, orgId, {
        title: "🔒 Janela Fechada",
        message: "O período para apontamento de ausências na escala foi encerrado.",
        type: "warning",
        actionLink: "availability",
      }).catch(() => {});

      addToast("Janela bloqueada com sucesso.", "warning");
    } else {
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startNow = new Date(now.getTime() - 60000);

      newStartStr = startNow.toISOString();
      newEndStr = nextWeek.toISOString();

      addToast("Janela liberada por 7 dias.", "success");

      const endDateFormatted = nextWeek.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      await sendNotificationSQL(ministryId, orgId, {
        title: "🗓️ Apontamento de Ausências Liberado!",
        message: `O período para registrar suas ausências na escala está aberto até ${endDateFormatted}. Informe suas datas no app!`,
        type: "success",
        actionLink: "availability",
      }).catch(() => {});
    }

    await onSaveAvailabilityWindow(newStartStr, newEndStr);
    setAvailStart(toLocalInput(newStartStr));
    setAvailEnd(toLocalInput(newEndStr));
  };

  const handleSendDeadlineAlert = async () => {
    if (!ministryId || !orgId) return;
    const endIso = availEnd ? fromLocalInput(availEnd) : availabilityWindow?.end;
    if (!endIso) {
      addToast("Nenhuma data limite definida para a janela de ausências.", "warning");
      return;
    }
    const e = new Date(endIso);
    const dateFormatted = e.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const timeFormatted = e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    await sendNotificationSQL(ministryId, orgId, {
      title: "⏳ Alerta de Prazo: Apontamento de Ausência",
      message: `Atenção: o prazo para informar suas ausências na escala encerra em ${dateFormatted} às ${timeFormatted}. Não deixe para a última hora!`,
      type: "warning",
      actionLink: "availability",
    }).catch(() => {});

    addToast("Alerta de prazo enviado com sucesso para todos os membros!", "success");
  };

  const handleCreateMinistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMinistryData.label || !newMinistryData.code) {
      addToast("Preencha o nome e a sigla do ministério.", "warning");
      return;
    }
    
    setIsCreatingMinistry(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Supabase não inicializado");
      
      const { data, error } = await sb.rpc('create_org_ministry', {
        p_org_id: orgId,
        p_code: newMinistryData.code,
        p_label: newMinistryData.label
      });

      if (error) throw error;
      
      if (data?.success) {
        addToast(data.message, "success");
        setIsNewMinistryModalOpen(false);
        setNewMinistryData({ code: "", label: "" });
        if (onRefreshMinistries) {
          await onRefreshMinistries();
        }
      } else {
        addToast(data?.message || "Erro ao criar ministério", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Erro de conexão", "error");
    } finally {
      setIsCreatingMinistry(false);
    }
  };

  const handleNotificationClick = async () => {
    if (!onEnableNotifications) return;
    if (notifPermission === "denied") {
      alert(
        "Notificações bloqueadas no navegador. Por favor, habilite-as nas configurações do site.",
      );
      return;
    }
    setIsNotifLoading(true);
    try {
      await onEnableNotifications();
      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsNotifLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        addToast("Service Worker não suportado neste dispositivo.", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification("Ministral — Notificação de Teste", {
          body: "O sistema de notificações está funcionando perfeitamente no seu dispositivo!",
          icon: "/branding/icon-light.png",
          badge: "/branding/favicon-light.png",
          data: { url: "/" },
        } as any);
        addToast("Notificação de teste enviada!", "success");
      }
    } catch (err: any) {
      addToast("Erro ao exibir notificação: " + (err?.message || err), "error");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-10">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <Settings className="text-zinc-500" /> Configurações
          </h2>
          {isAdmin && (
            <div role="tablist" aria-label="Configurações" className="bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl flex items-center shadow-inner overflow-x-auto gap-0.5">
              <button
                role="tab"
                aria-selected={activeTab === "geral"}
                aria-controls="panel-geral"
                onClick={() => setActiveTab("geral")}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "geral" ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Geral
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "admin"}
                aria-controls="panel-admin"
                onClick={() => setActiveTab("admin")}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "admin" ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Administrador
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "notif"}
                aria-controls="panel-notif"
                onClick={() => setActiveTab("notif")}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === "notif" ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                <Bell size={13} />
                Notificações
              </button>
              {isOrgAdmin && (
                <button
                  role="tab"
                  aria-selected={activeTab === "ministries"}
                  aria-controls="panel-ministries"
                  onClick={() => setActiveTab("ministries")}
                  className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "ministries" ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  Ministérios
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeTab === "admin" && isAdmin && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden relative group">
          <div
            className={`relative px-4 py-4 sm:px-5 sm:py-5 transition-colors duration-500 ${status ? "bg-gradient-to-br from-secondaryHover via-secondary to-ministral-dark" : "bg-gradient-to-br from-zinc-700 via-zinc-800 to-black"}`}
          >
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md border border-white/20 backdrop-blur-md ${status ? "bg-secondary/30" : "bg-red-500/20"}`}
                >
                  {status ? (
                    <Unlock size={20} className="text-white" />
                  ) : (
                    <Lock size={20} className="text-red-100" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">
                      Janela de Apontamento de Ausências
                    </h3>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${status ? "bg-secondary/80 text-white border-secondary/50" : "bg-red-500 text-white border-red-400"}`}
                    >
                      {status ? "Aberta" : "Fechada"}
                    </span>
                  </div>
                  <p className="text-white/70 text-xs font-medium">
                    {status
                      ? "Os membros podem apontar suas ausências no app."
                      : "O apontamento de ausências está bloqueado."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                <CalendarClock size={14} /> Configuração de Período
              </label>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-0 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-1 shadow-inner">
                <div className="flex-1 relative group">
                  <label className="absolute left-4 top-2 text-[10px] font-bold text-zinc-400 uppercase">
                    Abertura
                  </label>
                  <input
                    type="datetime-local"
                    value={availStart}
                    onChange={(e) => setAvailStart(e.target.value)}
                    onBlur={() => validateField('availStart', availStart)}
                    aria-invalid={!!fieldErrors.availStart}
                    aria-describedby={fieldErrors.availStart ? 'error-avail-start' : undefined}
                    className={`w-full bg-transparent border-none rounded-xl pt-6 pb-2 px-4 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:bg-white dark:focus:bg-zinc-800 transition-colors ${fieldErrors.availStart ? 'ring-2 ring-red-500' : ''}`}
                  />
                </div>
                <div className="hidden md:flex items-center justify-center w-8 text-zinc-300 dark:text-zinc-600">
                  <ArrowRight size={16} />
                </div>
                <div className="flex-1 relative group">
                  <label className="absolute left-4 top-2 text-[10px] font-bold text-zinc-400 uppercase">
                    Fechamento
                  </label>
                  <input
                    type="datetime-local"
                    value={availEnd}
                    onChange={(e) => setAvailEnd(e.target.value)}
                    onBlur={() => validateField('availEnd', availEnd)}
                    aria-invalid={!!fieldErrors.availEnd}
                    aria-describedby={fieldErrors.availEnd ? 'error-avail-end' : undefined}
                    className={`w-full bg-transparent border-none rounded-xl pt-6 pb-2 px-4 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:bg-white dark:focus:bg-zinc-800 transition-colors text-right md:text-left ${fieldErrors.availEnd ? 'ring-2 ring-red-500' : ''}`}
                  />
                </div>
              </div>
              {(fieldErrors.availStart || fieldErrors.availEnd) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-500" role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.availStart || fieldErrors.availEnd}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleSaveAdvanced}
                className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-zinc-100 dark:bg-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs sm:text-sm transition-all border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                <Save size={16} /> Salvar & Notificar
              </button>

              {status ? (
                <button
                  onClick={() => handleQuickAction("block")}
                  className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <Lock size={16} /> Bloquear Imediatamente
                </button>
              ) : (
                <button
                  onClick={() => handleQuickAction("open")}
                  className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-secondary hover:bg-secondaryHover text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-secondary/20 hover:shadow-secondaryHover/40 active:scale-95 group"
                >
                  <Unlock
                    size={16}
                    className="group-hover:rotate-12 transition-transform"
                  />{" "}
                  Liberar por 7 Dias
                </button>
              )}
            </div>

            {status && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/60">
                <button
                  onClick={handleSendDeadlineAlert}
                  className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95"
                  title="Enviar alerta push/in-app relembrando os membros da data limite de envio de ausências"
                >
                  <Clock size={16} /> Enviar Alerta de Prazo aos Membros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ ABA: NOTIFICAÇÕES ═══════ */}
      {activeTab === "notif" && isAdmin && (
        <div id="panel-notif" role="tabpanel" className="space-y-5 animate-fade-in">
          {/* Header */}
          <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent border border-secondary/20 rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-secondary/15 flex items-center justify-center border border-secondary/20 shrink-0">
              <Bell size={22} className="text-secondary" />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 dark:text-white text-base">Notificações Push Automáticas</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Configure quais alertas automáticos seus membros recebem e em qual horário (fuso Brasília, UTC-3). O sistema roda automaticamente a cada hora.
              </p>
            </div>
          </div>

          {([
            {
              key: "scale_day" as const,
              icon: <CalendarCheck size={20} />,
              color: "amber",
              title: "📅 Lembrete — Dia da Escala",
              badge: "Diário | Por Membro",
              desc: "Envia um push individual para cada voluntário escalado no próprio dia do culto ou evento, pedindo confirmação de presença.",
              preview: (h: number) => ({ title: "Você está escalado hoje!", body: `Hoje às ${String(h).padStart(2,"0")}:00. Confirme sua presença no app.` }),
              showDaysBefore: false,
            },
            {
              key: "eve_reminder" as const,
              icon: <CalendarRange size={20} />,
              color: "blue",
              title: "🔔 Lembrete — Véspera do Culto",
              badge: "1-3 dias antes | Por Membro",
              desc: "Notifica o voluntário alguns dias antes do evento para que possa se preparar (repertório, figurino, logística).",
              preview: (h: number, d?: number) => ({ title: "Culto se aproxima!", body: `Você está escalado em ${d ?? 1} dia(s). Prepare-se e verifique o repertório.` }),
              showDaysBefore: true,
            },
            {
              key: "window_open" as const,
              icon: <Unlock size={20} />,
              color: "emerald",
              title: "🗓️ Abertura — Janela de Ausências",
              badge: "1× por mês | Toda Equipe",
              desc: "Avisa todos os membros que o período para registrar ausências foi aberto, incentivando o preenchimento imediato.",
              preview: (_h: number) => ({ title: "Disponibilidade Liberada!", body: `O período para apontar ausências abriu. Acesse o app e marque seus dias antes do prazo.` }),
              showDaysBefore: false,
            },
            {
              key: "window_close" as const,
              icon: <CalendarX size={20} />,
              color: "red",
              title: "⏰ Alerta — Prazo de Ausências Encerrando",
              badge: "1× por ciclo | Toda Equipe",
              desc: "Lembra os membros que a janela de disponibilidade está se encerrando, incentivando quem ainda não respondeu.",
              preview: (_h: number) => ({ title: "Prazo Encerrando!", body: `Último aviso: marque sua disponibilidade agora antes que a janela feche.` }),
              showDaysBefore: false,
            },
            {
              key: "schedule_publish" as const,
              icon: <Send size={20} />,
              color: "purple",
              title: "📋 Publicação da Nova Escala",
              badge: "Manual | Toda Equipe",
              desc: "Quando o administrador publicar a escala do próximo período, todos os membros são notificados para consultar seus dias escalados.",
              preview: (_h: number) => ({ title: "Nova Escala Publicada!", body: `A escala do próximo período foi publicada. Acesse o app e confira seus dias.` }),
              showDaysBefore: false,
            },
          ] as const).map(({ key, icon, color, title, badge, desc, preview, showDaysBefore }) => {
            const current = notifSettings[key];
            const colorMap: Record<string, string> = {
              amber:   "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 border-amber-500/20",
              blue:    "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 border-blue-500/20",
              emerald: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 border-emerald-500/20",
              red:     "bg-red-500/10 text-red-500 dark:bg-red-500/20 border-red-500/20",
              purple:  "bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 border-purple-500/20",
            };
            const HOURS = [
              { h: 5, label: "05:00" }, { h: 6, label: "06:00" }, { h: 7, label: "07:00" },
              { h: 8, label: "08:00 (Recomendado)" }, { h: 9, label: "09:00" }, { h: 10, label: "10:00" },
              { h: 11, label: "11:00" }, { h: 12, label: "12:00" }, { h: 13, label: "13:00" },
              { h: 14, label: "14:00" }, { h: 15, label: "15:00" }, { h: 16, label: "16:00" },
              { h: 17, label: "17:00" }, { h: 18, label: "18:00" }, { h: 19, label: "19:00" },
              { h: 20, label: "20:00" }, { h: 21, label: "21:00" },
            ];
            const daysBeforeVal = (current as any).days_before ?? 1;
            const pv = preview(current.hour, daysBeforeVal);
            return (
              <div
                key={key}
                className={`bg-white dark:bg-zinc-800 rounded-xl border shadow-sm overflow-hidden transition-all ${
                  current.enabled
                    ? "border-zinc-200 dark:border-zinc-700"
                    : "border-zinc-100 dark:border-zinc-800 opacity-60"
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colorMap[color]}`}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">{title}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{badge}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{desc}</p>
                    </div>
                  </div>
                  {/* Toggle enable/disable */}
                  <button
                    role="switch"
                    aria-checked={current.enabled}
                    aria-label={`${title}: ${current.enabled ? "ativado" : "desativado"}`}
                    onClick={() =>
                      setNotifSettings((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: !current.enabled },
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 ${
                      current.enabled ? "bg-secondary" : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        current.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Card Body — shown only when enabled */}
                {current.enabled && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-zinc-100 dark:border-zinc-700/60 pt-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                          <Clock size={11} /> Horário de Disparo (Brasília)
                        </label>
                        <select
                          value={current.hour}
                          onChange={(e) =>
                            setNotifSettings((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], hour: parseInt(e.target.value, 10) },
                            }))
                          }
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer"
                        >
                          {HOURS.map((opt) => (
                            <option key={opt.h} value={opt.h}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {showDaysBefore && (
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            <CalendarRange size={11} /> Dias de Antecedência
                          </label>
                          <select
                            value={daysBeforeVal}
                            onChange={(e) =>
                              setNotifSettings((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], days_before: parseInt(e.target.value, 10) },
                              } as NotificationSettings))
                            }
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-secondary/50 transition-all cursor-pointer"
                          >
                            {[1, 2, 3].map((d) => (
                              <option key={d} value={d}>{d} dia{d > 1 ? "s" : ""} antes</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Push notification preview */}
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/70 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-secondary/10 flex items-center justify-center text-[11px] shrink-0">📱</div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{pv.title}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">{pv.body}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveNotifSettings}
              disabled={isSavingNotif || !onSaveNotificationSettings}
              className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondaryHover disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-secondary/20 active:scale-95"
            >
              {isSavingNotif ? (
                <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              ) : (
                <><Save size={16} /> Salvar Configurações de Notificações</>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === "admin" && isAdmin && onSaveEnabledTabs && (
        <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <ShieldCheck size={16} /> Abas Visíveis para Membros
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Escolha quais abas estarão disponíveis para os membros deste
            ministério. As abas de Perfil e Configurações são sempre visíveis.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MEMBER_TABS.map((tab) => {
              const isEnabled =
                ministryConfig?.enabledTabs?.includes(tab.id) ?? true;
              return (
                <div
                  key={tab.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-700/50"
                >
                  <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {tab.label}
                  </span>
                  <button
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`Aba ${tab.label}: ${isEnabled ? 'ativada' : 'desativada'}`}
                    onClick={() => {
                      const currentTabs =
                        ministryConfig?.enabledTabs ||
                        MEMBER_TABS.map((t) => t.id);
                      let newTabs;
                      if (isEnabled) {
                        newTabs = currentTabs.filter(
                          (id: string) => id !== tab.id,
                        );
                      } else {
                        newTabs = [...currentTabs, tab.id];
                      }
                      onSaveEnabledTabs(newTabs);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 ${isEnabled ? "bg-secondary" : "bg-zinc-300 dark:bg-zinc-700"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Zap size={16} /> Acesso Rápido (Dashboard)
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Escolha quais atalhos aparecerão na seção de Acesso Rápido da página
            inicial.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {QUICK_ACCESS_OPTIONS.map((item) => {
              const currentItems =
                ministryConfig?.quickAccessItems === null ||
                ministryConfig?.quickAccessItems === undefined
                  ? QUICK_ACCESS_OPTIONS.map((i) => i.id)
                  : ministryConfig.quickAccessItems;
              const isEnabled = currentItems.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-700/50"
                >
                  <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {item.label}
                  </span>
                  <button
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`${item.label}: ${isEnabled ? 'ativado' : 'desativado'}`}
                    onClick={async () => {
                      let newItems;
                      if (isEnabled) {
                        newItems = currentItems.filter(
                          (id: string) => id !== item.id,
                        );
                      } else {
                        newItems = [...currentItems, item.id];
                      }
                      try {
                        await onSaveIntegrations?.(
                          undefined,
                          undefined,
                          undefined,
                          newItems,
                        );
                        addToast("Acesso rápido atualizado!", "success");
                      } catch (e) {
                        addToast("Erro ao atualizar acesso rápido.", "error");
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 ${isEnabled ? "bg-secondary" : "bg-zinc-300 dark:bg-zinc-700"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Sparkles size={16} /> Diretrizes Práticas (Culto e Eventos)
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Defina as diretrizes, avisos e check-lists que os escalados deste
            ministério verão ao consultar o Cronograma / Pauta do Culto.
          </p>
          <textarea
            value={tempGuidelines}
            onChange={(e) => setTempGuidelines(e.target.value)}
            placeholder="Ex: 
- Chegar 30 min antes
- Fazer check das baterias
- Estar em oração..."
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-y min-h-[100px] mb-3"
          />
          <button
            onClick={async () => {
              if (!onSaveGuidelines) return;
              try {
                await onSaveGuidelines(tempGuidelines);
              } catch (e) {}
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-secondaryHover text-white font-bold text-xs sm:text-sm rounded-lg transition-colors"
          >
            <Save size={16} />
            Salvar Diretrizes
          </button>
        </div>
      )}

      {activeTab === "ministries" && isOrgAdmin && (
          <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                  Gerenciar Ministérios
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Crie e gerencie os ministérios da sua organização.
                </p>
              </div>
              <button
                onClick={() => {
                  const planType = organization?.plan_type || "trial";
                  const limits = { trial: 2, pro: 3, enterprise: Infinity };
                  const limit = limits[planType as keyof typeof limits] || 2;
                  if ((ministries?.length || 0) >= limit) {
                    addToast(`Seu plano (${planType.toUpperCase()}) permite até ${limit} ministérios. Faça upgrade para criar mais.`, "error");
                    return;
                  }
                  setIsNewMinistryModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl font-bold hover:bg-secondaryHover transition-colors shadow-lg shadow-secondary/20"
              >
                <Plus size={18} />
                Criar Ministério
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {ministries?.map((min) => (
                <div
                  key={min.id}
                  className="bg-white dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 hover:border-secondary/30 transition-all flex flex-col"
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
                      <Building2 size={20} />
                    </div>
                    {min.id === ministryId && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] uppercase font-bold rounded-full">
                        Atual
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {min.label}
                  </h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                    Sigla: <span className="font-mono bg-zinc-100 dark:bg-zinc-900 px-1 rounded">{min.code}</span>
                  </p>
                </div>
              ))}
              
              {(!ministries || ministries.length === 0) && (
                <div className="col-span-full py-8 text-center text-zinc-500 dark:text-zinc-400">
                  <Building2 size={36} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum ministério encontrado.</p>
                </div>
              )}
            </div>
          </div>
      )}

      {activeTab === "geral" && (
        <>
          <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Monitor size={16} /> Aparência
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5">
                  Tema
                </label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                  {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onSetThemeMode(mode)}
                      className={`flex-1 py-1.5 sm:py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${themeMode === mode ? "bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                    >
                      {mode === "light" && <Sun size={14} />}
                      {mode === "dark" && <Moon size={14} />}
                      {mode === "system" && <Monitor size={14} />}
                      {mode === "light"
                        ? "Claro"
                        : mode === "dark"
                          ? "Escuro"
                          : "Auto"}
                    </button>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5">
                    Nome do Ministério <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempTitle === "Carregando..." ? "" : tempTitle}
                      placeholder={initialTitle === "Carregando..." ? "Carregando nome do ministério..." : "Ex: Louvor"}
                      disabled={initialTitle === "Carregando..."}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onBlur={() => validateField('ministryName', tempTitle)}
                      aria-invalid={!!fieldErrors.ministryName}
                      aria-describedby={fieldErrors.ministryName ? 'error-ministry-name' : undefined}
                      className={`flex-1 bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-secondary text-zinc-900 dark:text-zinc-100 ${
                          fieldErrors.ministryName ? 'border-red-500 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700'
                      } ${initialTitle === "Carregando..." ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                    <button
                      disabled={initialTitle === "Carregando..." || tempTitle.trim() === "Carregando..." || !tempTitle.trim()}
                      onClick={() => {
                        if (validateField('ministryName', tempTitle)) {
                          onSaveTitle(tempTitle.trim());
                        }
                      }}
                      className="bg-secondary hover:bg-secondaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                      title="Salvar Nome do Ministério"
                    >
                      <Save size={16} />
                    </button>
                  </div>
                  {fieldErrors.ministryName && <p id="error-ministry-name" className="text-xs text-red-500 mt-1" role="alert">{fieldErrors.ministryName}</p>}
                </div>
              )}
            </div>
            {onSaveTheme && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={onSaveTheme}
                  className="text-xs text-secondary dark:text-secondary/80 font-bold hover:underline"
                >
                  Salvar preferência de tema neste dispositivo
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck size={16} /> Sistema
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 sm:p-2 rounded-lg ${notifPermission === "granted" ? "bg-secondary/10 text-secondary dark:bg-secondaryHover/30" : "bg-zinc-200 text-zinc-500"}`}
                  >
                    {notifPermission === "granted" ? (
                      <BellRing size={18} />
                    ) : (
                      <BellOff size={18} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                      Notificações Push
                    </h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500">
                      {notifPermission === "granted"
                        ? "Ativas neste dispositivo."
                        : "Permita para receber avisos."}
                    </p>
                  </div>
                </div>
                {onEnableNotifications && notifPermission !== "granted" && (
                  <button
                    onClick={handleNotificationClick}
                    disabled={isNotifLoading}
                    className="px-2.5 py-1 bg-secondary hover:bg-secondaryHover text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {isNotifLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      "Ativar"
                    )}
                  </button>
                )}
                {notifPermission === "granted" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestPush}
                      className="px-2 py-0.5 text-xs font-semibold text-secondary hover:bg-secondary/10 border border-secondary/30 rounded-lg transition-colors active:scale-95"
                      title="Disparar notificação de teste neste dispositivo"
                    >
                      Testar
                    </button>
                    <Check size={16} className="text-secondary mr-1" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}


      {/* Modal de Novo Ministério */}
      {isNewMinistryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building2 size={20} className="text-secondary" /> Novo Ministério
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Adicione um novo ministério à sua organização</p>
              </div>
              <button
                onClick={() => setIsNewMinistryModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMinistry} className="p-6 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  Nome do Ministério <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Louvor Adultos"
                  value={newMinistryData.label}
                  onChange={(e) => setNewMinistryData({ ...newMinistryData, label: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Sigla / Código <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-zinc-400 font-normal">Máx 10 letras</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: L-ADU"
                  maxLength={10}
                  value={newMinistryData.code}
                  onChange={(e) => setNewMinistryData({ ...newMinistryData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all font-mono uppercase"
                />
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex gap-3">
                <div className="mt-0.5"><Lock size={16} className="text-blue-500" /></div>
                <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  Você será automaticamente adicionado como <b>Administrador</b> deste novo ministério. Lembre-se que limites de plano se aplicam ao criar novos ministérios.
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewMinistryModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMinistry}
                  className="flex-1 px-4 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-secondaryHover transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isCreatingMinistry ? (
                    <><Loader2 size={18} className="animate-spin" /> Criando...</>
                  ) : (
                    <><Check size={18} /> Salvar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={() => setLegalDoc("terms")}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline"
        >
          Termos de Uso
        </button>
        <button
          onClick={() => setLegalDoc("privacy")}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline"
        >
          Política de Privacidade
        </button>
      </div>
      <LegalModal
        isOpen={!!legalDoc}
        type={legalDoc}
        onClose={() => setLegalDoc(null)}
      />
    </div>
  );
};

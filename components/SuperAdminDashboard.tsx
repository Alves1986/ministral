import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Layers,
  Activity,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Search,
  Loader2,
  Trash2,
  CreditCard,
  Lock,
  Link as LinkIcon,
  MessageSquare,
  BarChart3,
  Clock,
  Crown,
  ShieldAlert,
  Wifi,
  RefreshCw,
  Megaphone,
  Send,
  Headset,
  ShieldCheck,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  X,
  AlertCircle,
  Sparkles,
  Trash,
  Cpu,
  Zap,
  Sliders,
  BatteryCharging,
  TrendingUp,
  Check,
  Shield,
  FlaskConical,
  ExternalLink,
  QrCode,
  Play,
  ArrowRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "../services/supabase/client";
import {
  Organization,
  AIPlanTier,
  OrganizationAIQuotaConfig,
  OrganizationAIQuotaStatus,
  GlobalAIQuotaOverview,
} from "../types";
import {
  fetchOrganizationsWithStats,
  saveOrganization,
  toggleOrganizationStatus,
  saveOrganizationMinistry,
  deleteOrganizationMinistry,
  deleteOrganizationSQL,
  notifyAllOrganizationAdmins,
  sendGlobalBroadcast,
  fetchGlobalUsers,
  fetchGlobalBroadcasts,
  deleteGlobalBroadcast,
  deleteGlobalUser,
  removeGlobalUserFromMinistry,
  toggleMinistryFeature,
  fetchAllOrganizationsAIQuotaStatuses,
  calculateGlobalAIQuotaOverview,
  saveOrganizationAIQuota,
  resetOrganizationWeeklyUsage,
  addOrganizationBonusCredits,
  DEFAULT_TIER_LIMITS,
} from "../services/supabaseService";
import {
  checkMinistryLimit,
  fetchSystemTelemetry,
  SystemTelemetryLog,
} from "../services/supabase/admin";
import { createInviteToken } from "../services/supabase/auth";
import {
  fetchSupportTickets,
  updateSupportTicket,
  deleteSupportTicket,
} from "../services/supabase/support";
import { useToast } from "./Toast";
import { getSystemLogo } from "../utils/branding";
import {
  fetchAuditLogsByOrg,
  AuditLogEntry,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_COLORS,
} from "../services/supabase/audit";

export const SuperAdminDashboard: React.FC<{ activeTab?: string }> = ({
  activeTab = "sa-organizations",
}) => {
  const queryClient = useQueryClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchUserTerm, setSearchUserTerm] = useState("");
  const [filterOrgId, setFilterOrgId] = useState("");
  const [filterMinistryId, setFilterMinistryId] = useState("");

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("info");
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "admins">("all");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [pastBroadcasts, setPastBroadcasts] = useState<any[]>([]);
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(false);
  const [viewingBroadcast, setViewingBroadcast] = useState<any | null>(null);

  const broadcastTemplates = [
    {
      id: "maintenance",
      label: "🛠️ Manutenção Programada",
      title: "Aviso de Manutenção Programada no Sistema",
      message: "Informamos que o aplicativo Ministral passará por uma manutenção programada para melhorias de infraestrutura e estabilidade. Durante este período, o acesso poderá ficar temporariamente instável. Agradecemos a compreensão de todos!",
      type: "warning",
      target: "all" as const,
    },
    {
      id: "update",
      label: "🚀 Nova Atualização",
      title: "Novidades e Atualização do Ministral!",
      message: "Uma nova versão do Ministral acabou de ser publicada com novidades, melhorias de desempenho e correções para otimizar as escalas da sua equipe. Aproveite!",
      type: "success",
      target: "all" as const,
    },
    {
      id: "instability",
      label: "⚠️ Instabilidade Temporária",
      title: "Alerta: Instabilidade Temporária Identificada",
      message: "Nossa equipe identificou uma oscilação temporária em alguns recursos do sistema e já está atuando para normalização. O funcionamento pleno será restabelecido em instantes.",
      type: "error",
      target: "all" as const,
    },
    {
      id: "admins",
      label: "🛡️ Comunicado aos Administradores",
      title: "Aviso Importante para Administradores",
      message: "Prezados administradores, solicitamos que revisem as configurações de funções e membros da sua organização para garantir a melhor experiência da sua congregação.",
      type: "info",
      target: "admins" as const,
    },
  ];

  const loadPastBroadcasts = async () => {
    setIsLoadingBroadcasts(true);
    const data = await fetchGlobalBroadcasts();
    setPastBroadcasts(data);
    setIsLoadingBroadcasts(false);
  };

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilterOrg, setAuditFilterOrg] = useState("");

  const loadAuditLogs = async (orgId?: string) => {
    setIsLoadingAudit(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      if (orgId) {
        const logs = await fetchAuditLogsByOrg(orgId);
        setAuditLogs(logs);
      } else {
        const { data } = await sb
          .from("ministry_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        setAuditLogs((data || []) as AuditLogEntry[]);
      }
    } catch {
      setAuditLogs([]);
    }
    setIsLoadingAudit(false);
  };

  useEffect(() => {
    if (activeTab === "sa-broadcast") {
      loadPastBroadcasts();
    }
    if (activeTab === "sa-audit") {
      loadAuditLogs(auditFilterOrg || undefined);
    }
  }, [activeTab, auditFilterOrg]);

  const handleSendBroadcast = async (targetOverride?: "all" | "admins") => {
    const target = targetOverride || broadcastTarget;
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      addToast("Preencha o título e a mensagem", "warning");
      return;
    }

    const isAll = target === "all";
    const targetDescription = isAll
      ? "TODOS os usuários de todas as organizações (membros, líderes e administradores)"
      : "TODOS os administradores de todas as organizações";

    confirmAction(
      isAll ? "Disparar Comunicado Geral" : "Disparar para Administradores",
      `Tem certeza que deseja enviar este comunicado para ${targetDescription}? Essa ação enviará notificações no app e push para os destinatários.`,
      async () => {
        setSendingBroadcast(true);
        try {
          const { error } = await sendGlobalBroadcast(
            broadcastTitle,
            broadcastMessage,
            broadcastType,
            target,
          );
          if (error) throw error;
          addToast(
            isAll
              ? "Comunicado disparado para todos os usuários com sucesso!"
              : "Comunicado disparado para os administradores com sucesso!",
            "success",
          );
          setBroadcastTitle("");
          setBroadcastMessage("");
          setBroadcastType("info");
          loadPastBroadcasts();
        } catch (e: any) {
          addToast(e.message || "Erro ao enviar comunicado global", "error");
        } finally {
          setSendingBroadcast(false);
        }
      },
    );
  };

  const handleDeleteBroadcast = async (
    e: React.MouseEvent,
    title: string,
    message: string,
  ) => {
    e.stopPropagation();
    confirmAction(
      "Excluir Comunicado",
      "Tem certeza que deseja excluir as notificações deste comunicado?",
      async () => {
        try {
          const { error } = await deleteGlobalBroadcast(title, message);
          if (error) throw error;
          addToast("Comunicado excluído com sucesso!", "success");
          loadPastBroadcasts();
          if (
            viewingBroadcast &&
            viewingBroadcast.title === title &&
            viewingBroadcast.message === message
          ) {
            setViewingBroadcast(null);
          }
        } catch (e: any) {
          addToast(e.message || "Erro ao excluir comunicado", "error");
        }
      },
    );
  };

  // Telemetria Operacional do Sistema (Escalas, Atividades e Auditoria)
  const {
    data: telemetryLogs = [],
    isLoading: loadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["super_admin_system_telemetry"],
    queryFn: fetchSystemTelemetry,
    staleTime: 60 * 1000,
  });

  // Labels dos ministérios em query separada para resolução resiliente
  const { data: ministryLabels = [] } = useQuery({
    queryKey: ["super_admin_ministry_labels"],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return [];
      const { data } = await sb
        .from("organization_ministries")
        .select("id, label");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const ministryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    ministryLabels.forEach((m: any) => {
      map[m.id] = m.label;
    });
    return map;
  }, [ministryLabels]);

  const orgNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizations.forEach((o: any) => {
      map[o.id] = o.name;
    });
    return map;
  }, [organizations]);

  const logsByOrg = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        count: number;
        ministries: Record<string, { label: string; count: number }>;
      }
    > = {};

    telemetryLogs.forEach((log: SystemTelemetryLog) => {
      const orgId = log.organization_id || "unknown";
      const orgName = orgNameMap[orgId] || `Org #${orgId.slice(0, 8)}`;
      const minId = log.ministry_id || "geral";
      const minLabel =
        minId === "geral"
          ? "Geral / Admin"
          : ministryLabelMap[minId] || `Min #${minId.slice(0, 8)}`;

      if (!map[orgId]) {
        map[orgId] = { name: orgName, count: 0, ministries: {} };
      }
      map[orgId].count++;

      if (!map[orgId].ministries[minId]) {
        map[orgId].ministries[minId] = { label: minLabel, count: 0 };
      }
      map[orgId].ministries[minId].count++;
    });

    return Object.entries(map).map(([id, val]) => ({ id, ...val }));
  }, [telemetryLogs, orgNameMap, ministryLabelMap]);

  const last24hCount = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return telemetryLogs.filter(
      (log: SystemTelemetryLog) =>
        new Date(log.created_at).getTime() > oneDayAgo,
    ).length;
  }, [telemetryLogs]);

  const { data: globalUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["super_admin_global_users"],
    queryFn: fetchGlobalUsers,
    enabled: activeTab === "sa-users" || activeTab === "sa-quotas",
  });

  // ─── AI Quotas State & Queries ──────────────────────────────────────────
  const [quotaSearchTerm, setQuotaSearchTerm] = useState("");
  const [quotaTierFilter, setQuotaTierFilter] = useState<string>("all");
  const [quotaStatusFilter, setQuotaStatusFilter] = useState<string>("all");
  const [editingQuotaOrg, setEditingQuotaOrg] = useState<OrganizationAIQuotaStatus | null>(null);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusOrgTarget, setBonusOrgTarget] = useState<OrganizationAIQuotaStatus | null>(null);
  const [bonusAmountToAdd, setBonusAmountToAdd] = useState<number>(50);
  const [isSavingQuota, setIsSavingQuota] = useState(false);

  const [quotaFormData, setQuotaFormData] = useState<{
    enabled: boolean;
    tier: AIPlanTier;
    weeklyLimit: number;
    bonusCredits: number;
    allowedModels: "basic" | "all";
  }>({
    enabled: true,
    tier: "free",
    weeklyLimit: 25,
    bonusCredits: 0,
    allowedModels: "basic",
  });

  const {
    data: aiQuotaStatuses = [],
    isLoading: loadingQuotas,
    refetch: refetchQuotas,
  } = useQuery({
    queryKey: ["super_admin_ai_quotas", organizations.map((o) => o.id).join(",")],
    queryFn: async () => {
      if (!organizations.length) return [];
      return await fetchAllOrganizationsAIQuotaStatuses(organizations);
    },
    enabled: activeTab === "sa-quotas" && organizations.length > 0,
    staleTime: 30 * 1000,
  });

  const aiOverview: GlobalAIQuotaOverview = useMemo(() => {
    return calculateGlobalAIQuotaOverview(aiQuotaStatuses);
  }, [aiQuotaStatuses]);

  const filteredQuotaStatuses = useMemo(() => {
    return aiQuotaStatuses.filter((item) => {
      if (quotaSearchTerm.trim()) {
        const term = quotaSearchTerm.toLowerCase();
        const matchesName = (item.organizationName || "").toLowerCase().includes(term);
        const matchesId = item.organizationId.toLowerCase().includes(term);
        if (!matchesName && !matchesId) return false;
      }
      if (quotaTierFilter !== "all" && item.tier !== quotaTierFilter) {
        return false;
      }
      if (quotaStatusFilter === "active" && !item.enabled) return false;
      if (quotaStatusFilter === "disabled" && item.enabled) return false;
      if (quotaStatusFilter === "warning" && item.status !== "warning") return false;
      if (quotaStatusFilter === "exceeded" && item.status !== "exceeded") return false;

      return true;
    });
  }, [aiQuotaStatuses, quotaSearchTerm, quotaTierFilter, quotaStatusFilter]);

  const handleToggleAI = async (item: OrganizationAIQuotaStatus) => {
    const newEnabled = !item.enabled;
    try {
      await saveOrganizationAIQuota(
        item.organizationId,
        { enabled: newEnabled },
        item.organizationName
      );
      addToast(
        newEnabled
          ? `IA ativada para ${item.organizationName || "Organização"}!`
          : `IA desativada para ${item.organizationName || "Organização"}!`,
        newEnabled ? "success" : "info"
      );
      refetchQuotas();
    } catch {
      addToast("Erro ao alterar status da IA", "error");
    }
  };

  const handleQuickTierChange = async (item: OrganizationAIQuotaStatus, newTier: AIPlanTier) => {
    try {
      const defaultTier = DEFAULT_TIER_LIMITS[newTier] || DEFAULT_TIER_LIMITS.free;
      await saveOrganizationAIQuota(
        item.organizationId,
        {
          tier: newTier,
          weeklyLimit: defaultTier.weeklyLimit,
          allowedModels: defaultTier.allowedModels,
        },
        item.organizationName
      );
      addToast(
        `Plano de IA de ${item.organizationName || "Organização"} alterado para ${defaultTier.label}!`,
        "success"
      );
      refetchQuotas();
    } catch {
      addToast("Erro ao alterar plano de IA", "error");
    }
  };

  const handleOpenQuotaModal = (item: OrganizationAIQuotaStatus) => {
    setEditingQuotaOrg(item);
    setQuotaFormData({
      enabled: item.enabled,
      tier: item.tier,
      weeklyLimit: item.weeklyLimit,
      bonusCredits: item.bonusCredits,
      allowedModels: item.allowedModels,
    });
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuotaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotaOrg) return;

    setIsSavingQuota(true);
    try {
      await saveOrganizationAIQuota(
        editingQuotaOrg.organizationId,
        quotaFormData,
        editingQuotaOrg.organizationName
      );
      addToast("Cota de IA atualizada com sucesso!", "success");
      setIsQuotaModalOpen(false);
      refetchQuotas();
    } catch (err: any) {
      addToast(err?.message || "Erro ao salvar cota de IA", "error");
    } finally {
      setIsSavingQuota(false);
    }
  };

  const handleResetWeeklyUsage = (item: OrganizationAIQuotaStatus) => {
    confirmAction(
      "Zerar Consumo Semanal de IA",
      `Deseja zerar o contador de uso semanal da IA para "${item.organizationName || "Organização"}"? Essa ação restaurará a cota para 0% nesta semana.`,
      async () => {
        try {
          const res = await resetOrganizationWeeklyUsage(item.organizationId, item.organizationName);
          addToast(res.message, "success");
          refetchQuotas();
        } catch {
          addToast("Erro ao zerar consumo semanal", "error");
        }
      }
    );
  };

  const handleOpenBonusModal = (item: OrganizationAIQuotaStatus) => {
    setBonusOrgTarget(item);
    setBonusAmountToAdd(50);
    setIsBonusModalOpen(true);
  };

  const handleConfirmAddBonus = async () => {
    if (!bonusOrgTarget || bonusAmountToAdd <= 0) return;
    try {
      const res = await addOrganizationBonusCredits(
        bonusOrgTarget.organizationId,
        bonusAmountToAdd,
        bonusOrgTarget.organizationName
      );
      addToast(res.message, "success");
      setIsBonusModalOpen(false);
      refetchQuotas();
    } catch {
      addToast("Erro ao adicionar créditos bônus", "error");
    }
  };

  const billingStats = useMemo(() => {
    let proCount = 0;
    let enterpriseCount = 0;
    let trialCount = 0;
    let mrr = 0;

    organizations.forEach((org) => {
      if (!org.active) return;
      if (org.plan_type === "pro") {
        proCount++;
        if (org.billing_status !== "trialing") mrr += 49.9;
      } else if (org.plan_type === "enterprise") {
        enterpriseCount++;
        if (org.billing_status !== "trialing") mrr += 99.9;
      } else if (
        org.billing_status === "trialing" ||
        org.plan_type === "trial"
      ) {
        trialCount++;
      }
    });

    return { proCount, enterpriseCount, trialCount, mrr };
  }, [organizations]);

  // Support tickets hook
  const [globalTickets, setGlobalTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const loadTickets = async () => {
    try {
      const t = await fetchSupportTickets();
      setGlobalTickets(t);
      if (activeTicket) {
        const updated = t.find((x: any) => x.id === activeTicket.id);
        if (updated) setActiveTicket(updated);
      }
    } catch {}
  };

  useEffect(() => {
    if (activeTab === "sa-support") {
      loadTickets();
      const interval = setInterval(loadTickets, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeTicket?.id]);

  const handleReplyTicket = async (
    e: React.FormEvent,
    statusChange?: "resolved" | "in_progress",
  ) => {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      const updates: any = {};
      const newReply = {
        id: "RPL-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        authorName: "Equipe Ministral (Super Admin)",
        isSuperAdmin: true,
        content: replyContent,
        createdAt: new Date().toISOString(),
      };

      if (replyContent.trim()) {
        updates.replies = [...(activeTicket.replies || []), newReply];
      }

      if (statusChange) {
        updates.status = statusChange;
      } else if (activeTicket.status === "open") {
        updates.status = "in_progress";
      }

      await updateSupportTicket(activeTicket.id, updates);
      setReplyContent("");
      loadTickets();
    } catch {}
  };

  const handleDeleteTicket = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    confirmAction(
      "Excluir Chamado",
      "Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.",
      async () => {
        await deleteSupportTicket(id);
        if (activeTicket?.id === id) setActiveTicket(null);
        loadTickets();
      },
    );
  };

  const ticketsOpen = globalTickets.filter((t) => t.status === "open").length;
  const ticketsCritical = globalTickets.filter(
    (t) => t.priority === "critical" && t.status !== "resolved",
  ).length;
  const ticketsResolved = globalTickets.filter(
    (t) => t.status === "resolved",
  ).length;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<any>({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);

  const [newMinistryCode, setNewMinistryCode] = useState("");
  const [newMinistryLabel, setNewMinistryLabel] = useState("");
  const [ministrySaving, setMinistrySaving] = useState(false);

  const { addToast, confirmAction } = useToast();

  // Estados e Handlers para a aba "sa-payments" (Laboratório de Teste de Gateways)
  const [testGateway, setTestGateway] = useState<'asaas' | 'stripe'>('asaas');
  const [testOrgId, setTestOrgId] = useState<string>('');
  const [testPlanType, setTestPlanType] = useState<'pro' | 'enterprise'>('pro');
  const [testUserEmail, setTestUserEmail] = useState<string>('admin.teste@ministral.com');
  const [testCustomerName, setTestCustomerName] = useState<string>('');
  const [testCpfCnpj, setTestCpfCnpj] = useState<string>('');
  const [testPhone, setTestPhone] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    url?: string;
    subscriptionId?: string;
    customerId?: string;
    details?: any;
    error?: string;
    timestamp: string;
  } | null>(null);

  const [simWebhookLoading, setSimWebhookLoading] = useState(false);
  const [simWebhookResult, setSimWebhookResult] = useState<{
    event: string;
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  const { data: asaasEventLogs = [], refetch: refetchAsaasLogs, isLoading: loadingAsaasLogs } = useQuery({
    queryKey: ['asaas_event_logs'],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return [];
      const { data, error } = await sb
        .from('asaas_event_log')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(15);
      if (error) {
        console.warn('Erro ao carregar asaas_event_log:', error);
        return [];
      }
      return data || [];
    },
    enabled: activeTab === 'sa-payments',
  });

  const handleRunCheckoutTest = async () => {
    const targetOrg = organizations.find(o => o.id === testOrgId) || organizations[0];
    if (!targetOrg) {
      addToast("Nenhuma organização disponível para teste", "warning");
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Supabase não inicializado");

      const functionName = testGateway === 'asaas' ? 'asaas-create-checkout' : 'stripe-create-checkout';
      const bodyPayload = {
        orgId: targetOrg.id,
        planType: testPlanType,
        userEmail: testUserEmail || 'admin.teste@ministral.com',
        customerName: testCustomerName || targetOrg.name,
        cpfCnpj: testCpfCnpj,
        phone: testPhone
      };

      const res = await sb.functions.invoke(functionName, { body: bodyPayload });

      if (res.error) {
        throw new Error(res.error.message || `Erro ao invocar ${functionName}`);
      }

      setTestResult({
        success: true,
        url: res.data?.url,
        subscriptionId: res.data?.subscriptionId,
        customerId: res.data?.customerId,
        details: res.data,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      addToast(`Sessão de teste ${testGateway.toUpperCase()} gerada com sucesso!`, "success");
      loadData();
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      addToast(`Erro no teste ${testGateway.toUpperCase()}: ${err.message}`, "error");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSimulateAsaasWebhook = async (eventType: 'PAYMENT_CONFIRMED' | 'PAYMENT_OVERDUE' | 'SUBSCRIPTION_DELETED') => {
    const targetOrg = organizations.find(o => o.id === testOrgId) || organizations[0];
    if (!targetOrg) {
      addToast("Selecione uma organização para simular o webhook", "warning");
      return;
    }

    setSimWebhookLoading(true);
    setSimWebhookResult(null);

    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Supabase não inicializado");

      const simulatedEventId = `sim_${eventType}_${Date.now()}`;
      let simulatedPayload: any = {
        id: simulatedEventId,
        event: eventType,
        dateCreated: new Date().toISOString()
      };

      if (eventType === 'PAYMENT_CONFIRMED') {
        simulatedPayload.payment = {
          id: `pay_sim_${Date.now()}`,
          customer: targetOrg.asaas_customer_id || `cus_sim_${Date.now()}`,
          subscription: targetOrg.asaas_subscription_id || `sub_sim_${Date.now()}`,
          externalReference: targetOrg.id,
          value: testPlanType === 'enterprise' ? 99.90 : 49.90,
          status: 'CONFIRMED',
          billingType: 'PIX',
          description: `Assinatura Plano ${testPlanType === 'enterprise' ? 'Enterprise' : 'Pro'} - Ministral`
        };
      } else if (eventType === 'PAYMENT_OVERDUE') {
        simulatedPayload.payment = {
          id: `pay_sim_${Date.now()}`,
          customer: targetOrg.asaas_customer_id || `cus_sim_${Date.now()}`,
          externalReference: targetOrg.id,
          value: 49.90,
          status: 'OVERDUE'
        };
      } else if (eventType === 'SUBSCRIPTION_DELETED') {
        simulatedPayload.subscription = {
          id: targetOrg.asaas_subscription_id || `sub_sim_${Date.now()}`,
          customer: targetOrg.asaas_customer_id || `cus_sim_${Date.now()}`,
          externalReference: targetOrg.id,
          status: 'INACTIVE'
        };
      }

      const res = await sb.functions.invoke('asaas-webhook', {
        body: simulatedPayload
      });

      if (res.error) {
        throw new Error(res.error.message || "Erro no webhook");
      }

      setSimWebhookResult({
        event: eventType,
        success: true,
        message: `Evento ${eventType} disparado com sucesso! A organização ${targetOrg.name} foi atualizada.`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });

      addToast(`Webhook ${eventType} simulado com sucesso!`, "success");
      loadData();
      refetchAsaasLogs();
    } catch (err: any) {
      setSimWebhookResult({
        event: eventType,
        success: false,
        message: err.message,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
      addToast(`Falha ao simular webhook: ${err.message}`, "error");
    } finally {
      setSimWebhookLoading(false);
    }
  };

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
      plan_type: org.plan_type || "trial",
      billing_status: org.billing_status || "active",
      trial_ends_at: org.trial_ends_at || "",
      checkout_url: org.checkout_url || "",
      access_locked: org.access_locked || false,
    });
    setNewMinistryCode("");
    setNewMinistryLabel("");
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingOrg(null);
    setFormData({
      name: "",
      slug: "",
      plan_type: "trial",
      billing_status: "trial",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return addToast("Nome é obrigatório", "error");

    setSaving(true);
    const res = await saveOrganization(
      editingOrg?.id || null,
      formData.name,
      formData.slug,
      formData,
    );

    if (res.success) {
      addToast(res.message, "success");
      if (!editingOrg) setIsModalOpen(false);
      loadData();
    } else {
      addToast(res.message, "error");
    }
    setSaving(false);
  };

  const handleAddMinistry = async () => {
    if (!editingOrg) return;
    if (!newMinistryCode || !newMinistryLabel)
      return addToast("Preencha código e nome.", "warning");

    const plan = editingOrg.plan_type || "trial";
    if (plan !== "enterprise") {
      const check = await checkMinistryLimit(editingOrg.id, plan);
      if (!check.allowed) {
        addToast(check.reason || "Limite atingido", "error");
        return;
      }
    }

    setMinistrySaving(true);
    const res = await saveOrganizationMinistry(
      editingOrg.id,
      newMinistryCode,
      newMinistryLabel,
    );
    if (res.success) {
      addToast(res.message, "success");
      setNewMinistryCode("");
      setNewMinistryLabel("");
      const data = await fetchOrganizationsWithStats();
      setOrganizations(data);
      const updatedOrg = data.find((o) => o.id === editingOrg.id);
      if (updatedOrg) setEditingOrg(updatedOrg);
    } else {
      addToast(res.message, "error");
    }
    setMinistrySaving(false);
  };

  const handleDeleteMinistry = async (code: string) => {
    if (!editingOrg) return;
    confirmAction(
      "Remover Ministério",
      `Isso pode quebrar o acesso de usuários vinculados ao ministério '${code}'. Continuar?`,
      async () => {
        const res = await deleteOrganizationMinistry(editingOrg.id, code);
        if (res.success) {
          addToast("Ministério removido.", "info");
          const data = await fetchOrganizationsWithStats();
          setOrganizations(data);
          const updatedOrg = data.find((o) => o.id === editingOrg.id);
          if (updatedOrg) setEditingOrg(updatedOrg);
        } else {
          addToast(res.message, "error");
        }
      },
    );
  };

  const handleCopyInviteLink = async (
    minId: string,
    orgId: string,
    label: string,
  ) => {
    try {
      const res = await createInviteToken(minId, orgId, label);
      if (res.success && res.url) {
        await navigator.clipboard.writeText(res.url);
        addToast(`Link de convite para ${label} copiado!`, "success");
      } else {
        addToast(res.message || "Erro ao gerar link de convite", "error");
      }
    } catch (e: any) {
      addToast("Erro", "error");
    }
  };

  const handleToggleCronograma = async (code: string) => {
    if (!editingOrg) return;
    const res = await toggleMinistryFeature(
      editingOrg.id,
      code,
      "service_schedule",
    );
    if (res.success) {
      addToast(res.message, "success");
      const data = await fetchOrganizationsWithStats();
      setOrganizations(data);
      const updatedOrg = data.find((o) => o.id === editingOrg.id);
      if (updatedOrg) setEditingOrg(updatedOrg);
    } else {
      addToast(res.message, "error");
    }
  };

  const handleToggleStatus = async (org: Organization) => {
    const newStatus = !org.active;
    setOrganizations((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, active: newStatus } : o)),
    );

    const success = await toggleOrganizationStatus(org.id, newStatus);
    if (!success) {
      addToast("Erro ao atualizar status", "error");
      loadData();
    }
  };

  const handleCopyRegisterLink = () => {
    const link = `${window.location.origin}?register=true`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        addToast(
          "Link de cadastro copiado para a área de transferência!",
          "success",
        );
      })
      .catch(() => {
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
      },
    );
  };

  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.slug && o.slug.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const availableMinistriesForOrg = useMemo(() => {
    if (!filterOrgId) return [];
    const orgUsers = globalUsers.filter(
      (u: any) => u.organization_id === filterOrgId,
    );
    const uniqueMinistries = new Map();
    orgUsers.forEach((u: any) => {
      if (u.ministriesDetails && Array.isArray(u.ministriesDetails)) {
        u.ministriesDetails.forEach((m: any) => {
          if (!uniqueMinistries.has(m.id)) {
            uniqueMinistries.set(m.id, m);
          }
        });
      }
    });
    return Array.from(uniqueMinistries.values());
  }, [globalUsers, filterOrgId]);

  const filteredGlobalUsers = useMemo(() => {
    return globalUsers.filter((u: any) => {
      const matchesSearch =
        u.name?.toLowerCase().includes(searchUserTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUserTerm.toLowerCase());
      const matchesOrg = filterOrgId
        ? filterOrgId === "none"
          ? !u.organization_id
          : String(u.organization_id) === filterOrgId
        : true;
      const matchesMinistry = filterMinistryId
        ? u.allowed_ministries?.includes(filterMinistryId)
        : true;
      return matchesSearch && matchesOrg && matchesMinistry;
    });
  }, [globalUsers, searchUserTerm, filterOrgId, filterMinistryId]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-28">

      {activeTab === "sa-organizations" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                <Building2 className="text-purple-600" /> Gestão Global
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Administração de Organizações (Multi-Tenant)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyRegisterLink}
                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 border border-zinc-200 dark:border-zinc-700"
                title="Copiar link público de cadastro"
              >
                <LinkIcon size={18} /> Link de Cadastro
              </button>
              <button
                onClick={handleCreate}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-600/20"
              >
                <Plus size={18} /> Nova Organização
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  Organizações
                </p>
                <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                  {organizations.length}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  Total de Usuários
                </p>
                <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                  {organizations.reduce(
                    (acc, curr) => acc + (curr.userCount || 0),
                    0,
                  )}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-secondary/10 dark:bg-secondary/20 rounded-lg text-secondary">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  Ativas
                </p>
                <p className="text-2xl font-bold text-zinc-800 dark:text-white">
                  {organizations.filter((o) => o.active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  size={18}
                />
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
                <Loader2 className="animate-spin mb-2" size={32} />{" "}
                Carregando...
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                Nenhuma organização encontrada.
              </div>
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
                    {filteredOrgs.map((org) => (
                      <tr
                        key={org.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <img
                              src={org.logo_url || getSystemLogo("light")}
                              alt={org.name}
                              className="w-7 h-7 rounded-lg object-contain bg-white border border-zinc-100 dark:border-zinc-700 p-0.5 shrink-0"
                              onError={(e) => {
                                const fallback = getSystemLogo("light");
                                if (!e.currentTarget.src.endsWith(fallback)) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                            />
                            <div>
                              <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                                {org.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {org.slug || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(org)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-colors ${org.active ? "bg-secondary/10 text-secondary border-secondary/20 dark:bg-secondary/20 dark:text-secondary dark:border-secondary/30" : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"}`}
                          >
                            {org.active ? (
                              <ToggleRight size={14} />
                            ) : (
                              <ToggleLeft size={14} />
                            )}
                            {org.active ? "Ativo" : "Inativo"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded ${org.plan_type === "enterprise" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : org.plan_type === "pro" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}
                          >
                            {org.plan_type || "Trial"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                            <Users size={12} /> {org.userCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto">
                            <Layers size={12} /> {org.ministryCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(org)}
                              className="p-2 text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                              title="Editar Organização"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrganization(org)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Excluir Organização"
                            >
                              <Trash2 size={16} />
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

      {activeTab === "sa-broadcast" && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start gap-4 mb-8">
              <div className="p-4 bg-ministral-500/10 rounded-2xl shrink-0">
                <Megaphone className="text-ministral-500" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-800 dark:text-white">
                  Comunicado Global
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  Dispare notificações in-app e push para{" "}
                  <strong>todos os usuários (geral)</strong> ou{" "}
                  <strong>apenas administradores</strong> de todas as organizações cadastradas. Ideal para avisos de manutenção programada, novas atualizações e alertas gerais.
                </p>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 space-y-6">
              {/* Sugestões Rápidas / Templates */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  Modelos Rápidos (1-clique para preencher)
                </span>
                <div className="flex flex-wrap gap-2">
                  {broadcastTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setBroadcastTitle(tmpl.title);
                        setBroadcastMessage(tmpl.message);
                        setBroadcastType(tmpl.type);
                        setBroadcastTarget(tmpl.target);
                        addToast(`Modelo "${tmpl.label}" aplicado!`, "info");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-ministral-500/50 hover:bg-ministral-500/5 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de Público-Alvo / Destinatários */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2.5">
                  Público-Alvo do Comunicado
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setBroadcastTarget("all")}
                    className={`flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all ${
                      broadcastTarget === "all"
                        ? "bg-ministral-500/10 border-ministral-500 text-ministral-700 dark:text-ministral-300 ring-2 ring-ministral-500/20 shadow-sm"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        broadcastTarget === "all"
                          ? "bg-ministral-500 text-white shadow-md shadow-ministral-500/30"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      <Users size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                          Geral (Todos os Usuários)
                        </h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Público Amplo
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        Dispara para todos os voluntários, membros e administradores de todas as organizações. Ideal para manutenções e novas versões.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget("admins")}
                    className={`flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all ${
                      broadcastTarget === "admins"
                        ? "bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20 shadow-sm"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        broadcastTarget === "admins"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      <ShieldCheck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                          Apenas Administradores
                        </h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Restrito
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        Dispara exclusivamente para administradores das organizações cadastradas. Ideal para avisos de governança e faturamento.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Título do Comunicado
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Ex: Atualização Importante do Sistema ou Manutenção Programada"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-ministral-500 focus:border-transparent outline-none transition-all dark:text-white placeholder:text-zinc-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Mensagem
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Detalhes do aviso, horários de manutenção, novas funcionalidades..."
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
                    { id: "info", label: "Informativo", color: "bg-blue-500" },
                    {
                      id: "success",
                      label: "Sucesso/Novidade",
                      color: "bg-emerald-500",
                    },
                    {
                      id: "warning",
                      label: "Aviso Importante / Manutenção",
                      color: "bg-amber-500",
                    },
                    {
                      id: "error",
                      label: "Crítico / Instabilidade",
                      color: "bg-red-500",
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setBroadcastType(t.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                        broadcastType === t.id
                          ? `${t.color} border-transparent text-white shadow-lg shadow-black/10 scale-[1.02]`
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${broadcastType === t.id ? "bg-white" : t.color}`}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Ações com opções para Geral e Administradores */}
              <div className="pt-5 mt-2 border-t border-zinc-200 dark:border-zinc-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span>Público marcado:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-200/50 dark:bg-zinc-700/50">
                    {broadcastTarget === "all" ? (
                      <>
                        <Users size={14} className="text-blue-500" /> Todos os Usuários (Geral)
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} className="text-purple-500" /> Apenas Administradores
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                  {/* Botão para disparar diretamente para a outra opção */}
                  <button
                    type="button"
                    onClick={() => handleSendBroadcast(broadcastTarget === "all" ? "admins" : "all")}
                    disabled={sendingBroadcast}
                    className="px-4 py-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  >
                    {broadcastTarget === "all" ? (
                      <>
                        <ShieldCheck size={16} className="text-purple-500" /> Disparar para Admins
                      </>
                    ) : (
                      <>
                        <Users size={16} className="text-blue-500" /> Disparar para Geral
                      </>
                    )}
                  </button>

                  {/* Botão de envio principal para o público marcado */}
                  <button
                    type="button"
                    onClick={() => handleSendBroadcast()}
                    disabled={sendingBroadcast}
                    className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${
                      broadcastTarget === "all"
                        ? "bg-ministral-500 hover:bg-ministral-600 shadow-ministral-500/20"
                        : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                    }`}
                  >
                    {sendingBroadcast ? (
                      <>
                        <Loader2 className="animate-spin" size={20} /> Enviando...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        {broadcastTarget === "all" ? "Disparar para Geral (Todos)" : "Disparar para Administradores"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-black text-zinc-800 dark:text-white mb-6">
              Histórico de Comunicados
            </h3>

            {isLoadingBroadcasts ? (
              <div className="flex justify-center p-8">
                <Loader2
                  className="animate-spin text-ministral-500"
                  size={32}
                />
              </div>
            ) : pastBroadcasts.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                Nenhum comunicado enviado ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {pastBroadcasts.map((b, idx) => {
                  const isAdminsOnly = b.action_link === "super-admin-broadcast-admins" || b.action_link === "super-admin-message";
                  return (
                    <div
                      key={idx}
                      className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 hover:border-ministral-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                b.type === "error"
                                  ? "bg-red-500"
                                  : b.type === "warning"
                                    ? "bg-amber-500"
                                    : b.type === "success"
                                      ? "bg-emerald-500"
                                      : "bg-blue-500"
                              }`}
                            />
                            <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                              {b.title}
                            </h4>
                            {isAdminsOnly ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 shrink-0">
                                <ShieldCheck size={10} /> Admins
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1 shrink-0">
                                <Users size={10} /> Geral
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {b.message}
                          </p>
                          <span className="text-xs text-zinc-400 mt-2 block font-medium">
                            Enviado em:{" "}
                            {new Date(b.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setViewingBroadcast(b)}
                            className="p-2 text-zinc-400 hover:text-ministral-500 hover:bg-ministral-50 dark:hover:bg-ministral-500/10 rounded-lg transition-colors"
                            title="Visualizar Mensagem"
                          >
                            <MessageSquare size={18} />
                          </button>
                          <button
                            onClick={(e) =>
                              handleDeleteBroadcast(e, b.title, b.message)
                            }
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir Comunicado"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de visualização de comunicado */}
      {viewingBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="text-xl font-black text-zinc-800 dark:text-white flex items-center gap-2">
                <Megaphone className="text-ministral-500" size={24} />{" "}
                Pré-visualização
              </h3>
              <button
                onClick={() => setViewingBroadcast(null)}
                className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {viewingBroadcast.action_link === "super-admin-broadcast-admins" || viewingBroadcast.action_link === "super-admin-message" ? (
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                      <ShieldCheck size={12} /> Destinatários: Administradores
                    </span>
                  ) : (
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <Users size={12} /> Destinatários: Geral (Todos os Usuários)
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-zinc-900 dark:text-white text-lg">
                  {viewingBroadcast.title}
                </h4>
                <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 leading-relaxed border border-zinc-200 dark:border-zinc-700/50">
                  {viewingBroadcast.message}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm font-medium">
                  <span className="text-zinc-500">
                    Data de envio:{" "}
                    {new Date(viewingBroadcast.created_at).toLocaleString(
                      "pt-BR",
                    )}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                      viewingBroadcast.type === "error"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                        : viewingBroadcast.type === "warning"
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                          : viewingBroadcast.type === "success"
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                    }`}
                  >
                    {viewingBroadcast.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sa-telemetry" && (
        <div className="space-y-6 animate-slide-up">
          {/* Telemetry Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#0f1f3d] to-[#1a2d52] p-6 rounded-3xl border border-[#c9a84c]/20 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity size={80} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a84c] bg-[#c9a84c]/10 px-2.5 py-1 rounded-full border border-[#c9a84c]/20">
                Atividade Global
              </span>
              <p className="text-sm font-bold text-slate-300 mt-4 uppercase tracking-wider">
                Total de Operações & Escalas
              </p>
              <p className="text-4xl font-black mt-2 text-white">
                {telemetryLogs.length}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Building2 size={80} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Alcance
              </span>
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-4 uppercase tracking-wider">
                Igrejas Utilizando
              </p>
              <p className="text-4xl font-black mt-2 text-zinc-800 dark:text-white">
                {logsByOrg.length}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Clock size={80} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                Atividade
              </span>
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-4 uppercase tracking-wider">
                Últimas 24 Horas
              </p>
              <p className="text-4xl font-black mt-2 text-zinc-800 dark:text-white">
                {last24hCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top Organizations Chart */}
            <div className="lg:col-span-6 bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <h3 className="text-base font-black text-zinc-800 dark:text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={18} className="text-[#c9a84c]" /> Volumetria
                por Igreja
              </h3>

              {logsByOrg.length === 0 ? (
                <p className="text-sm text-zinc-400 italic text-center py-12">
                  Nenhum registro de atividade encontrado.
                </p>
              ) : (
                <div className="space-y-4">
                  {logsByOrg.slice(0, 5).map((org: any) => {
                    const percentage =
                      telemetryLogs.length > 0
                        ? Math.round((org.count / telemetryLogs.length) * 100)
                        : 0;
                    return (
                      <div key={org.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {org.name}
                          </span>
                          <span className="text-zinc-500">
                            {org.count} operações ({percentage}%)
                          </span>
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
                <Layers size={18} className="text-blue-500" /> Distribuição por
                Ministério
              </h3>

              {logsByOrg.length === 0 ? (
                <p className="text-sm text-zinc-400 italic text-center py-12">
                  Nenhuma distribuição ativa.
                </p>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {logsByOrg.map((org: any) => (
                    <div
                      key={org.id}
                      className="p-3.5 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800/80"
                    >
                      <h4 className="text-xs font-black text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-2 border-b border-zinc-200/50 dark:border-zinc-800 pb-1">
                        {org.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(org.ministries).map(
                          ([minId, min]: any) => (
                            <div
                              key={minId}
                              className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800/50 text-[11px] font-bold"
                            >
                              <span className="text-zinc-600 dark:text-zinc-400 truncate">
                                {min.label}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#c9a84c]/10 text-[#c9a84c] shrink-0 font-extrabold">
                                {min.count}
                              </span>
                            </div>
                          ),
                        )}
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
                <Clock size={16} className="text-purple-500" /> Log em Tempo
                Real (Últimas Operações)
              </h3>
              <button
                onClick={() => refetchLogs()}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {loadingLogs ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Activity size={12} />
                )}
                Atualizar
              </button>
            </div>

            {loadingLogs ? (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                <Loader2 className="animate-spin mb-2" size={32} /> Carregando
                Telemetria...
              </div>
            ) : telemetryLogs.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                Nenhum log registrado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Data / Hora</th>
                      <th className="px-6 py-3">Organização</th>
                      <th className="px-6 py-3">Ministério</th>
                      <th className="px-6 py-3">Operação / Ação</th>
                      <th className="px-6 py-3">Responsável / Membro</th>
                      <th className="px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50 font-medium">
                    {telemetryLogs.slice(0, 50).map((log: any) => (
                      <tr
                        key={log.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-zinc-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-zinc-800 dark:text-zinc-200">
                          {orgNameMap[log.organization_id] ||
                            `Org #${log.organization_id.slice(0, 8)}`}
                        </td>
                        <td className="px-6 py-3.5 text-zinc-600 dark:text-zinc-400 font-bold">
                          {log.ministry_id
                            ? ministryLabelMap[log.ministry_id] ||
                              `Min #${log.ministry_id.slice(0, 8)}`
                            : "Geral / Admin"}
                        </td>
                        <td className="px-6 py-3.5 text-zinc-800 dark:text-zinc-200 font-medium">
                          <div className="font-bold">{log.action}</div>
                          {log.details && (
                            <span className="text-[10px] text-zinc-400 block">
                              {log.details}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-zinc-600 dark:text-zinc-300 font-bold">
                          {log.actor_name || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.status_type === "success"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : log.status_type === "warning"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            }`}
                          >
                            {log.status || "Ativo"}
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

      {activeTab === "sa-billing" && (
        <div className="space-y-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  MRR Estimado
                </h3>
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <CreditCard size={20} className="text-emerald-500" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                R$ {billingStats.mrr.toFixed(2).replace(".", ",")}
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-medium">
                Assinaturas ativas cobradas
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  Plano Pro
                </h3>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                {billingStats.proCount}
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-medium">
                Contas baseadas no Pro
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  Acesso Enterprise
                </h3>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                {billingStats.enterpriseCount}
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-medium">
                Soluções dedicadas ativas
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  Trials Ativos
                </h3>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white relative z-10">
                {billingStats.trialCount}
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-medium">
                Novos clientes em teste
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sa-payments" && (
        <div className="space-y-6 animate-slide-up">
          {/* Cabeçalho da Aba */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                  <FlaskConical size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white">
                      Laboratório de Pagamentos
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Sandbox & Testes
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Simulação de criação de assinaturas, links de pagamento e disparo de webhooks do Asaas e Stripe sem afetar o faturamento real.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status dos Gateways */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                    Gateway Asaas (Sandbox)
                  </h3>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold">
                  v3 Ativo
                </span>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {organizations.filter(o => o.payment_gateway === 'asaas' || o.asaas_customer_id).length}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Organizações com identificador Asaas
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                    Gateway Stripe (Coexistindo)
                  </h3>
                </div>
                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-bold">
                  Produção
                </span>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {organizations.filter(o => o.stripe_customer_id).length}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Organizações com assinatura ativa no Stripe
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  Total de Organizações
                </h3>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {organizations.length}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Base total para testes e migração
              </p>
            </div>
          </div>

          {/* Simulador de Checkout e Simulador de Webhook */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bloco 1: Simulador de Checkout */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                      1. Testar Criação de Checkout
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Gera cliente e cobrança real no Sandbox do Asaas ou sessão do Stripe
                    </p>
                  </div>
                </div>
              </div>

              {/* Seletor do Gateway */}
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">
                  Gateway Selecionado para Teste
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestGateway('asaas')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      testGateway === 'asaas'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span>⚡ Asaas (PIX / Boleto / Cartão)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestGateway('stripe')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      testGateway === 'stripe'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span>💳 Stripe (Cartão)</span>
                  </button>
                </div>
              </div>

              {/* Seleção de Organização de Teste */}
              <div>
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Organização Alvo
                </label>
                <select
                  value={testOrgId || (organizations[0]?.id || '')}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTestOrgId(id);
                    const org = organizations.find(o => o.id === id);
                    if (org) setTestCustomerName(org.name);
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.plan_type || 'trial'} - {org.billing_status || 'active'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Plano */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                    Plano de Teste
                  </label>
                  <select
                    value={testPlanType}
                    onChange={(e) => setTestPlanType(e.target.value as 'pro' | 'enterprise')}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                  >
                    <option value="pro">Plano Pro (R$ 49,90/mês)</option>
                    <option value="enterprise">Plano Enterprise (R$ 99,90/mês)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                    E-mail do Pagador
                  </label>
                  <input
                    type="email"
                    value={testUserEmail}
                    onChange={(e) => setTestUserEmail(e.target.value)}
                    placeholder="admin@igreja.com"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {testGateway === 'asaas' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      CPF ou CNPJ (Opcional)
                    </label>
                    <input
                      type="text"
                      value={testCpfCnpj}
                      onChange={(e) => setTestCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Telefone / WhatsApp (Opcional)
                    </label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleRunCheckoutTest}
                disabled={testLoading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gerando Sessão de Teste...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Executar Teste de Checkout ({testGateway.toUpperCase()})
                  </>
                )}
              </button>

              {/* Exibição do Resultado do Checkout */}
              {testResult && (
                <div className={`p-4 rounded-2xl border text-sm space-y-3 ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200' 
                    : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>{testResult.success ? '✅ Sessão de Teste Gerada' : '❌ Falha no Teste'}</span>
                    <span className="text-xs opacity-75">{testResult.timestamp}</span>
                  </div>

                  {testResult.url && (
                    <div className="pt-2">
                      <a
                        href={testResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                      >
                        <ExternalLink size={14} /> Abrir Checkout no Asaas Sandbox ↗
                      </a>
                    </div>
                  )}

                  {testResult.subscriptionId && (
                    <div className="text-xs space-y-1 font-mono pt-1">
                      <div>Assinatura: <strong>{testResult.subscriptionId}</strong></div>
                      {testResult.customerId && <div>Cliente Asaas: <strong>{testResult.customerId}</strong></div>}
                    </div>
                  )}

                  {testResult.error && (
                    <div className="text-xs text-red-600 dark:text-red-400 font-mono">
                      {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bloco 2: Simulador de Webhook */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                      2. Simulador de Webhook do Asaas
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Dispare eventos diretamente para validar ativação, suspensão e cancelamento
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-zinc-600 dark:text-zinc-400 space-y-2 leading-relaxed">
                <p>
                  Estes botões enviam payloads reais para a Edge Function <code>asaas-webhook</code>, simulando o comportamento exato que o Asaas executa quando um voluntário ou igreja paga a fatura.
                </p>
              </div>

              {/* Botões de Ação do Webhook */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSimulateAsaasWebhook('PAYMENT_CONFIRMED')}
                  disabled={simWebhookLoading}
                  className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold rounded-2xl text-xs transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Simular Pagamento Confirmado (PAYMENT_CONFIRMED)</span>
                  </div>
                  <span className="text-[11px] bg-emerald-500 text-white px-2 py-0.5 rounded-md font-semibold">
                    Ativar Org
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateAsaasWebhook('PAYMENT_OVERDUE')}
                  disabled={simWebhookLoading}
                  className="w-full py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold rounded-2xl text-xs transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Simular Pagamento Vencido (PAYMENT_OVERDUE)</span>
                  </div>
                  <span className="text-[11px] bg-amber-500 text-white px-2 py-0.5 rounded-md font-semibold">
                    Marcar Past Due
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateAsaasWebhook('SUBSCRIPTION_DELETED')}
                  disabled={simWebhookLoading}
                  className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 font-bold rounded-2xl text-xs transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Simular Assinatura Cancelada (SUBSCRIPTION_DELETED)</span>
                  </div>
                  <span className="text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-md font-semibold">
                    Cancelar Acesso
                  </span>
                </button>
              </div>

              {/* Resultado do Webhook */}
              {simWebhookResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                  simWebhookResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>{simWebhookResult.event}</span>
                    <span>{simWebhookResult.timestamp}</span>
                  </div>
                  <p>{simWebhookResult.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Seção 3: Histórico de Logs do Asaas (asaas_event_log) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                  Logs de Eventos Recebidos (asaas_event_log)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Verificação de idempotência e histórico dos webhooks processados pelo sistema
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchAsaasLogs()}
                disabled={loadingAsaasLogs}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Recarregar Logs"
              >
                <RefreshCw size={16} className={loadingAsaasLogs ? 'animate-spin' : ''} />
              </button>
            </div>

            {asaasEventLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs">
                Nenhum evento registrado ainda na tabela <code>asaas_event_log</code>.
                Execute uma simulação ou aguarde um webhook do Sandbox.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">Evento</th>
                      <th className="py-2.5 px-3">Event ID</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {asaasEventLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-2.5 px-3 font-mono text-zinc-500">
                          {new Date(log.processed_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-zinc-800 dark:text-zinc-200">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                            log.event_type?.includes('CONFIRMED') || log.event_type?.includes('RECEIVED')
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : log.event_type?.includes('OVERDUE')
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {log.event_type || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 truncate max-w-xs">
                          {log.event_id}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                          Processado
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

      {activeTab === "sa-users" && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <Users className="text-ministral-500" size={24} />
                  Gestão Global de Usuários
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Busque rapidamente qualquer usuário do sistema independente da
                  organização
                </p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                <select
                  value={filterOrgId}
                  onChange={(e) => {
                    setFilterOrgId(e.target.value);
                    setFilterMinistryId("");
                  }}
                  className="w-full md:w-auto px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white"
                >
                  <option value="">Todas as Organizações</option>
                  <option value="none">Sem Organização</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterMinistryId}
                  onChange={(e) => setFilterMinistryId(e.target.value)}
                  disabled={!filterOrgId}
                  className="w-full md:w-auto px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white disabled:opacity-50"
                >
                  <option value="">Todos os Ministérios</option>
                  {availableMinistriesForOrg.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <div className="relative w-full md:w-auto">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={searchUserTerm}
                    onChange={(e) => setSearchUserTerm(e.target.value)}
                    className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white"
                  />
                </div>
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
                      <th className="px-6 py-4">Ministérios</th>
                      <th className="px-6 py-4 text-center">Permissão</th>
                      <th className="px-6 py-4">Último Login</th>
                      <th className="px-6 py-4 text-center rounded-tr-2xl">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredGlobalUsers
                      .slice(0, 1500) // Increase limit to show more members
                      .map((u: any) => (
                        <tr
                          key={u.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-ministral-500/10 flex items-center justify-center text-ministral-500 font-bold shrink-0">
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 dark:text-white">
                                  {u.name}
                                </div>
                                <div className="text-sm text-zinc-500">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-zinc-900 dark:text-white font-medium">
                              {u.organizations?.name || (
                                <span className="text-zinc-500 italic">
                                  Sem Organização
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {u.ministriesDetails &&
                            u.ministriesDetails.length > 0 ? (
                              <div className="flex flex-col gap-1 items-start">
                                {u.ministriesDetails.map((m: any) => (
                                  <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs shadow-sm border border-zinc-200 dark:border-zinc-700"
                                  >
                                    {m.label}
                                    <button
                                      onClick={() => {
                                        confirmAction(
                                          `Remover de ${m.label}`,
                                          `Deseja realmente remover ${u.name} do ministério ${m.label}?`,
                                          async () => {
                                            const res =
                                              await removeGlobalUserFromMinistry(
                                                u.id,
                                                m.id,
                                                u.organization_id,
                                              );
                                            if (res.success) {
                                              queryClient.invalidateQueries({
                                                queryKey: [
                                                  "super_admin_global_users",
                                                ],
                                              });
                                              addToast(res.message, "success");
                                            } else {
                                              addToast(res.message, "error");
                                            }
                                          }
                                        );
                                      }}
                                      className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-0.5 rounded-full transition-colors"
                                      title={`Remover de ${m.label}`}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic text-sm">
                                Nenhum
                              </span>
                            )}
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
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString(
                                  "pt-BR",
                                )
                              : "Desconhecido"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                confirmAction(
                                  "Remover Usuário Permanentemente",
                                  `Tem certeza que deseja remover permanentemente o usuário ${u.name}? Esta ação não pode ser desfeita.`,
                                  async () => {
                                    const res = await deleteGlobalUser(u.id);
                                    if (res.success) {
                                      addToast("Usuário removido", "success");
                                      queryClient.invalidateQueries({
                                        queryKey: ["super_admin_global_users"],
                                      });
                                    } else {
                                      addToast(
                                        "Erro ao remover: " + res.message,
                                        "error",
                                      );
                                    }
                                  }
                                );
                              }}
                              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remover Usuário"
                            >
                              <Trash2 size={16} />
                            </button>
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

      {activeTab === "sa-support" && (
        <div className="space-y-6 animate-slide-up">
          {activeTicket ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-800/20">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-zinc-500 font-bold text-xs">
                      {activeTicket.id}
                    </span>
                    {activeTicket.status === "open" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">
                        Aberto
                      </span>
                    ) : activeTicket.status === "in_progress" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">
                        Em Andamento
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
                        Resolvido
                      </span>
                    )}
                    <span className="text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {activeTicket.orgName}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                    {activeTicket.subject}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Aberto por {activeTicket.authorName} em{" "}
                    {new Date(activeTicket.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => handleDeleteTicket(e, activeTicket.id)}
                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Excluir Chamado"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button
                    onClick={() => setActiveTicket(null)}
                    className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-zinc-500">
                    {activeTicket.authorName
                      ? activeTicket.authorName.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 p-4 rounded-b-2xl rounded-tr-2xl shadow-sm relative">
                    <span className="absolute -top-3 left-4 text-xs font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-2 rounded-full">
                      {activeTicket.authorName}
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {activeTicket.description}
                    </p>
                    {activeTicket.imageUrl && (
                      <div className="mt-4">
                        <a
                          href={activeTicket.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={activeTicket.imageUrl}
                            alt="Anexo do chamado"
                            className="max-w-full max-h-64 object-contain rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {activeTicket.replies?.map((reply: any) => (
                  <div
                    key={reply.id}
                    className={`flex gap-4 ${reply.isSuperAdmin ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${reply.isSuperAdmin ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"}`}
                    >
                      {reply.isSuperAdmin ? (
                        <Headset size={18} />
                      ) : reply.authorName ? (
                        reply.authorName.charAt(0).toUpperCase()
                      ) : (
                        "U"
                      )}
                    </div>
                    <div
                      className={`border p-4 shadow-sm relative ${reply.isSuperAdmin ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/20 rounded-b-2xl rounded-tl-2xl" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700/50 rounded-b-2xl rounded-tr-2xl"}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">
                          {reply.isSuperAdmin
                            ? "Suporte Técnico"
                            : reply.authorName}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {new Date(reply.createdAt).toLocaleTimeString(
                            "pt-BR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                {activeTicket.status === "resolved" ? (
                  <div className="text-center p-3 text-emerald-600 font-medium flex items-center justify-center gap-2 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                    <CheckCircle2 size={18} /> Resolvido. O cliente não pode
                    mais enviar mensagens aqui.
                  </div>
                ) : (
                  <form onSubmit={handleReplyTicket} className="flex gap-3">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Digite sua resposta..."
                      className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 shrink-0"
                    >
                      Enviar (Em Andamento)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleReplyTicket(e, "resolved")}
                      className="px-6 py-3 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shrink-0 flex items-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Resolver
                    </button>
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
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                      Help Desk Central
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Gerencie chamados de suporte técnico de todas as
                      organizações
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadTickets}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold transition-all text-sm"
                >
                  <RefreshCw size={16} /> Atualizar Fila
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">
                    Abertos
                  </div>
                  <div className="text-3xl font-black text-zinc-900 dark:text-white">
                    {ticketsOpen}
                  </div>
                </div>
                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">
                    Criticos
                  </div>
                  <div className="text-3xl font-black text-red-500">
                    {ticketsCritical}
                  </div>
                </div>
                <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">
                    Resolvidos
                  </div>
                  <div className="text-3xl font-black text-emerald-500">
                    {ticketsResolved}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {globalTickets.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50">
                    <Ticket
                      size={48}
                      className="text-zinc-300 dark:text-zinc-600 mb-4"
                    />
                    <h4 className="font-bold text-zinc-800 dark:text-white text-lg">
                      Fila Vazia
                    </h4>
                    <p className="text-zinc-500 mt-2 max-w-md">
                      Nenhum chamado de suporte encontrado. Bom trabalho!
                    </p>
                  </div>
                ) : (
                  globalTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      onClick={() => setActiveTicket(ticket)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-5 cursor-pointer transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                          <MessageSquare
                            size={20}
                            className={
                              ticket.status === "resolved"
                                ? "text-emerald-500"
                                : "text-blue-500"
                            }
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-zinc-500 font-bold text-xs">
                              {ticket.id}
                            </span>
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                              {ticket.orgName}
                            </span>
                            {ticket.priority === "critical" ? (
                              <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500">
                                <AlertCircle size={10} /> Crítica
                              </span>
                            ) : ticket.priority === "high" ? (
                              <span className="text-[10px] font-black uppercase text-orange-500">
                                Alta
                              </span>
                            ) : null}
                          </div>
                          <h4 className="font-bold text-zinc-900 dark:text-white">
                            {ticket.subject}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                            {ticket.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0 ml-4">
                        <div className="text-right flex flex-col items-end gap-2">
                          {ticket.status === "open" ? (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">
                              Aberto
                            </span>
                          ) : ticket.status === "in_progress" ? (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">
                              Em Andamento
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Resolvido
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(ticket.createdAt).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteTicket(e, ticket.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Excluir Chamado"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "sa-audit" && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                    Security & Audit Trail
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Monitoramento global de eventos críticos da plataforma
                  </p>
                </div>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar eventos..."
                  className="w-full md:w-64 pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-ministral-500 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <select
                value={auditFilterOrg}
                onChange={(e) => setAuditFilterOrg(e.target.value)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-sm dark:text-white"
              >
                <option value="">Todas as organizações</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => loadAuditLogs(auditFilterOrg || undefined)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>

            {isLoadingAudit ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl">
                <ShieldCheck size={32} className="text-zinc-400 mx-auto mb-3" />
                <p className="text-zinc-500 font-medium">
                  Nenhum log de auditoria encontrado.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                      <th className="px-6 py-4">Data/Hora</th>
                      <th className="px-6 py-4">Ação</th>
                      <th className="px-6 py-4">Ator</th>
                      <th className="px-6 py-4">Alvo</th>
                      <th className="px-6 py-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-sm text-zinc-500 font-mono">
                          {new Date(log.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                              AUDIT_ACTION_COLORS[log.action] ||
                              "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {AUDIT_ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-medium text-sm text-zinc-900 dark:text-white">
                          {log.actor_name}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-zinc-600 dark:text-zinc-400">
                          {log.target_name || log.target_type || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-zinc-500 max-w-[200px] truncate">
                          {log.ministry_id
                            ? `Ministério: ${log.ministry_id.slice(0, 8)}...`
                            : "Global"}
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

      {activeTab === "sa-quotas" && (
        <div className="space-y-8 animate-slide-up pb-12">
          {/* Header do Painel de Quotas */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/15 to-indigo-500/15 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                  <Cpu size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
                      Rate Limiting & Quotas de IA
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20">
                      Controle de Custos & Poder
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                    Configure os limites da Inteligência Artificial por organização, diferencie cotas gratuitas de pacotes pagos de alto poder e acompanhe o consumo semanal em % para não estourar custos.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetchQuotas()}
                  disabled={loadingQuotas}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50"
                  title="Atualizar métricas de uso"
                >
                  <RefreshCw size={14} className={loadingQuotas ? "animate-spin text-purple-500" : ""} />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {/* 4 Cards de Métricas Globais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Consumo Semanal Global */}
              <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 dark:border-purple-500/15 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                      Uso Semanal Global
                    </span>
                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                      {aiOverview.totalGlobalUsedThisWeek} <span className="text-sm font-medium text-zinc-400">/ {aiOverview.totalGlobalLimit > 0 ? aiOverview.totalGlobalLimit : '∞'} req</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-500 dark:text-zinc-400">Capacidade da Semana</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400">
                      {aiOverview.globalPercentUsed}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200/60 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, aiOverview.globalPercentUsed)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock size={10} /> Renova automaticamente na Segunda-feira
                  </span>
                </div>
              </div>

              {/* Card 2: Acesso por Organização */}
              <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 dark:border-amber-500/15 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                      Acesso à IA Ativo
                    </span>
                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                      {aiOverview.activeWithAI} <span className="text-sm font-medium text-zinc-400">/ {aiOverview.totalOrganizations} igrejas</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Zap size={20} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {aiOverview.proTierCount} Pro / Turbo
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {aiOverview.freeTierCount} Grátis
                  </span>
                  {aiOverview.enterpriseTierCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300">
                      {aiOverview.enterpriseTierCount} Ilimitadas
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Status & Alertas de Quota */}
              <div className={`bg-gradient-to-br ${aiOverview.exceededOrgsCount > 0 ? 'from-red-500/5 to-rose-500/5 border-red-500/30' : 'from-emerald-500/5 to-teal-500/5 border-emerald-500/20'} border rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${aiOverview.exceededOrgsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      Alertas de Limite
                    </span>
                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                      {aiOverview.exceededOrgsCount > 0 ? (
                        <span className="text-red-500">{aiOverview.exceededOrgsCount} Esgotada(s)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Sob Controle</span>
                      )}
                    </h4>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${aiOverview.exceededOrgsCount > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                    {aiOverview.exceededOrgsCount > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {aiOverview.warningOrgsCount > 0 ? (
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      ⚠️ {aiOverview.warningOrgsCount} igreja(s) próximas do limite (&gt;80%)
                    </span>
                  ) : (
                    <span>Todas as igrejas operando dentro da cota configurada</span>
                  )}
                </div>
              </div>

              {/* Card 4: Total Global de Usuários */}
              <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 dark:border-blue-500/15 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                      Usuários do Sistema
                    </span>
                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                      {globalUsers.length} <span className="text-sm font-medium text-zinc-400">inscritos</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-500">Capacidade Infra</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {Math.min(100, Math.round((globalUsers.length / 1000) * 100))}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200/60 dark:bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (globalUsers.length / 1000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Gestão de Quotas por Organização */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sliders size={20} className="text-purple-500" />
                  Controle de Limites por Organização
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Ative ou desative a IA, alterne entre os planos Grátis (Econômico) e Turbo (Alto Poder) ou configure limites customizados.
                </p>
              </div>

              {/* Filtros e Busca */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar igreja..."
                    value={quotaSearchTerm}
                    onChange={(e) => setQuotaSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-900 dark:text-white transition-all"
                  />
                  {quotaSearchTerm && (
                    <button
                      onClick={() => setQuotaSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={quotaTierFilter}
                  onChange={(e) => setQuotaTierFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Todos os Planos de IA</option>
                  <option value="free">🆓 Grátis (25 req/sem)</option>
                  <option value="pro">⚡ Pro / Turbo (150 req/sem)</option>
                  <option value="enterprise">💎 Enterprise (Ilimitado)</option>
                  <option value="custom">⚙️ Personalizado</option>
                </select>

                <select
                  value={quotaStatusFilter}
                  onChange={(e) => setQuotaStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">🟢 IA Habilitada</option>
                  <option value="warning">⚠️ Quota &gt; 80%</option>
                  <option value="exceeded">⛔ Quota Esgotada</option>
                  <option value="disabled">❌ IA Desativada</option>
                </select>
              </div>
            </div>

            {/* Lista de Organizações */}
            {loadingQuotas ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-purple-500" />
                <p className="text-sm font-medium">Carregando métricas e quotas de IA...</p>
              </div>
            ) : filteredQuotaStatuses.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <Cpu size={36} className="mx-auto mb-2 opacity-30 text-purple-500" />
                <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Nenhuma organização encontrada com os filtros atuais.</p>
                <p className="text-xs text-zinc-400 mt-1">Tente limpar a busca ou mudar os filtros de plano/status.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuotaStatuses.map((item) => {
                  const isUnlimited = item.tier === "enterprise" || item.weeklyLimit >= 999999;
                  const isExceeded = item.status === "exceeded";
                  const isWarning = item.status === "warning";
                  const isDisabled = !item.enabled;

                  return (
                    <div
                      key={item.organizationId}
                      className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                        isDisabled
                          ? "bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-75"
                          : isExceeded
                          ? "bg-red-500/5 dark:bg-red-950/20 border-red-500/30 shadow-xs"
                          : isWarning
                          ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200/80 dark:border-zinc-800 hover:border-purple-500/40 shadow-xs"
                      }`}
                    >
                      {/* Info da Organização e Status */}
                      <div className="flex items-center gap-3.5 min-w-[260px]">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                            isDisabled
                              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700"
                              : item.tier === "pro"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : item.tier === "enterprise"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {item.organizationName ? item.organizationName.slice(0, 2).toUpperCase() : "IG"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                              {item.organizationName || `Org #${item.organizationId.slice(0, 8)}`}
                            </h5>
                            {isDisabled ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                IA Desativada
                              </span>
                            ) : isExceeded ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse">
                                Limite 100% Esgotado
                              </span>
                            ) : isWarning ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                Quota Quase Cheia
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Ativa & Saudável
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                            <span className="font-mono text-[11px] opacity-75">
                              ID: {item.organizationId.slice(0, 8)}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{DEFAULT_TIER_LIMITS[item.tier]?.label || item.tier}</span>
                            {item.allowedModels === "all" ? (
                              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded">
                                Turbo (Gemini 3.7 & Pro)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                                Básico (Flash Lite)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Consumo Semanal em % */}
                      <div className="flex-1 max-w-md min-w-[200px] space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                            <BatteryCharging size={13} className={isExceeded ? "text-red-500" : "text-purple-500"} />
                            <span>Consumo da Semana</span>
                          </span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-white">
                            {isUnlimited ? (
                              <span className="text-purple-600 dark:text-purple-400">{item.usedThisWeek} req (Ilimitado)</span>
                            ) : (
                              <span>
                                {item.usedThisWeek} / {item.totalLimit} req
                                <span className={`ml-1.5 font-black ${isExceeded ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                                  ({item.percentUsed}%)
                                </span>
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-200/50 dark:border-zinc-700/50">
                          {isUnlimited ? (
                            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 w-full rounded-full opacity-60 animate-pulse" />
                          ) : (
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isExceeded
                                  ? "bg-red-500"
                                  : isWarning
                                  ? "bg-amber-500"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
                              }`}
                              style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                            />
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                          <span>
                            {isUnlimited
                              ? "Sem limite semanal"
                              : `${item.remaining} requisições restantes`}
                          </span>
                          {item.bonusCredits > 0 && (
                            <span className="text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.2 rounded">
                              +{item.bonusCredits} créditos extras
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Seletor Rápido de Plano de IA */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={item.tier}
                          onChange={(e) => handleQuickTierChange(item, e.target.value as AIPlanTier)}
                          disabled={isDisabled}
                          className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
                          title="Alterar plano de IA"
                        >
                          <option value="free">🆓 Grátis (25/sem)</option>
                          <option value="pro">⚡ Pro / Turbo (150/sem)</option>
                          <option value="enterprise">💎 Enterprise (Ilimitado)</option>
                          <option value="custom">⚙️ Custom</option>
                        </select>

                        {/* Switch Ativar/Desativar */}
                        <button
                          onClick={() => handleToggleAI(item)}
                          className={`p-1.5 rounded-xl border transition-all ${
                            item.enabled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-600"
                          }`}
                          title={item.enabled ? "Desativar IA para esta igreja" : "Ativar IA para esta igreja"}
                        >
                          {item.enabled ? <Zap size={16} /> : <Zap size={16} className="opacity-30" />}
                        </button>

                        {/* Botão Ajuste Fino */}
                        <button
                          onClick={() => handleOpenQuotaModal(item)}
                          className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all shadow-xs"
                          title="Ajuste fino de limites"
                        >
                          <Sliders size={16} />
                        </button>

                        {/* Botão Recarga de Créditos Bônus */}
                        <button
                          onClick={() => handleOpenBonusModal(item)}
                          className="p-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800/40 transition-all shadow-xs"
                          title="Adicionar pacote de créditos avulsos (serviço pago à parte)"
                        >
                          <Plus size={16} />
                        </button>

                        {/* Botão Zerar Semana */}
                        <button
                          onClick={() => handleResetWeeklyUsage(item)}
                          className="p-1.5 bg-zinc-50 hover:bg-amber-50 dark:bg-zinc-800 dark:hover:bg-amber-950/30 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all"
                          title="Zerar consumo semanal (reset manual de cortesia)"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Configuração de Quota da Organização */}
      {isQuotaModalOpen && editingQuotaOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-800 dark:text-white">
                    Configurar Quota de IA
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {editingQuotaOrg.organizationName || `Org #${editingQuotaOrg.organizationId.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuotaModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuotaConfig} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {/* Toggle Habilitar IA */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <div>
                  <h5 className="font-bold text-sm text-zinc-800 dark:text-white">Acesso ao Módulo de IA</h5>
                  <p className="text-xs text-zinc-500">Permite usar gerador de escalas, avisos e análises</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuotaFormData(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    quotaFormData.enabled
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {quotaFormData.enabled ? "Ativada" : "Desativada"}
                </button>
              </div>

              {/* Seletor de Plano / Nível */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5">
                  Nível de IA da Organização
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaFormData(prev => ({
                        ...prev,
                        tier: "free",
                        weeklyLimit: 25,
                        allowedModels: "basic",
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quotaFormData.tier === "free"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>🆓 Grátis (Básica)</span>
                      {quotaFormData.tier === "free" && <Check size={14} />}
                    </div>
                    <span className="text-[11px] opacity-75 mt-0.5 block">25 req/sem • Flash Lite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuotaFormData(prev => ({
                        ...prev,
                        tier: "pro",
                        weeklyLimit: 150,
                        allowedModels: "all",
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quotaFormData.tier === "pro"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>⚡ Pro (Turbo)</span>
                      {quotaFormData.tier === "pro" && <Check size={14} />}
                    </div>
                    <span className="text-[11px] opacity-75 mt-0.5 block">150 req/sem • Gemini 3.7</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuotaFormData(prev => ({
                        ...prev,
                        tier: "enterprise",
                        weeklyLimit: 999999,
                        allowedModels: "all",
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quotaFormData.tier === "enterprise"
                        ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>💎 Enterprise</span>
                      {quotaFormData.tier === "enterprise" && <Check size={14} />}
                    </div>
                    <span className="text-[11px] opacity-75 mt-0.5 block">Ilimitado • Raciocínio Pro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuotaFormData(prev => ({
                        ...prev,
                        tier: "custom",
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quotaFormData.tier === "custom"
                        ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>⚙️ Custom</span>
                      {quotaFormData.tier === "custom" && <Check size={14} />}
                    </div>
                    <span className="text-[11px] opacity-75 mt-0.5 block">Limite numérico livre</span>
                  </button>
                </div>
              </div>

              {/* Limite Semanal Numérico */}
              {quotaFormData.tier !== "enterprise" && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase">
                      Limite Semanal de Requisições
                    </label>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {quotaFormData.weeklyLimit} chamadas/semana
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={quotaFormData.weeklyLimit}
                    onChange={(e) => setQuotaFormData(prev => ({ ...prev, weeklyLimit: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-900 dark:text-white font-mono text-sm"
                  />
                  {/* Presets rápidos */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[15, 25, 50, 100, 200, 500].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQuotaFormData(prev => ({ ...prev, weeklyLimit: val }))}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          quotaFormData.weeklyLimit === val
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {val} req
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissão de Modelos de IA */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5">
                  Poder dos Modelos de IA Liberados
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                    <input
                      type="radio"
                      name="allowedModels"
                      checked={quotaFormData.allowedModels === "basic"}
                      onChange={() => setQuotaFormData(prev => ({ ...prev, allowedModels: "basic" }))}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-bold text-xs text-zinc-800 dark:text-white block">
                        🍃 Modelos Econômicos (Recomendado para Plano Básico / Gratuito)
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        Gemini Flash Lite e modelos leves com menor custo por token.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer">
                    <input
                      type="radio"
                      name="allowedModels"
                      checked={quotaFormData.allowedModels === "all"}
                      onChange={() => setQuotaFormData(prev => ({ ...prev, allowedModels: "all" }))}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-bold text-xs text-zinc-800 dark:text-white block">
                        ⚡ Alto Poder &amp; Raciocínio Profundo (Plano Pro / Turbo / Pago)
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        Gemini 3.7 Flash, Gemini 2.5 Pro e OpenRouter para geração mais inteligente.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ações do Modal */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuota}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingQuota ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{isSavingQuota ? "Salvando..." : "Salvar Configuração"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Recarga de Créditos Avulsos (Serviço Pago à Parte) */}
      {isBonusModalOpen && bonusOrgTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-800 dark:text-white">
                    Recarga Avulsa de Créditos de IA
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {bonusOrgTarget.organizationName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBonusModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Utilize esta opção caso tenha cobrado a IA como um <strong>serviço à parte</strong> ou pacote adicional. Os créditos avulsos somam-se imediatamente à cota da organização e garantem uso contínuo.
              </p>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5">
                  Quantidade de Créditos a Adicionar
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={bonusAmountToAdd}
                  onChange={(e) => setBonusAmountToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-900 dark:text-white font-mono text-sm"
                />

                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[25, 50, 100, 250].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBonusAmountToAdd(amt)}
                      className={`text-xs font-bold py-2 rounded-xl border transition-all ${
                        bonusAmountToAdd === amt
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 rounded-xl text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between">
                <span>Créditos atuais: <strong>{bonusOrgTarget.bonusCredits}</strong></span>
                <span>Após recarga: <strong>{bonusOrgTarget.bonusCredits + bonusAmountToAdd}</strong></span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsBonusModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddBonus}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Adicionar +{bonusAmountToAdd} Créditos</span>
                </button>
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
                {editingOrg ? "Editar Organização" : "Nova Organização"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">
                    Nome da Organização
                  </label>
                  <input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                    placeholder="Ex: Igreja Central"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">
                    Slug
                  </label>
                  <input
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                  />
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <h4 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2 text-sm uppercase">
                    <CreditCard size={14} /> Assinatura & Controle
                  </h4>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                        Plano
                      </label>
                      <select
                        value={formData.plan_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            plan_type: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none text-zinc-800 dark:text-white"
                      >
                        <option value="trial">Trial</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                        Status Pagamento
                      </label>
                      <select
                        value={formData.billing_status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billing_status: e.target.value,
                          })
                        }
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
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      Fim do Trial (Data)
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        formData.trial_ends_at
                          ? new Date(formData.trial_ends_at)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          trial_ends_at: new Date(e.target.value).toISOString(),
                        })
                      }
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                      Checkout URL (Link Pagamento)
                    </label>
                    <input
                      value={formData.checkout_url}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          checkout_url: e.target.value,
                        })
                      }
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm outline-none"
                      placeholder="https://stripe..."
                    />
                  </div>

                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.access_locked ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900" : "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"}`}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        access_locked: !formData.access_locked,
                      })
                    }
                  >
                    <div
                      className={
                        formData.access_locked
                          ? "text-red-500"
                          : "text-zinc-400"
                      }
                    >
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                        Bloquear Acesso
                      </p>
                      <p className="text-xs text-zinc-500">
                        Impede login de todos os membros.
                      </p>
                    </div>
                    <div className="ml-auto">
                      {formData.access_locked ? (
                        <ToggleRight className="text-red-500" size={20} />
                      ) : (
                        <ToggleLeft className="text-zinc-400" size={20} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="animate-spin" size={14} />}
                    Salvar Dados
                  </button>
                </div>
              </form>

              {editingOrg && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                  <h4 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
                    <Layers size={18} /> Ministérios da Organização
                  </h4>

                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">
                          Código (ID)
                        </label>
                        <input
                          value={newMinistryCode}
                          onChange={(e) =>
                            setNewMinistryCode(
                              e.target.value.toLowerCase().replace(/\s+/g, "-"),
                            )
                          }
                          placeholder="ex: jovens"
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">
                          Nome Exibição
                        </label>
                        <input
                          value={newMinistryLabel}
                          onChange={(e) => setNewMinistryLabel(e.target.value)}
                          placeholder="ex: Ministério de Jovens"
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <button
                        onClick={handleAddMinistry}
                        disabled={ministrySaving}
                        className="w-full sm:w-auto bg-secondary hover:bg-secondaryHover text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                      >
                        {ministrySaving ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {editingOrg.ministries &&
                    editingOrg.ministries.length > 0 ? (
                      editingOrg.ministries.map((min) => (
                        <div
                          key={min.code}
                          className="flex justify-between items-center p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg shadow-sm"
                        >
                          <div>
                            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                              {min.label}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">
                              {min.code}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleToggleCronograma(min.code);
                              }}
                              className={`p-2 rounded-lg transition-colors border ${min.enabled_tabs?.includes("service_schedule") ? "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50" : "text-zinc-400 bg-zinc-50 border-zinc-200 hover:text-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50"}`}
                              title="Toggle Acesso ao Cronograma"
                            >
                              <Sparkles size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleCopyInviteLink(
                                  min.id,
                                  editingOrg.id,
                                  min.label,
                                );
                              }}
                              className="text-zinc-400 hover:text-emerald-500 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Copiar Link de Convite"
                            >
                              <LinkIcon size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteMinistry(min.code);
                              }}
                              className="text-zinc-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-zinc-400 py-4 italic">
                        Nenhum ministério cadastrado.
                      </p>
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

import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  CustomEvent,
  ScheduleMap,
  SwapRequest,
  TeamMemberProfile,
} from "../types";

interface OrganizationOperationsPanelProps {
  events: CustomEvent[];
  schedule: ScheduleMap;
  expandedRoles: string[];
  publicMembers: TeamMemberProfile[];
  swapRequests: SwapRequest[];
  onNavigate: (tab: string) => void;
}

type AlertLevel = "critical" | "warning" | "info";

interface OperationalAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  tab: string;
}

const EXCLUDED_ASSIGNMENT = "__EXCLUDED__";
const HORIZON_DAYS = 45;

function eventTimestamp(event: CustomEvent) {
  const dateTime = new Date(`${event.date}T${event.time || "00:00"}`);
  if (!Number.isNaN(dateTime.getTime())) return dateTime.getTime();

  const isoDate = new Date(event.iso).getTime();
  return Number.isNaN(isoDate) ? Number.POSITIVE_INFINITY : isoDate;
}

function formatEventDate(event: CustomEvent) {
  const date = new Date(`${event.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return event.date;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getAssignedNames(event: CustomEvent, schedule: ScheduleMap) {
  return Object.entries(schedule)
    .filter(
      ([key, name]) =>
        key.startsWith(`${event.id}|`) &&
        Boolean(name) &&
        name !== EXCLUDED_ASSIGNMENT,
    )
    .map(([key, name]) => ({
      name,
      role: key.split("|").slice(2).join("|") || "Função",
    }));
}

const alertStyles: Record<AlertLevel, { icon: React.ReactNode; className: string }> = {
  critical: {
    icon: <ShieldAlert size={18} aria-hidden="true" />,
    className: "border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200",
  },
  warning: {
    icon: <AlertTriangle size={18} aria-hidden="true" />,
    className: "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
  },
  info: {
    icon: <ClipboardList size={18} aria-hidden="true" />,
    className: "border-zinc-200 bg-zinc-50/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200",
  },
};

export function OrganizationOperationsPanel({
  events,
  schedule,
  expandedRoles,
  publicMembers,
  swapRequests,
  onNavigate,
}: OrganizationOperationsPanelProps) {
  const operations = useMemo(() => {
    const now = Date.now();
    const horizon = now + HORIZON_DAYS * 24 * 60 * 60 * 1000;
    const upcomingEvents = events
      .filter((event) => {
        const timestamp = eventTimestamp(event);
        return timestamp >= now && timestamp <= horizon;
      })
      .sort((a, b) => eventTimestamp(a) - eventTimestamp(b));

    const uncoveredEvents = upcomingEvents
      .map((event) => {
        const openRoles = expandedRoles.filter((role) => {
          const assignment = schedule[`${event.id}|${role}`];
          return !assignment || assignment === EXCLUDED_ASSIGNMENT;
        });
        return { event, openRoles };
      })
      .filter(({ openRoles }) => openRoles.length > 0);

    const pendingSwaps = swapRequests.filter((request) => request.status === "pending");
    const assignmentLoads = new Map<string, number>();
    upcomingEvents.forEach((event) => {
      getAssignedNames(event, schedule).forEach(({ name }) => {
        assignmentLoads.set(name, (assignmentLoads.get(name) || 0) + 1);
      });
    });

    const averageLoad = assignmentLoads.size
      ? Array.from(assignmentLoads.values()).reduce((sum, value) => sum + value, 0) /
        assignmentLoads.size
      : 0;
    const overloadedMembers = Array.from(assignmentLoads.entries())
      .filter(([, count]) => count >= 4 && count > averageLoad + 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const eventsBySlot = new Map<string, Array<{ event: CustomEvent; name: string }>>();
    upcomingEvents.forEach((event) => {
      const slot = `${event.date}|${event.time || "00:00"}`;
      getAssignedNames(event, schedule).forEach(({ name }) => {
        const current = eventsBySlot.get(`${slot}|${name}`) || [];
        current.push({ event, name });
        eventsBySlot.set(`${slot}|${name}`, current);
      });
    });

    const conflicts = Array.from(eventsBySlot.entries())
      .filter(([, assignments]) => assignments.length > 1)
      .map(([key, assignments]) => ({
        key,
        name: assignments[0].name,
        events: assignments.map(({ event }) => event),
      }))
      .slice(0, 3);

    const alerts: OperationalAlert[] = [];
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      alerts.push({
        id: `conflict-${conflict.key}`,
        level: "critical",
        title: `${conflict.name} aparece em horários conflitantes`,
        detail: conflict.events.map((event) => event.title).join(" e "),
        tab: "schedule-editor",
      });
    }
    if (uncoveredEvents.length > 0) {
      const first = uncoveredEvents[0];
      alerts.push({
        id: `coverage-${first.event.id}`,
        level: "warning",
        title: `${uncoveredEvents.length} evento(s) com vaga aberta`,
        detail: `${first.event.title} ainda precisa de ${first.openRoles.length} função(ões).`,
        tab: "schedule-editor",
      });
    }
    if (pendingSwaps.length > 0) {
      alerts.push({
        id: "pending-swaps",
        level: "warning",
        title: `${pendingSwaps.length} troca(s) aguardando tratamento`,
        detail: "Revise as solicitações antes do próximo compromisso.",
        tab: "pending-center",
      });
    }
    if (overloadedMembers.length > 0) {
      const [name, count] = overloadedMembers[0];
      alerts.push({
        id: "overloaded-member",
        level: "info",
        title: "Distribuição de carga merece revisão",
        detail: `${name} está escalado(a) ${count} vezes nos próximos 45 dias.`,
        tab: "members",
      });
    }

    return {
      upcomingEvents,
      uncoveredEvents,
      pendingSwaps,
      conflicts,
      overloadedMembers,
      alerts: alerts.slice(0, 4),
      assignedMembers: assignmentLoads.size,
    };
  }, [events, expandedRoles, publicMembers.length, schedule, swapRequests]);

  const metrics = [
    {
      label: "Próximos eventos",
      value: operations.upcomingEvents.length,
      helper: `janela de ${HORIZON_DAYS} dias`,
      icon: <CalendarDays size={19} aria-hidden="true" />,
      accent: "text-secondary",
    },
    {
      label: "Vagas abertas",
      value: operations.uncoveredEvents.reduce((sum, item) => sum + item.openRoles.length, 0),
      helper: "funções sem responsável",
      icon: <ClipboardList size={19} aria-hidden="true" />,
      accent: "text-gold",
    },
    {
      label: "Trocas pendentes",
      value: operations.pendingSwaps.length,
      helper: "aguardando decisão",
      icon: <RefreshCw size={19} aria-hidden="true" />,
      accent: "text-secondary",
    },
    {
      label: "Conflitos detectados",
      value: operations.conflicts.length,
      helper: `${operations.assignedMembers} membro(s) escalado(s)`,
      icon: <Users size={19} aria-hidden="true" />,
      accent: operations.conflicts.length > 0 ? "text-red-500" : "text-secondary",
    },
  ];

  return (
    <section
      aria-labelledby="organization-operations-title"
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            Visão administrativa
          </p>
          <h2 id="organization-operations-title" className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            Central operacional
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Prioridades da sua organização para os próximos {HORIZON_DAYS} dias.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("schedule-editor")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary dark:border-zinc-700 dark:text-zinc-200"
        >
          Gerenciar escala
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className={`mb-3 flex items-center gap-2 ${metric.accent}`}>
              {metric.icon}
              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {metric.label}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-zinc-900 dark:text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{metric.helper}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">Prioridades de atenção</h3>
          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Atualizado com os dados atuais</span>
        </div>
        {operations.alerts.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-secondary/20 bg-secondary/5 p-4 text-sm text-zinc-700 dark:text-zinc-200">
            <CheckCircle2 className="mt-0.5 shrink-0 text-secondary" size={18} aria-hidden="true" />
            <div>
              <p className="font-bold">Tudo sob controle por enquanto.</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Não há conflitos, vagas abertas ou trocas pendentes nos próximos eventos.</p>
            </div>
          </div>
        ) : (
          operations.alerts.map((alert) => {
            const style = alertStyles[alert.level];
            return (
              <button
                type="button"
                key={alert.id}
                onClick={() => onNavigate(alert.tab)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${style.className}`}
              >
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{alert.title}</span>
                  <span className="mt-1 block text-xs opacity-80">{alert.detail}</span>
                </span>
                <ArrowRight className="mt-0.5 shrink-0 opacity-60" size={16} aria-hidden="true" />
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

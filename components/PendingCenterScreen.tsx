import React, { useMemo } from "react";
import {
  AlertCircle,
  Bell,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Megaphone,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "./ui";
import {
  Announcement,
  AppNotification,
  AttendanceMap,
  CustomEvent,
  ScheduleMap,
  SwapRequest,
  User,
} from "../types";

type VisibleEvent = CustomEvent & { dateDisplay?: string };

type PendingKind = "confirmation" | "swap" | "announcement" | "notification";

interface PendingItem {
  id: string;
  kind: PendingKind;
  title: string;
  description: string;
  meta: string;
  tone: "primary" | "warning" | "neutral";
  actionLabel: string;
  actionTab: string;
  assignmentKey?: string;
}

interface PendingCenterScreenProps {
  currentUser: User;
  events: VisibleEvent[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  swapRequests: SwapRequest[];
  announcements: Announcement[];
  notifications: AppNotification[];
  onConfirm: (assignmentKey: string) => void;
  onOpenTab: (tab: string) => void;
}

const getDateLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
};

const getActionTab = (actionLink?: string) => {
  if (!actionLink) return "dashboard";
  try {
    const url = new URL(actionLink, window.location.origin);
    return url.searchParams.get("tab") || actionLink.replace(/^#/, "") || "dashboard";
  } catch {
    return actionLink.replace(/^#/, "") || "dashboard";
  }
};

const iconForKind = (kind: PendingKind) => {
  if (kind === "confirmation") return <CalendarCheck2 size={19} aria-hidden="true" />;
  if (kind === "swap") return <RefreshCcw size={19} aria-hidden="true" />;
  if (kind === "announcement") return <Megaphone size={19} aria-hidden="true" />;
  return <Bell size={19} aria-hidden="true" />;
};

export const PendingCenterScreen: React.FC<PendingCenterScreenProps> = ({
  currentUser,
  events,
  schedule,
  attendance,
  swapRequests,
  announcements,
  notifications,
  onConfirm,
  onOpenTab,
}) => {
  const pendingItems = useMemo<PendingItem[]>(() => {
    const now = Date.now();
    const items: PendingItem[] = [];

    events.forEach((event) => {
      const eventTimestamp = new Date(event.iso).getTime();
      if (!Number.isNaN(eventTimestamp) && eventTimestamp < now) return;

      Object.entries(schedule)
        .filter(
          ([key, memberName]) =>
            memberName === currentUser.name && key.startsWith(`${event.id}|`),
        )
        .forEach(([key]) => {
          const role = key.split("|").slice(2).join("|") || "Função";
          const hasSwap = swapRequests.some(
            (request) =>
              request.status === "pending" &&
              request.requesterName === currentUser.name &&
              request.role === role &&
              request.eventIso.split("|")[0] === event.iso,
          );
          if (attendance[key] || hasSwap) return;

          items.push({
            id: `confirmation-${key}`,
            kind: "confirmation",
            title: "Confirme sua presença",
            description: `${event.title} • ${role}`,
            meta: getDateLabel(event.iso),
            tone: "primary",
            actionLabel: "Confirmar presença",
            actionTab: "my-schedule",
            assignmentKey: key,
          });
        });
    });

    swapRequests
      .filter((request) => {
        if (request.status !== "pending") return false;
        if (request.requesterName === currentUser.name) return false;
        if (currentUser.access_role === "admin") return true;
        const functions = currentUser.ministry_functions || [];
        return functions.length === 0 || functions.includes(request.role);
      })
      .forEach((request) => {
        const eventIso = request.eventIso.split("|")[0];
        const eventTimestamp = new Date(eventIso).getTime();
        if (!Number.isNaN(eventTimestamp) && eventTimestamp < now) return;

        items.push({
          id: `swap-${request.id}`,
          kind: "swap",
          title: "Há uma troca compatível",
          description: `${request.eventTitle} • ${request.role}`,
          meta: `${getDateLabel(eventIso)} • ${request.requesterName}`,
          tone: "warning",
          actionLabel: "Ver trocas",
          actionTab: "swaps",
        });
      });

    announcements
      .filter(
        (announcement) =>
          !announcement.readBy?.some((reader) => reader.userId === currentUser.id),
      )
      .slice(0, 6)
      .forEach((announcement) => {
        items.push({
          id: `announcement-${announcement.id}`,
          kind: "announcement",
          title: announcement.title,
          description: announcement.message,
          meta: "Aviso não lido",
          tone: "neutral",
          actionLabel: "Abrir avisos",
          actionTab: "announcements",
        });
      });

    notifications
      .filter((notification) => !notification.read)
      .slice(0, 6)
      .forEach((notification) => {
        items.push({
          id: `notification-${notification.id}`,
          kind: "notification",
          title: notification.title,
          description: notification.message,
          meta: notification.ministryName || "Notificação não lida",
          tone: notification.type === "alert" || notification.type === "warning" ? "warning" : "neutral",
          actionLabel: "Abrir contexto",
          actionTab: getActionTab(notification.actionLink),
        });
      });

    return items.slice(0, 20);
  }, [announcements, attendance, currentUser, events, notifications, schedule, swapRequests]);

  const confirmationCount = pendingItems.filter((item) => item.kind === "confirmation").length;
  const totalCount = pendingItems.length;

  return (
    <section
      aria-labelledby="pending-center-title"
      className="mx-auto max-w-5xl space-y-6 animate-fade-in"
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              Próximas ações
            </p>
            <h1
              id="pending-center-title"
              className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white md:text-3xl"
            >
              <ShieldAlert className="shrink-0 text-secondary" aria-hidden="true" />
              Central de pendências
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              Tudo que precisa da sua atenção, organizado por urgência e com o próximo passo visível.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-black text-secondary dark:bg-secondary/20 dark:text-white">
            <AlertCircle size={14} aria-hidden="true" />
            {totalCount} {totalCount === 1 ? "pendência" : "pendências"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Atenção agora</p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{totalCount}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">itens para resolver</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Presença</p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{confirmationCount}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">confirmações abertas</p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-secondary/20 bg-secondary/5 p-4 shadow-sm dark:bg-secondary/10 md:col-span-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-secondary dark:text-white">Minha escala</p>
            <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-white">Veja seus compromissos</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Abrir minha escala"
            onClick={() => onOpenTab("my-schedule")}
          >
            Abrir <ChevronRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Fila de ação
          </h2>
          <span className="text-xs font-bold text-zinc-400">Até 20 itens recentes</span>
        </div>

        {pendingItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={42} aria-hidden="true" />
            <p className="font-bold text-zinc-700 dark:text-zinc-200">Tudo em dia por aqui.</p>
            <p className="mt-1 text-sm text-zinc-400">Novas ações aparecerão automaticamente nesta central.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      item.tone === "warning"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : item.tone === "primary"
                          ? "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-white"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    {iconForKind(item.kind)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="font-black text-zinc-900 dark:text-white">{item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {item.description}
                        </p>
                      </div>
                      <span className="inline-flex w-fit shrink-0 items-center gap-1 text-xs font-bold text-zinc-400">
                        <Clock3 size={13} aria-hidden="true" /> {item.meta}
                      </span>
                    </div>
                    <div className="mt-4">
                      {item.assignmentKey ? (
                        <Button size="sm" onClick={() => onConfirm(item.assignmentKey!)}>
                          {item.actionLabel}
                        </Button>
                      ) : (
                        <Button
                          variant={item.kind === "swap" ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => onOpenTab(item.actionTab)}
                        >
                          {item.actionLabel} <ChevronRight size={15} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

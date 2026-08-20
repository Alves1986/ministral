import React, { useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import { Button } from "./ui";
import {
  AttendanceMap,
  CustomEvent,
  ScheduleMap,
  SwapRequest,
  User,
} from "../types";

type VisibleEvent = CustomEvent & { dateDisplay?: string };

interface MyScheduleScreenProps {
  currentUser: User;
  events: VisibleEvent[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  swapRequests: SwapRequest[];
  onConfirm: (assignmentKey: string) => void;
  onOpenTab: (tab: string) => void;
}

interface PersonalAssignment {
  key: string;
  event: VisibleEvent;
  role: string;
  confirmed: boolean;
  hasPendingSwap: boolean;
}

const getEventDate = (event: VisibleEvent) => {
  const parsed = new Date(event.iso);
  return Number.isNaN(parsed.getTime()) ? event.date : parsed;
};

const formatDate = (event: VisibleEvent) => {
  const parsed = getEventDate(event);
  if (parsed instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(parsed);
  }
  return event.dateDisplay || event.date;
};

const formatTime = (event: VisibleEvent) => {
  if (event.time) return event.time.slice(0, 5);
  const time = event.iso.split("T")[1];
  return time?.slice(0, 5) || "—";
};

export const MyScheduleScreen: React.FC<MyScheduleScreenProps> = ({
  currentUser,
  events,
  schedule,
  attendance,
  swapRequests,
  onConfirm,
  onOpenTab,
}) => {
  const assignments = useMemo<PersonalAssignment[]>(() => {
    const now = Date.now();

    return events
      .filter((event) => {
        const timestamp = new Date(event.iso).getTime();
        return Number.isNaN(timestamp) || timestamp >= now;
      })
      .flatMap((event) =>
        Object.entries(schedule)
          .filter(
            ([key, memberName]) =>
              memberName === currentUser.name && key.startsWith(`${event.id}|`),
          )
          .map(([key]) => {
            const role = key.split("|").slice(2).join("|") || "Função";
            const hasPendingSwap = swapRequests.some(
              (request) =>
                request.status === "pending" &&
                request.requesterName === currentUser.name &&
                request.role === role &&
                request.eventIso.split("|")[0] === event.iso,
            );

            return {
              key,
              event,
              role,
              confirmed: Boolean(attendance[key]),
              hasPendingSwap,
            };
          }),
      )
      .sort(
        (left, right) =>
          new Date(left.event.iso).getTime() - new Date(right.event.iso).getTime(),
      );
  }, [attendance, currentUser.name, events, schedule, swapRequests]);

  const pendingConfirmations = assignments.filter(
    (assignment) => !assignment.confirmed && !assignment.hasPendingSwap,
  ).length;
  const nextAssignment = assignments[0];

  return (
    <section
      aria-labelledby="my-schedule-title"
      className="mx-auto max-w-5xl space-y-6 animate-fade-in"
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              Área pessoal
            </p>
            <h1
              id="my-schedule-title"
              className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white md:text-3xl"
            >
              <CalendarDays className="shrink-0 text-secondary" aria-hidden="true" />
              Minha escala
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              Veja seus próximos compromissos e resolva cada ação sem precisar procurar em uma tabela.
            </p>
          </div>
          <span className="hidden rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-black text-secondary dark:bg-secondary/20 dark:text-white sm:inline-flex">
            {assignments.length} {assignments.length === 1 ? "escala" : "escalas"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Próximo</p>
          <p className="mt-2 truncate text-lg font-black text-zinc-900 dark:text-white">
            {nextAssignment ? formatDate(nextAssignment.event) : "Nenhum"}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {nextAssignment ? nextAssignment.event.title : "Tudo em dia"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Confirmações</p>
          <p className="mt-2 text-lg font-black text-zinc-900 dark:text-white">
            {pendingConfirmations}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            aguardando sua resposta
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-secondary/20 bg-secondary/5 p-4 shadow-sm dark:bg-secondary/10 md:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wide text-secondary dark:text-white">
            Atalho
          </p>
          <p className="mt-2 text-sm font-bold text-zinc-800 dark:text-white">
            Precisa trocar uma função?
          </p>
          <Button
            variant="link"
            size="sm"
            className="mt-2 !px-0"
            onClick={() => onOpenTab("swaps")}
          >
            Abrir trocas <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Próximos compromissos
          </h2>
          <span className="text-xs font-bold text-zinc-400">Toque para resolver</span>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <CalendarDays className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" size={42} aria-hidden="true" />
            <p className="font-bold text-zinc-600 dark:text-zinc-300">
              Você ainda não possui escalas futuras neste período.
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Quando uma função for atribuída a você, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <article
                key={assignment.key}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-white">
                    {assignment.confirmed ? (
                      <CheckCircle2 size={22} aria-hidden="true" />
                    ) : (
                      <Clock3 size={22} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-zinc-900 dark:text-white">
                          {assignment.event.title}
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                          <span>{formatDate(assignment.event)}</span>
                          <span aria-hidden="true">•</span>
                          <span>{formatTime(assignment.event)}</span>
                          <span aria-hidden="true">•</span>
                          <span>{assignment.role}</span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                          assignment.confirmed
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : assignment.hasPendingSwap
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        {assignment.confirmed ? (
                          <CheckCircle2 size={13} aria-hidden="true" />
                        ) : assignment.hasPendingSwap ? (
                          <RefreshCcw size={13} aria-hidden="true" />
                        ) : (
                          <Circle size={13} aria-hidden="true" />
                        )}
                        {assignment.confirmed
                          ? "Confirmada"
                          : assignment.hasPendingSwap
                            ? "Troca solicitada"
                            : "Pendente"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      {!assignment.confirmed && !assignment.hasPendingSwap && (
                        <Button
                          size="sm"
                          onClick={() => onConfirm(assignment.key)}
                        >
                          Confirmar presença
                        </Button>
                      )}
                      {!assignment.hasPendingSwap && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpenTab("swaps")}
                        >
                          Solicitar troca
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

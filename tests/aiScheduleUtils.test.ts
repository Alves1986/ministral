// @ts-nocheck — lógica pura; runtime não checado pelo tsc.
import { describe, it, expect } from "vitest";
import {
  buildSchedulePrompt,
  extractAssignments,
  validateAssignment,
  ScheduleInput,
} from "../services/aiScheduleUtils";

const baseInput: ScheduleInput = {
  occurrences: [
    { date: "2026-06-07", time: "19:00:00", ruleId: "r1", title: "Culto" },
  ],
  roles: ["Vocal", "Som"],
  members: [
    { id: "u1", name: "Ana", functions: ["Vocal"] },
    { id: "u2", name: "Bruno", functions: ["Som"] },
  ],
  availability: { u1: ["2026-06-07"], u2: ["2026-06-07"] },
  existingAssignments: [],
  rules: { blockGroups: [["Vocal", "Som"]], allowExceptions: [] },
};

describe("buildSchedulePrompt", () => {
  it("inclui membros, funções, disponibilidade e regras", () => {
    const prompt = buildSchedulePrompt(baseInput);
    expect(prompt).toContain("Ana");
    expect(prompt).toContain("u1");
    expect(prompt).toContain("Vocal");
    expect(prompt).toContain("2026-06-07");
    expect(prompt).toContain("Grupo de bloqueio");
  });

  it("trata disponibilidade como objeto de datas", () => {
    const input = {
      ...baseInput,
      availability: {
        u1: { "2026-06-07": "available" },
        u2: { "2026-06-07": "available" },
      },
    };
    const prompt = buildSchedulePrompt(input);
    expect(prompt).toContain("2026-06-07");
  });
});

describe("extractAssignments", () => {
  it("parseia JSON puro de array", () => {
    const text = JSON.stringify([
      { event_rule_id: "r1", event_date: "2026-06-07", role: "Vocal", member_id: "u1" },
    ]);
    const out = extractAssignments(text);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ event_rule_id: "r1", role: "Vocal", member_id: "u1" });
  });

  it("remove markdown code fences", () => {
    const text = "```json\n" + JSON.stringify([{ event_rule_id: "r1", event_date: "2026-06-07", role: "Som", member_id: "u2" }]) + "\n```";
    expect(extractAssignments(text)).toHaveLength(1);
  });

  it("filtra itens inválidos (sem member_id/role)", () => {
    const text = JSON.stringify([
      { event_rule_id: "r1", event_date: "2026-06-07", role: "Vocal", member_id: "u1" },
      { event_rule_id: "r1", event_date: "2026-06-07" }, // inválido
      "lixo",
    ]);
    expect(extractAssignments(text)).toHaveLength(1);
  });

  it("aceita wrapper { assignments: [...] }", () => {
    const text = JSON.stringify({ assignments: [{ event_rule_id: "r1", event_date: "2026-06-07", role: "Som", member_id: "u2" }] });
    expect(extractAssignments(text)).toHaveLength(1);
  });

  it("retorna [] para texto sem array", () => {
    expect(extractAssignments("Nenhuma vaga")).toEqual([]);
  });
});

describe("validateAssignment com slots múltiplos (Dança / Vocal)", () => {
  const danceScheduleInput: ScheduleInput = {
    occurrences: [
      { date: "2026-06-07", time: "19:00:00", ruleId: "r1", title: "Culto" },
    ],
    roles: ["Dança 1", "Dança 2", "Dança 3", "Dança 4"],
    members: [
      { id: "d1", name: "Mariana", functions: ["Dança"] },
      { id: "d2", name: "Camila", functions: ["Dança"] },
    ],
    availability: { d1: [], d2: [] },
    existingAssignments: [],
  };

  it("aceita membro com função Dança na vaga Dança 1 e Dança 2", () => {
    const err1 = validateAssignment(
      { event_rule_id: "r1", event_date: "2026-06-07", role: "Dança 1", member_id: "d1" },
      danceScheduleInput
    );
    expect(err1).toBeNull();

    const err2 = validateAssignment(
      { event_rule_id: "r1", event_date: "2026-06-07", role: "Dança 2", member_id: "d2" },
      danceScheduleInput
    );
    expect(err2).toBeNull();
  });
});
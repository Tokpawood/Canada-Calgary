import { describe, expect, it } from "vitest";
import { canReportTo, orgChart, type ContactPerson } from "./network";

const BASE = {
  dossierId: "d1",
  relation: "",
  whatsapp: "",
  website: "",
  address: "",
  city: "",
  country: "",
  birthDate: null,
  nationality: "",
  idType: "",
  idNumber: "",
  photoPath: null,
  photoUrl: null,
};
const P = (id: string, parentId: string | null, position = 0, contactId = "c1"): ContactPerson => ({
  ...BASE,
  id,
  contactId,
  parentId,
  name: id.toUpperCase(),
  title: "",
  email: "",
  phone: "",
  notes: "",
  position,
});

describe("organigramme d'un organisme", () => {
  it("range chaque personne sous son responsable, dans l'ordre de lecture", () => {
    const chart = orgChart([P("b", "a", 1), P("a", null), P("c", "a", 0), P("d", "c"), P("e", null, 5)]);
    expect(chart.map((n) => [n.person.id, n.depth])).toEqual([
      ["a", 0],
      ["c", 1],
      ["d", 2],
      ["b", 1],
      ["e", 0],
    ]);
    expect(chart.find((n) => n.person.id === "a")?.reports).toBe(3);
  });

  it("ne perd personne en cas de responsable inconnu ou de boucle", () => {
    expect(orgChart([P("x", "inconnu")]).map((n) => n.depth)).toEqual([0]);
    expect(orgChart([P("x", "y"), P("y", "x")]).length).toBe(2);
  });
});

describe("changement de responsable", () => {
  const people = [P("a", null), P("b", "a"), P("c", "b"), P("z", null, 0, "c2")];
  it("interdit de passer sous soi-même, un subordonné ou un autre organisme", () => {
    expect(canReportTo(people, "a", "a")).toBe(false);
    expect(canReportTo(people, "a", "c")).toBe(false);
    expect(canReportTo(people, "c", "a")).toBe(true);
    expect(canReportTo(people, "b", null)).toBe(true);
    expect(canReportTo(people, "a", "z")).toBe(false);
  });
});

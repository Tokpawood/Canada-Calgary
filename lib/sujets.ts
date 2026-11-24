/**
 * Sujets d'entraînement au format du TCF Canada : celui de chaque tâche du jour et la banque de l'onglet Sujets,
 * avec consigne et méthodologie. Sujets originaux (lib/sujetsData.ts), aucun appel à Claude.
 */
import { TCF, dayPlan, weekOf, weekday, type DayItem } from "./formation";
import { EO1_QUESTIONS, SUJETS, type SujetT3 } from "./sujetsData";
import { SUITE } from "./sujetsSuite";

export type Exercice =
  | { kind: "ee1" | "ee2" | "eo2" | "eo3"; titre: string; temps: string; consigne: string }
  | { kind: "ee3"; titre: string; temps: string; sujet: SujetT3 }
  | { kind: "eo1"; titre: string; temps: string; questions: string[] }
  | { kind: "gram"; titre: string; temps: string; items: Array<[string, string]> };

export const KINDS: Array<{ kind: Exercice["kind"]; label: string }> = [
  { kind: "ee1", label: "Écrit · tâche 1" },
  { kind: "ee2", label: "Écrit · tâche 2" },
  { kind: "ee3", label: "Écrit · tâche 3" },
  { kind: "eo1", label: "Oral · tâche 1" },
  { kind: "eo2", label: "Oral · tâche 2" },
  { kind: "eo3", label: "Oral · tâche 3" },
  { kind: "gram", label: "Grammaire" },
];

/** Consignes au format du TCF Canada. */
export const CONSIGNES: Record<Exercice["kind"], string[]> = {
  ee1: ["Rédigez un message de 60 à 120 mots, adapté au destinataire.", "Décrivez, racontez ou expliquez : répondez à tous les points demandés.", "Temps conseillé : 12 minutes sur les 60 de l'épreuve."],
  ee2: ["Rédigez un article, un courrier ou une note de 120 à 150 mots pour plusieurs destinataires.", "Faites le compte rendu d'une expérience ou racontez, avec des commentaires, des opinions ou des arguments.", "Temps conseillé : 18 minutes."],
  ee3: [
    "Lisez les deux documents : ils présentent deux points de vue opposés.",
    "Partie 1 (40 à 60 mots) : comparez les deux points de vue avec vos propres mots, sans donner votre avis.",
    "Partie 2 (80 à 120 mots) : donnez votre position sur le thème, avec des arguments et des exemples.",
    "Texte de 120 à 180 mots au total. Temps conseillé : 27 minutes.",
  ],
  eo1: ["Entretien dirigé, sans préparation : environ 2 minutes.", "Échangez avec l'examinateur, que vous ne connaissez pas : parlez de vous, de votre entourage, de votre vie."],
  eo2: ["2 minutes de préparation, puis 3 min 30 d'échange.", "C'est vous qui menez la conversation : posez des questions pour obtenir les informations, dans la situation indiquée.", "Choisissez « tu » ou « vous » selon le rôle de l'examinateur."],
  eo3: ["Expression d'un point de vue, sans préparation : 4 min 30.", "Répondez à la question posée : prenez position, argumentez, donnez des exemples."],
  gram: ["Répondez par écrit avant de dévoiler chaque réponse.", "Réécrivez la phrase entière, puis notez l'erreur dans le carnet si vous vous êtes trompé."],
};

export const METHODES: Record<Exercice["kind"], { etapes: string[]; modele?: string }> = {
  ee1: {
    etapes: [
      "1 min : repérez le destinataire (tu ou vous), le but, et soulignez chaque information demandée.",
      "2 min : notez un mot par information, dans l'ordre de l'énoncé.",
      "7 min : une salutation, une phrase pour dire pourquoi vous écrivez, une phrase par information, une formule finale.",
      "2 min : relisez « a / à », les accords et les pluriels, puis comptez les mots.",
    ],
    modele: "Bonjour [prénom],\nJe t'écris pour [raison]. [Une phrase par information demandée.] Pourrais-tu me répondre avant [date] ?\nBien à toi, [prénom]",
  },
  ee2: {
    etapes: [
      "2 min : choisissez une expérience précise ; notez quand, où, qui, le moment fort, le bilan.",
      "12 min : contexte, récit au passé composé et à l'imparfait, moment fort détaillé, votre ressenti, un conseil au lecteur.",
      "2 min : ajoutez deux connecteurs de temps et une opinion justifiée.",
      "2 min : relisez les temps du passé et les accords des participes, puis comptez les mots.",
    ],
    modele: "[Date ou période], j'ai vécu [événement]. Ce qui m'a le plus marqué, c'est [moment fort]. Depuis, [ce que j'en retiens]. Je recommande [conseil] à tous ceux qui [public].",
  },
  ee3: {
    etapes: [
      "0 à 4 min : lisez les documents et soulignez deux idées dans chacun.",
      "4 à 6 min : trouvez vos idées avec SAPEST (Santé, Argent, Personnes, Environnement, Sécurité et règles, Temps) ; gardez un pour, un contre et un exemple vécu.",
      "6 à 10 min : partie 1, environ 50 mots, sans recopier ni donner votre avis.",
      "10 à 21 min : partie 2, environ 110 mots : position, deux arguments avec exemples, une concession, une conclusion.",
      "21 à 24 min : trois relectures : « a / à », accords des adjectifs, pluriels après les, des, ces.",
      "24 à 27 min : comptez les mots et coupez au-delà de 180.",
    ],
    modele:
      "Partie 1 : Ces deux documents abordent [thème] sous des angles opposés. D'un côté, le premier estime que [idées]. De l'autre, le second souligne [idées].\nPartie 2 : À l'heure où [contexte], la question de [thème] divise. Pour ma part, je suis convaincu que [position]. D'une part, [argument et exemple]. Certes, [concession], mais [dépassement]. En définitive, [conclusion].",
  },
  eo1: {
    etapes: [
      "Répondez par trois ou quatre phrases : un fait, un détail, une raison, un exemple.",
      "Variez les temps : ce que vous faisiez, ce que vous faites, ce que vous ferez.",
      "Ne récitez pas : regardez l'examinateur et enchaînez naturellement.",
      "Enregistrez-vous 2 minutes, réécoutez, notez trois erreurs.",
    ],
    modele: "Je travaille dans [domaine] depuis [durée]. Ce qui me plaît avant tout, c'est [raison]. Par exemple, [situation]. À l'avenir, j'aimerais [projet].",
  },
  eo2: {
    etapes: [
      "Préparation (2 min) : notez six thèmes de questions (prix, date, lieu, conditions, avantages, imprévus), en mots-clés.",
      "Ouverture : saluez, dites qui vous êtes et ce que vous cherchez.",
      "Posez dix à douze questions en variant les formes : inversion, « est-ce que », « pourriez-vous me dire si… », question indirecte.",
      "Réagissez à chaque réponse : étonnement, accord, demande de précision, négociation.",
      "Concluez : résumez, prenez une décision ou un rendez-vous, remerciez.",
    ],
    modele: "Bonjour, je vous contacte au sujet de [situation]. J'aurais quelques questions à vous poser.\nPourriez-vous m'indiquer… ? J'aimerais savoir si… Et dans le cas où… ? Très bien, si je résume…",
  },
  eo3: {
    etapes: [
      "Prenez cinq secondes : choisissez une position et deux arguments.",
      "Introduction (30 s) : reformulez la question, annoncez votre position.",
      "Développement (3 min) : argument, explication, exemple concret ; puis un second.",
      "Concession (30 s) : reconnaissez l'autre avis, puis dépassez-le.",
      "Conclusion (30 s) : reprenez votre position et ouvrez.",
      "Enregistrez-vous, transcrivez une minute, corrigez-la.",
    ],
    modele: "La question de [thème] suscite un vif débat. Pour ma part, j'estime que… Tout d'abord… En effet… Prenons l'exemple de… Certes… il n'en demeure pas moins que… En somme…",
  },
  gram: { etapes: ["Relisez la règle de la semaine.", "Faites les phrases d'un trait, sans aide.", "Vérifiez, puis écrivez trois phrases personnelles avec la même structure."] },
};

const ee1 = (c: string): Exercice => ({ kind: "ee1", titre: "Expression écrite · tâche 1", consigne: c, temps: "60 à 120 mots · 12 min" });
const ee2 = (c: string): Exercice => ({ kind: "ee2", titre: "Expression écrite · tâche 2", consigne: c, temps: "120 à 150 mots · 18 min" });
const ee3 = (s: SujetT3): Exercice => ({ kind: "ee3", titre: "Expression écrite · tâche 3", sujet: s, temps: "120 à 180 mots · 27 min" });
const eo2 = (c: string): Exercice => ({ kind: "eo2", titre: "Expression orale · tâche 2", consigne: c, temps: "2 min de préparation, 3 min 30 d'échange" });
const eo3 = (c: string): Exercice => ({ kind: "eo3", titre: "Expression orale · tâche 3", consigne: `${c} Pourquoi ?`, temps: "4 min 30, sans préparation" });
const EO1: Exercice = { kind: "eo1", titre: "Expression orale · tâche 1", temps: "2 min, sans préparation", questions: EO1_QUESTIONS };
const gram = (items: Array<[string, string]>): Exercice => ({ kind: "gram", titre: "Grammaire de la semaine", temps: `${items.length} phrases`, items });

function ofWeek(n: number, kind: Exercice["kind"]): Exercice[] {
  const s = SUJETS[n];
  switch (kind) {
    case "ee1":
      return [ee1(s.t1)];
    case "ee2":
      return [ee2(s.t2)];
    case "ee3":
      return s.t3.map((x, i) => ee3({ titre: x.titre, a: `${x.a} ${SUITE[n][2 * i]}`, b: `${x.b} ${SUITE[n][2 * i + 1]}` }));
    case "eo1":
      return [EO1];
    case "eo2":
      return [eo2(s.eo2)];
    case "eo3":
      return s.eo3.map(eo3);
    default:
      return [gram(s.gram)];
  }
}

/** Position du jour parmi lundi, mercredi et vendredi. */
const triple = (d: number) => (d === 3 ? 1 : d === 5 ? 2 : 0);

/**
 * Exercice à faire pour une tâche du jour : un seul sujet par tâche de l'épreuve. Vide si la tâche n'en demande pas,
 * ou si le test TCF Canada du jour fournit déjà le sujet.
 */
export function exercicesFor(date: string, item: Pick<DayItem, "topic" | "lang" | "tool">): Exercice[] {
  const week = weekOf(date);
  if (item.lang !== "tcf" || item.tool === "tcf" || week?.prog !== "tcf" || !SUJETS[week.n]) return [];
  const i = triple(weekday(date));
  const one = (k: Exercice["kind"], at = 0) => [ofWeek(week.n, k)[at]];
  switch (item.topic) {
    case "tcf-ee12":
      return [...one("ee1"), ...one("ee2")];
    case "tcf-ee3":
      return one("ee3", i);
    case "tcf-eo1":
      return one("eo1");
    case "tcf-eo2":
      return one("eo2");
    case "tcf-eo3":
      return one("eo3", i);
    case "tcf-grammaire":
      return one("gram");
    default:
      return [];
  }
}

/** Banque complète d'un type de sujet, par thème. */
export function sujetsOf(kind: Exercice["kind"]): Array<{ n: number; theme: string; items: Exercice[] }> {
  if (kind === "eo1") return [{ n: 0, theme: "Tous les thèmes", items: [EO1] }];
  return TCF.weeks.filter((w) => SUJETS[w.n]).map((w) => ({ n: w.n, theme: kind === "gram" ? (w.grammar ?? w.theme) : w.theme, items: ofWeek(w.n, kind) }));
}

/** Intitulé court d'un exercice, pour la ligne affichée sous la tâche du jour. */
export function intitule(e: Exercice): string {
  switch (e.kind) {
    case "ee3":
      return e.sujet.titre;
    case "eo1":
      return `${e.questions.length} questions d'entretien`;
    case "gram":
      return `${e.items.length} phrases à transformer`;
    default:
      return e.consigne;
  }
}

/** Jours dont une tâche d'expression ou de grammaire n'a ni sujet ni test de l'application (contrôle). */
export function joursSansExercice(days: string[]): string[] {
  return days.filter((d) => dayPlan(d)?.items.some((it) => /^tcf-(ee|eo|grammaire)/.test(it.topic) && it.tool !== "tcf" && !exercicesFor(d, it).length));
}

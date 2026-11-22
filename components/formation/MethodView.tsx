import type { ReactNode } from "react";
import { IconExternal } from "@/components/icons";
import { TCF_GOAL } from "@/lib/formation";
import { LangTag } from "./shared";

function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-[16px] font-bold">
        {title} {aside}
      </h3>
      <div className="mt-3 text-[13.5px] leading-relaxed">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11.5px] text-muted">
            {head.map((h) => (
              <th key={h} className="px-1 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-line align-top last:border-0">
              {r.map((c, i) => (
                <td key={i} className={`px-1 py-2 ${i === 0 ? "font-semibold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RES_TCF: Array<[string, string, string | null, string]> = [
  ["Exemples d'épreuves du TCF (France Éducation international)", "Diagnostic, format officiel · semaine 1", "https://www.france-education-international.fr/test/exemples-epreuves-tcf", "Gratuit"],
  ["Page TCF Canada et manuel du candidat", "Règles et déroulé des épreuves · semaine 1", "https://www.france-education-international.fr/test/tcf-canada", "Gratuit"],
  ["TV5Monde · Apprendre le français", "CO et CE, niveaux B2 et C1 · trajets, phase 1", "https://apprendre.tv5monde.com", "Gratuit"],
  ["RFI · Le français facile", "Compréhension orale de type TCF · trajets, phase 1", "https://francaisfacile.rfi.fr", "Gratuit"],
  ["Pack Gold formation-tcfcanada.com", "44 séries de CE, 43 de CO, examens blancs · du 14/12 au 14/02", "https://formation-tcfcanada.com", "49,99 $ US"],
  ["Grammaire progressive du français, perfectionnement (CLE International)", "Grammaire C1-C2 de la semaine · dimanche", null, "Livre"],
  ["Manuel de préparation au TCF (CLE International ou PUG)", "Sujets et grilles d'expression · phase 2", null, "Livre"],
  ["Institut français", "Examen blanc en conditions réelles · semaine 12", null, "À vérifier sur place"],
  ["Anki ou AnkiWeb", "Vocabulaire par thème, 20 mots par jour · trajet aller", "https://ankiweb.net", "Gratuit (Android, web)"],
];

const LISTEN_FR: Array<[string, string, string]> = [
  ["RFI · Journal en français facile", "B2", "Semaines 1 à 3"],
  ["RFI · « Appels sur l'actualité » et « Débat africain »", "C1", "Trajets"],
  ["France Culture (débats et idées)", "C2", "Trajets, dès la semaine 3"],
  ["France Inter (chroniques et débats)", "C1-C2", "Trajets"],
  ["Radio-Canada OHdio", "C1-C2", "Trajets, 2 fois par semaine"],
  ["The Conversation France", "C1-C2", "Pause déjeuner"],
  ["Éditoriaux du Monde, Courrier international", "C2", "Dimanche"],
];

const RES_IELTS: Array<[string, string, string | null, string]> = [
  ["IELTS.org · sujets d'entraînement officiels", "Format et exemples du General Training · semaine 1", "https://ielts.org", "Gratuit"],
  ["British Council · IELTS Ready", "Tests d'entraînement en ligne · toutes les semaines", "https://takeielts.britishcouncil.org", "Gratuit (base)"],
  ["Cambridge IELTS General Training", "Examens blancs complets · samedis", null, "Livre"],
  ["IELTS Liz", "Méthode par épreuve, lettres et essais · semaines 1 à 4", "https://ieltsliz.com", "Gratuit"],
  ["Anki ou AnkiWeb", "Vocabulaire et collocations · trajets", "https://ankiweb.net", "Gratuit (Android, web)"],
];

const LISTEN_EN: Array<[string, string, string]> = [
  ["BBC Learning English · 6 Minute English", "B2", "Du 16/11 au 15/02"],
  ["BBC Global News Podcast", "C1", "Trajets"],
  ["TED Talks (avec transcription)", "C1", "Trajets"],
  ["BBC Radio 4 · podcasts de débat", "C1-C2", "Semaines 3 à 6"],
];

function Resources({ items }: { items: Array<[string, string, string | null, string]> }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map(([name, use, url, cost]) => (
        <li key={name} className="flex items-start gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
                {name} <IconExternal size={13} className="text-muted" />
              </a>
            ) : (
              <p className="font-semibold">{name}</p>
            )}
            <p className="text-[12.5px] text-muted">{use}</p>
          </div>
          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-muted">{cost}</span>
        </li>
      ))}
    </ul>
  );
}

function Listen({ items }: { items: Array<[string, string, string]> }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map(([n, lvl, when]) => (
        <li key={n} className="flex items-baseline gap-2 text-[13px]">
          <span className="mono w-12 shrink-0 text-[11.5px] font-semibold text-muted">{lvl}</span>
          <span className="flex-1">{n}</span>
          <span className="shrink-0 text-[12px] text-muted">{when}</span>
        </li>
      ))}
    </ul>
  );
}

/** Méthode et ressources du programme (contenu de référence, sans suivi). */
export function MethodView() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="card p-5 sm:p-6 xl:col-span-2">
        <h3 className="flex items-center gap-2 text-[16px] font-bold">
          Un seul objectif pour toute la formation <LangTag lang="tcf" />
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed">
          <strong>TCF Canada le 15/02/2027 : NCLC 10</strong>, soit {TCF_GOAL.exam.comprehension}/699 en compréhension orale et écrite et {TCF_GOAL.exam.expression}/20 en expression écrite et orale.
          À l&apos;entraînement, on vise <strong>{TCF_GOAL.training.label}</strong> ({TCF_GOAL.training.comprehension}/699, {TCF_GOAL.training.expression}/20 et plus ; 18/20 en fin de programme) pour garder une marge le jour de l&apos;examen.
        </p>
        <Table
          head={["Outil", "Son rôle vers l'objectif"]}
          rows={[
            ["Jour et Semaines", "Le cours : un thème, une grammaire et une épreuve à renforcer chaque semaine ; chaque créneau dit quoi faire et où."],
            ["Test TCF Canada", "Mesure en conditions réelles l'épreuve du jour (lundi CO, mardi CE, mercredi EE, jeudi EO, vendredi mixte, samedi examen blanc ou entraînement, dimanche point faible), sur le thème et la grammaire de la semaine."],
            ["Carnet d'erreurs", "Garde les fautes relevées par les corrections des tests et des copies ; elles reviennent dans les tests et les exercices jusqu'à être maîtrisées."],
            ["Aide-mémoire", "Les leçons de synthèse à remobiliser dans les productions écrites et orales."],
            ["Exercices du jour", "10 exercices le soir : carnet, aide-mémoire, grammaire de la semaine et faiblesses des derniers tests."],
            ["Scores", "Les examens blancs et le positionnement passés dans l'application s'y ajoutent seuls ; ajoutez ceux faits ailleurs."],
          ]}
        />
      </section>
      <Card title="Compréhension orale et écrite" aside={<LangTag lang="tcf" />}>
        <p className="text-muted">39 questions chacune ; 60 min pour la compréhension écrite.</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Lire les réponses proposées avant d&apos;écouter ou de lire le document.</li>
          <li>Chercher la reformulation : la bonne réponse reprend rarement les mots exacts.</li>
          <li>Gérer le temps pour atteindre les dernières questions, les plus difficiles et les mieux notées.</li>
          <li>Identifier l&apos;intention de l&apos;auteur (informer, critiquer, nuancer).</li>
        </ul>
      </Card>

      <Card title="Expression écrite · 3 tâches, 60 min" aside={<LangTag lang="tcf" />}>
        <Table
          head={["Tâche", "Format", "Longueur", "Attendu"]}
          rows={[
            ["1", "Message (invitation, demande, réponse)", "60 à 120 mots", "Registre juste, consignes traitées, zéro faute"],
            ["2", "Article, blog ou récit d'expérience", "120 à 150 mots", "Récit vivant, temps du passé variés, opinion"],
            ["3", "Texte argumentatif à partir de deux documents", "120 à 180 mots", "Synthèse, position nuancée, connecteurs variés"],
          ]}
        />
        <p className="mt-3 font-semibold">Plan type de la tâche 3</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>Introduction : reformuler le débat en une phrase.</li>
          <li>Paragraphe 1 : position du document 1, puis du document 2.</li>
          <li>Paragraphe 2 : votre avis, avec une concession (« certes…, il n&apos;en demeure pas moins que… »).</li>
          <li>Conclusion : une phrase d&apos;ouverture.</li>
        </ol>
      </Card>

      <Card title="Expression orale · 3 tâches, 12 min" aside={<LangTag lang="tcf" />}>
        <Table
          head={["Tâche", "Format", "À préparer"]}
          rows={[
            ["1", "Entretien dirigé (≈ 2 min)", "Présentation fluide : parcours, métier, projet Canada, loisirs"],
            ["2", "Interaction pour obtenir des informations (≈ 5 min)", "15 questions variées et polies (inversion, conditionnel), reformulation"],
            ["3", "Donner son point de vue (≈ 4 min 30)", "Plan en 3 temps, exemples concrets tirés du recrutement et du quotidien"],
          ]}
        />
      </Card>

      <Card title="Phrases à apprendre par cœur" aside={<LangTag lang="tcf" />}>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
          {[
            ["Introduire", "« Il est de plus en plus fréquent que… », « La question de… suscite un vif débat »"],
            ["Ajouter", "« de surcroît », « qui plus est », « à cela s'ajoute que »"],
            ["Opposer", "« en revanche », « à l'inverse », « toutefois »"],
            ["Concéder", "« certes… mais », « bien que » + subjonctif, « il n'en demeure pas moins que »"],
            ["Conclure", "« force est de constater que », « en définitive », « dès lors »"],
            ["Nuancer", "« dans une certaine mesure », « à condition que », « il convient de distinguer »"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">Mots à bannir : chose, beaucoup, faire, il y a, gens, bien.</p>
      </Card>

      <Card title="IELTS General Training · cible CLB 9" aside={<LangTag lang="ielts" />}>
        <Table
          head={["Épreuve", "Format", "Cible", "Technique clé"]}
          rows={[
            ["Listening", "4 parts, 40 questions, 30 min", "8,0 (≈ 35/40)", "Lire les questions avant l'écoute, anticiper le type de réponse, vérifier l'orthographe et les pluriels"],
            ["Reading", "3 sections, 40 questions, 60 min", "7,0 (≈ 34/40)", "Skimming puis scanning ; jamais plus de 90 secondes bloqué sur une question"],
            ["Writing", "Task 1 : lettre de 150 mots (20 min) ; Task 2 : essai de 250 mots (40 min)", "7,0", "Commencer par la Task 2, qui compte double ; dépasser légèrement le minimum de mots"],
            ["Speaking", "3 parts, 11 à 14 min", "7,0", "Ne jamais répondre en une phrase ; Part 2 : qui, quoi, quand, pourquoi, mon avis"],
          ]}
        />
        <p className="mt-3 text-muted">
          Writing et Speaking : réponse à la consigne, cohérence, variété du vocabulaire, précision grammaticale. Pour 7,0 : phrases complexes avec peu d&apos;erreurs,
          vocabulaire moins courant employé correctement.
        </p>
      </Card>

      <Card title="Task 2 et lettres de la Task 1" aside={<LangTag lang="ielts" />}>
        <p className="font-semibold">Plan type de la Task 2</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>Introduction : reformuler le sujet et annoncer votre position.</li>
          <li>Deux paragraphes, chacun avec une idée, une explication et un exemple.</li>
          <li>Conclusion : reprendre la position, sans idée nouvelle.</li>
        </ol>
        <p className="mt-3 font-semibold">Les trois registres de lettre</p>
        <Table
          head={["Registre", "Ouverture", "Clôture"]}
          rows={[
            ["Formel (destinataire inconnu)", "« Dear Sir or Madam, »", "« Yours faithfully, »"],
            ["Semi-formel (connu par son nom)", "« Dear Mr Kouassi, »", "« Yours sincerely, »"],
            ["Amical", "« Dear Paul, »", "« Best wishes, » ou « Take care, »"],
          ]}
        />
        <p className="mt-3">
          <span className="font-semibold">Phrases clés : </span>« I am writing to enquire about… », « I would be grateful if you could… », « While some argue that…, others
          believe… », « On balance, I am convinced that… », « This is largely because… », « A case in point is… ».
        </p>
      </Card>

      <Card title="Règles d'entraînement">
        <ul className="list-disc pl-5">
          <li>Toujours écrire en temps réel, chronomètre lancé.</li>
          <li>Pas de dictionnaire ni de correcteur pendant l&apos;écriture, seulement après.</li>
          <li>Recopier chaque erreur corrigée dans le carnet d&apos;erreurs (phrase fautive, phrase corrigée, règle).</li>
          <li>Relire le carnet chaque dimanche ; une erreur qui revient 3 fois devient un exercice ciblé.</li>
          <li>Une semaine chargée ne s&apos;annule pas : envoyer au moins la tâche 3 écrite.</li>
          <li>Écoute : un extrait de 3 minutes écouté 3 fois (sens global, détails, 5 expressions pour Anki).</li>
          <li>Jusqu&apos;au 15/02, l&apos;anglais se limite à 15 minutes d&apos;écoute par jour ; puis 30 minutes de shadowing par semaine.</li>
        </ul>
        <p className="mt-3 font-semibold">Ce qu&apos;on envoie à Claude</p>
        <Table
          head={["Épreuve", "À envoyer", "En retour"]}
          rows={[
            ["Expression écrite", "Sujet, texte tapé sans correcteur, nombre de mots, temps mis", "Note /20 et NCLC, 5 erreurs principales, version C2"],
            ["Expression orale", "Sujet et transcription (ou séance vocale)", "Note /20, erreurs, structure et vocabulaire"],
            ["Compréhension", "Score, questions ratées, type de document", "Pièges récurrents et exercices ciblés"],
            ["IELTS Writing", "Sujet, texte tapé sans correcteur, nombre de mots, temps mis", "Band par critère, erreurs principales, version à 7,5"],
            ["IELTS Speaking", "Question et transcription (ou séance vocale)", "Band estimé, erreurs, expressions à ajouter"],
            ["IELTS Listening et Reading", "Score sur 40 et questions ratées", "Analyse des pièges récurrents"],
          ]}
        />
      </Card>

      <Card title="Ressources français" aside={<LangTag lang="tcf" />}>
        <Resources items={RES_TCF} />
        <p className="mt-3 font-semibold">Écouter et lire chaque jour</p>
        <Listen items={LISTEN_FR} />
      </Card>

      <Card title="Ressources anglais" aside={<LangTag lang="ielts" />}>
        <Resources items={RES_IELTS} />
        <p className="mt-3 font-semibold">Écouter chaque jour</p>
        <Listen items={LISTEN_EN} />
      </Card>
    </div>
  );
}

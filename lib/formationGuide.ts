/**
 * Guide affiché dans le tiroir d'une tâche de la formation : objectif, méthode pas à pas,
 * ressources et ce qu'il faut envoyer à Claude. Contenu tiré des deux programmes (TCF et IELTS).
 */

export interface Resource {
  name: string;
  note?: string;
  url?: string;
}

export interface Guide {
  title: string;
  why: string;
  steps: string[];
  tips?: string[];
  /** Tableau de référence (format d'une épreuve, registres…). */
  table?: { head: string[]; rows: string[][] };
  resources?: Resource[];
  send?: { what: string; receive: string };
}

const R = {
  feiExemples: { name: "Exemples d'épreuves du TCF (France Éducation international)", url: "https://www.france-education-international.fr/test/exemples-epreuves-tcf", note: "Format officiel" },
  feiTcfCanada: { name: "TCF Canada : manuel du candidat", url: "https://www.france-education-international.fr/test/tcf-canada", note: "Règles et déroulé" },
  tv5: { name: "TV5Monde · Apprendre le français", url: "https://apprendre.tv5monde.com", note: "CO et CE, niveaux B2 et C1" },
  rfiFacile: { name: "RFI · Le français facile", url: "https://francaisfacile.rfi.fr", note: "Exercices de CO de type TCF" },
  packGold: { name: "Pack Gold · formation-tcfcanada.com", url: "https://formation-tcfcanada.com", note: "44 séries de CE, 43 de CO, examens blancs (49,99 $ US)" },
  grammaire: { name: "Grammaire progressive du français, perfectionnement (CLE International)", note: "Livre" },
  manuelTcf: { name: "Manuel de préparation au TCF (CLE International ou PUG)", note: "Sujets et grilles d'expression" },
  anki: { name: "Anki ou AnkiWeb", url: "https://ankiweb.net", note: "Gratuit sur Android et sur le web" },
  rfiJournal: { name: "RFI · Journal en français facile", url: "https://francaisfacile.rfi.fr", note: "B2 · semaines 1 à 3" },
  rfiDebat: { name: "RFI · « Appels sur l'actualité », « Débat africain »", url: "https://www.rfi.fr/fr/podcasts", note: "C1 · débats proches de l'EO tâche 3" },
  franceCulture: { name: "France Culture (débats et idées)", url: "https://www.radiofrance.fr/franceculture", note: "C2 · dès la semaine 3" },
  franceInter: { name: "France Inter (chroniques et débats)", url: "https://www.radiofrance.fr/franceinter", note: "C1-C2" },
  ohdio: { name: "Radio-Canada OHdio", url: "https://ici.radio-canada.ca/ohdio", note: "C1-C2 · accent canadien, 2 fois par semaine" },
  conversation: { name: "The Conversation France", url: "https://theconversation.com/fr", note: "C1-C2 · textes argumentatifs" },
  monde: { name: "Éditoriaux du Monde, Courrier international", url: "https://www.courrierinternational.com", note: "C2 · style et nuance" },
  ieltsOrg: { name: "IELTS.org · sujets d'entraînement officiels", url: "https://ielts.org", note: "Format du General Training" },
  ieltsReady: { name: "British Council · IELTS Ready", url: "https://takeielts.britishcouncil.org", note: "Tests en ligne (version de base gratuite)" },
  cambridge: { name: "Cambridge IELTS General Training", note: "Annales officielles (livre) · examens blancs" },
  ieltsLiz: { name: "IELTS Liz", url: "https://ieltsliz.com", note: "Méthode par épreuve, modèles de lettres et d'essais" },
  bbc6: { name: "BBC Learning English · 6 Minute English", url: "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english", note: "B2" },
  bbcNews: { name: "BBC Global News Podcast", url: "https://www.bbc.co.uk/programmes/p02nq0gn/episodes/downloads", note: "C1 · proche du Listening" },
  ted: { name: "TED Talks (avec transcription)", url: "https://www.ted.com/talks", note: "C1 · idées pour la Task 2 et la Part 3" },
  radio4: { name: "BBC Radio 4 · podcasts de débat", url: "https://www.bbc.co.uk/sounds/category/factual", note: "C1-C2" },
  institut: { name: "Institut français", note: "Examen blanc en conditions réelles (à vérifier sur place)" },
} satisfies Record<string, Resource>;

const PHRASES_FR = [
  "Introduire : « Il est de plus en plus fréquent que… », « La question de… suscite un vif débat ».",
  "Ajouter : « de surcroît », « qui plus est », « à cela s'ajoute que ».",
  "Opposer : « en revanche », « à l'inverse », « toutefois ».",
  "Concéder : « certes… mais », « bien que » + subjonctif, « il n'en demeure pas moins que ».",
  "Conclure : « force est de constater que », « en définitive », « dès lors ».",
  "Nuancer : « dans une certaine mesure », « à condition que », « il convient de distinguer ».",
  "Mots à bannir : chose, beaucoup, faire, il y a, gens, bien.",
];

const PHRASES_EN = [
  "« I am writing to enquire about… »",
  "« I would be grateful if you could… »",
  "« While some argue that…, others believe… »",
  "« On balance, I am convinced that… »",
  "« This is largely because… »",
  "« A case in point is… »",
];

const SEND_EE = { what: "Le sujet, votre texte tapé sans correcteur, le nombre de mots et le temps mis.", receive: "Une note sur 20 avec le niveau NCLC, vos 5 erreurs principales et une version réécrite au niveau C2." };
const SEND_EO = { what: "Le sujet et la transcription de votre enregistrement (ou une séance en mode vocal).", receive: "Une note sur 20, les erreurs de langue, la structure et le vocabulaire à améliorer." };
const SEND_COMP = { what: "Votre score, les numéros des questions ratées et le type de document.", receive: "L'analyse de vos pièges récurrents et des exercices ciblés." };
const SEND_W = { what: "Le sujet, votre texte tapé sans correcteur, le nombre de mots et le temps mis.", receive: "Un band estimé pour chacun des 4 critères, vos erreurs principales et une version réécrite au niveau 7,5." };
const SEND_S = { what: "La question et la transcription de votre enregistrement (ou une séance en mode vocal).", receive: "Un band estimé, vos erreurs et des expressions à ajouter." };
const SEND_LR = { what: "Votre score sur 40 et les numéros des questions ratées.", receive: "L'analyse de vos pièges récurrents." };

const RULES_WRITING = ["Chronomètre lancé : une copie faite sans limite de temps ne dit rien de votre niveau.", "Pas de dictionnaire ni de correcteur pendant l'écriture, seulement après."];

const LISTEN_METHOD = "Méthode d'écoute : un extrait de 3 minutes écouté 3 fois (sens global, puis détails, puis 5 expressions à noter dans Anki). Le reste du temps, écoutez librement.";

export const GUIDES: Record<string, Guide> = {
  "tcf-ee3": {
    title: "Expression écrite · tâche 3",
    why: "Texte argumentatif à partir de deux documents : c'est la tâche qui pèse le plus dans la note d'expression écrite.",
    steps: [
      "Lancer un chronomètre de 45 minutes (en examen, 60 minutes pour les 3 tâches).",
      "Lire les deux documents et noter en une ligne la position de chacun.",
      "Introduction : reformuler le débat en une phrase.",
      "Paragraphe 1 : la position du document 1, puis celle du document 2.",
      "Paragraphe 2 : votre avis, avec une concession (« certes…, il n'en demeure pas moins que… »).",
      "Conclusion : une phrase d'ouverture.",
      "Compter les mots : entre 120 et 180.",
    ],
    tips: [...RULES_WRITING, ...PHRASES_FR],
    table: { head: ["Longueur", "Ce que le correcteur attend"], rows: [["120 à 180 mots", "Synthèse des deux points de vue, position nuancée, connecteurs variés"]] },
    resources: [R.packGold, R.manuelTcf, R.conversation, R.feiExemples],
    send: SEND_EE,
  },
  "tcf-ee12": {
    title: "Expression écrite · tâches 1 et 2",
    why: "Le message et l'article sont plus courts mais doivent être sans faute : le registre et les consignes comptent autant que la langue.",
    steps: [
      "Tâche 1 (message : invitation, demande, réponse) : 60 à 120 mots, registre adapté au destinataire, toutes les consignes traitées.",
      "Tâche 2 (article, blog ou récit d'expérience) : 120 à 150 mots, récit vivant, temps du passé variés, opinion personnelle.",
      "Relire en cherchant d'abord les accords, puis les temps, puis la ponctuation.",
    ],
    tips: [...RULES_WRITING, "Varier passé composé, imparfait et plus-que-parfait dans la tâche 2."],
    table: {
      head: ["Tâche", "Format", "Longueur", "Attendu"],
      rows: [
        ["1", "Message", "60 à 120 mots", "Registre juste, consignes traitées, zéro faute"],
        ["2", "Article, blog, récit", "120 à 150 mots", "Récit vivant, temps du passé variés, opinion"],
      ],
    },
    resources: [R.packGold, R.manuelTcf, R.feiExemples],
    send: SEND_EE,
  },
  "tcf-grammaire": {
    title: "Grammaire de la semaine et réécriture",
    why: "Fixer le point de grammaire de la semaine et corriger durablement les erreurs déjà relevées.",
    steps: [
      "Faire les exercices du chapitre correspondant à la grammaire de la semaine.",
      "Reprendre une copie déjà corrigée et la réécrire entièrement sans regarder la correction.",
      "Comparer avec la version corrigée et noter les nouvelles erreurs dans le carnet.",
    ],
    tips: ["Une erreur qui revient 3 fois devient un exercice ciblé la semaine suivante."],
    resources: [R.grammaire, R.monde],
  },
  "tcf-co": {
    title: "Compréhension orale",
    why: "39 questions de difficulté croissante : les dernières, de niveau C1-C2, rapportent le plus.",
    steps: [
      "Lire les réponses proposées avant d'écouter le document.",
      "Chercher la reformulation : la bonne réponse reprend rarement les mots exacts.",
      "Identifier l'intention de l'auteur (informer, critiquer, nuancer).",
      "Noter le score et les numéros des questions ratées.",
    ],
    resources: [R.rfiFacile, R.tv5, R.packGold, R.feiExemples],
    send: SEND_COMP,
  },
  "tcf-ce": {
    title: "Compréhension écrite",
    why: "39 questions en 60 minutes : il faut gérer le temps pour atteindre les dernières questions.",
    steps: [
      "Chronomètre lancé : environ 1 min 30 par question en moyenne.",
      "Lire les questions et les réponses avant le texte.",
      "Repérer la reformulation et l'intention de l'auteur.",
      "Noter le score et les questions ratées avec le type de texte.",
    ],
    resources: [R.conversation, R.tv5, R.packGold],
    send: SEND_COMP,
  },
  "tcf-eo1": {
    title: "Expression orale · tâche 1",
    why: "Entretien dirigé d'environ 2 minutes : une présentation fluide met l'examinateur en confiance.",
    steps: ["Préparer une présentation : parcours, métier, projet Canada, loisirs.", "S'enregistrer, puis transcrire mot à mot.", "Corriger la transcription et réenregistrer la version améliorée."],
    resources: [R.rfiDebat, R.ohdio],
    send: SEND_EO,
  },
  "tcf-eo2": {
    title: "Expression orale · tâche 2",
    why: "Interaction d'environ 5 minutes pour obtenir des informations : la variété des questions est notée.",
    steps: ["Préparer 15 questions variées et polies (inversion, conditionnel).", "S'enregistrer en jouant la situation, reformuler les réponses imaginées.", "Transcrire, corriger, noter les erreurs dans le carnet."],
    tips: ["« Pourriez-vous me dire… ? », « Serait-il possible de… ? », « Je voudrais savoir si… »"],
    resources: [R.manuelTcf, R.packGold],
    send: SEND_EO,
  },
  "tcf-eo3": {
    title: "Expression orale · tâche 3",
    why: "Donner son point de vue pendant environ 4 min 30 : la structure et les exemples font la note.",
    steps: [
      "Plan en 3 temps : position, arguments avec exemples concrets, conclusion nuancée.",
      "Prendre des exemples tirés du recrutement et du quotidien.",
      "S'enregistrer, transcrire, corriger, puis réenregistrer.",
    ],
    tips: PHRASES_FR,
    resources: [R.rfiDebat, R.franceCulture, R.franceInter],
    send: SEND_EO,
  },
  "fr-podcast": {
    title: "Écoute en français",
    why: "Les trajets sont votre principal temps d'apprentissage : l'oreille s'habitue au débit et au vocabulaire abstrait des dernières questions.",
    steps: [LISTEN_METHOD, "Sur le trajet retour, relire mentalement le carnet d'erreurs."],
    resources: [R.rfiJournal, R.rfiDebat, R.franceCulture, R.franceInter, R.ohdio],
  },
  anki: {
    title: "Anki : vocabulaire du thème",
    why: "20 mots ou expressions par jour, revus au bon moment, pour enrichir le vocabulaire de l'écrit et de l'oral.",
    steps: ["Ajouter les expressions notées pendant les écoutes et les lectures.", "Faire les révisions du jour avant d'ajouter de nouvelles cartes.", "Préférer des phrases complètes à des mots isolés."],
    resources: [R.anki],
  },
  "en-maintien": {
    title: "Maintien de l'anglais",
    why: "Jusqu'au TCF, l'anglais se limite à 15 minutes d'écoute par jour pour ne pas perdre le niveau.",
    steps: ["Un épisode de 6 Minute English, puis le BBC Global News Podcast quand c'est confortable."],
    resources: [R.bbc6, R.bbcNews],
  },
  carnet: {
    title: "Carnet d'erreurs",
    why: "Chaque erreur corrigée et relue est une erreur que vous ne referez plus le jour de l'examen.",
    steps: [
      "Ajouter dans l'onglet Carnet d'erreurs : phrase fautive, phrase corrigée, règle.",
      "Si l'erreur est déjà notée, appuyer sur + pour compter la répétition.",
      "Lire le sujet du lendemain pour y penser pendant la nuit.",
    ],
    tips: ["Relire le carnet chaque dimanche.", "Une erreur qui revient 3 fois devient un exercice ciblé la semaine suivante."],
  },
  correction: {
    title: "Correction et carnet d'erreurs",
    why: "Un examen blanc n'est utile que si chaque erreur est comprise et notée.",
    steps: ["Corriger avec le corrigé ou envoyer les copies à Claude.", "Reporter chaque erreur dans le carnet.", "Saisir le score dans l'onglet Scores."],
  },
  "tcf-blanc": {
    title: "Examen blanc TCF",
    why: "Mesurer le niveau en conditions réelles et repérer la compétence la plus faible.",
    steps: [
      "Conditions réelles : chronomètre, pas de pause, pas de dictionnaire.",
      "Compréhension orale (39 questions), compréhension écrite (39 questions, 60 min).",
      "Expression écrite : les 3 tâches en 60 minutes. Expression orale : les 3 tâches (12 min).",
      "Saisir les 4 scores dans l'onglet Scores.",
    ],
    resources: [R.packGold, R.feiExemples, R.institut],
    send: { what: "Les scores, les copies et les transcriptions.", receive: "Les notes, le niveau NCLC et la compétence à renforcer." },
  },
  "tcf-samedi": {
    title: "Entraînement du samedi",
    why: "Une épreuve de compréhension et une tâche 3, chronométrées, pour garder les automatismes.",
    steps: ["Une série complète de CO ou de CE, chronométrée.", "Une tâche 3 écrite en conditions réelles.", "Correction l'après-midi."],
    resources: [R.packGold, R.tv5, R.rfiFacile],
    send: SEND_EE,
  },
  shadowing: {
    title: "Shadowing",
    why: "Répéter à voix haute juste derrière l'orateur améliore la fluidité et la prononciation.",
    steps: ["Choisir un extrait de 1 à 2 minutes avec transcription.", "L'écouter une fois, puis répéter en même temps que l'orateur, phrase par phrase.", "Recommencer jusqu'à suivre le rythme sans décrocher."],
    resources: [R.rfiJournal, R.ted, R.bbc6],
  },
  bilan: {
    title: "Bilan de la semaine à Claude",
    why: "Faire le point chaque dimanche soir permet d'ajuster la semaine suivante.",
    steps: ["Rassembler les scores de la semaine et les copies non encore envoyées.", "Indiquer ce qui a été fait et ce qui a sauté.", "Envoyer à Claude à 20:00."],
  },
  "examen-tcf": {
    title: "TCF Canada",
    why: "Objectif NCLC 10 : 549 en compréhension, 16/20 en expression.",
    steps: ["Lire les réponses proposées avant d'écouter ou de lire.", "Gérer le temps pour atteindre les dernières questions.", "Tâche 3 écrite : suivre le plan habituel."],
    resources: [R.feiTcfCanada],
  },
  "examen-ielts": {
    title: "IELTS General Training",
    why: "Objectif CLB 9 : Listening 8,0 ; Reading 7,0 ; Writing 7,0 ; Speaking 7,0.",
    steps: ["Writing : commencer par la Task 2, qui compte double.", "Reading : jamais plus de 90 secondes bloqué sur une question.", "Speaking : ne jamais répondre en une phrase."],
    resources: [R.ieltsOrg],
  },
  "veille-examen": {
    title: "Repos actif",
    why: "Arriver reposé compte plus qu'une révision de dernière minute.",
    steps: ["Relecture légère du carnet d'erreurs, rien de nouveau.", "Préparer la convocation, la pièce d'identité et le trajet.", "Se coucher tôt."],
  },
  "ielts-task1": {
    title: "Writing Task 1 : la lettre",
    why: "Lettre de 150 mots en 20 minutes : le registre doit correspondre au destinataire.",
    steps: ["Identifier le registre et les 3 points à traiter.", "Un paragraphe par point, une phrase d'ouverture et une de clôture.", "Dépasser légèrement 150 mots.", "Réécrire ensuite une copie déjà corrigée."],
    table: {
      head: ["Registre", "Ouverture", "Clôture"],
      rows: [
        ["Formel (destinataire inconnu)", "Dear Sir or Madam,", "Yours faithfully,"],
        ["Semi-formel (connu par son nom)", "Dear Mr Kouassi,", "Yours sincerely,"],
        ["Amical", "Dear Paul,", "Best wishes, / Take care,"],
      ],
    },
    tips: PHRASES_EN,
    resources: [R.ieltsLiz, R.ieltsOrg, R.cambridge],
    send: SEND_W,
  },
  "ielts-task2": {
    title: "Writing Task 2 : l'essai",
    why: "Essai de 250 mots en 40 minutes : il compte double dans la note de Writing.",
    steps: [
      "Introduction : reformuler le sujet et annoncer votre position.",
      "Deux paragraphes, chacun avec une idée, une explication et un exemple.",
      "Conclusion : reprendre la position, sans idée nouvelle.",
      "Dépasser légèrement 250 mots, puis relire.",
    ],
    tips: ["Pour 7,0 : des phrases complexes avec peu d'erreurs, un vocabulaire moins courant employé correctement.", ...PHRASES_EN],
    resources: [R.ieltsLiz, R.cambridge, R.ted],
    send: SEND_W,
  },
  "ielts-listening": {
    title: "Listening",
    why: "Cible 8,0, soit environ 35 bonnes réponses sur 40.",
    steps: ["Lire les questions avant l'écoute.", "Anticiper le type de réponse (nombre, nom, date).", "Vérifier l'orthographe et les pluriels.", "Noter le score sur 40 et les questions ratées."],
    resources: [R.ieltsReady, R.cambridge, R.bbcNews],
    send: SEND_LR,
  },
  "ielts-reading": {
    title: "Reading",
    why: "Cible 7,0, soit environ 34 bonnes réponses sur 40, en 60 minutes.",
    steps: ["Survoler le texte (skimming), puis chercher l'information précise (scanning).", "Maîtriser True / False / Not Given.", "Ne jamais rester bloqué plus de 90 secondes sur une question."],
    resources: [R.ieltsReady, R.cambridge, R.ieltsLiz],
    send: SEND_LR,
  },
  "ielts-speaking": {
    title: "Speaking",
    why: "3 parts en 11 à 14 minutes, cible 7,0 : la fluidité et le développement des réponses priment.",
    steps: [
      "Part 1 : réponses de 2 à 3 phrases, jamais une seule.",
      "Part 2 : parler 2 minutes en suivant qui, quoi, quand, pourquoi, ce que j'en pense.",
      "Part 3 : développer et justifier, avec un exemple.",
      "S'enregistrer, transcrire, corriger.",
    ],
    resources: [R.ieltsLiz, R.ted, R.ieltsOrg],
    send: SEND_S,
  },
  "en-podcast": {
    title: "Écoute en anglais",
    why: "Habituer l'oreille à l'accent britannique et noter des idées pour la Task 2 et la Part 3.",
    steps: ["Écouter un épisode en notant 2 ou 3 idées réutilisables dans un essai.", "Ajouter 5 expressions dans Anki."],
    resources: [R.bbcNews, R.ted, R.radio4],
  },
  "ielts-blanc": {
    title: "Examen blanc IELTS",
    why: "Vérifier que le CLB 9 est atteint en conditions réelles.",
    steps: ["Listening (30 min), Reading (60 min), Writing (60 min) d'affilée, chronomètre lancé.", "Speaking : les 3 parts enregistrées.", "Saisir les 4 bands dans l'onglet Scores."],
    resources: [R.cambridge, R.ieltsReady],
    send: { what: "Les scores sur 40, les copies et la transcription du Speaking.", receive: "Les bands par épreuve et les priorités." },
  },
  "ielts-samedi": {
    title: "Listening et Reading complets",
    why: "Un test complet de compréhension chaque samedi sans examen blanc.",
    steps: ["Un Listening complet (30 min) puis un Reading complet (60 min).", "Correction l'après-midi, score sur 40."],
    resources: [R.cambridge, R.ieltsReady],
    send: SEND_LR,
  },
  "ielts-revision": {
    title: "Révision légère",
    why: "Consolider sans rien apprendre de nouveau après le 25/03.",
    steps: ["Relire les phrases clés et les registres des lettres.", "Relire le carnet d'erreurs."],
    tips: PHRASES_EN,
  },
};

const JALONS: Record<string, Guide> = {
  "t5:e0": {
    title: "Achat du pack Gold",
    why: "Le seul achat du programme : il donne les séries de CO et CE et les examens blancs de la phase 2.",
    steps: ["Acheter le pack Gold sur formation-tcfcanada.com (49,99 $ US).", "Tester l'accès sur le téléphone pour les trajets.", "Planifier l'examen blanc n° 1 du samedi."],
    resources: [R.packGold],
  },
  "t8:e0": {
    title: "Inscription au TCF Canada",
    why: "S'inscrire pour l'examen du 15/02/2027.",
    steps: ["Choisir le centre agréé et la session du 15/02.", "Préparer la pièce d'identité et le paiement.", "Conserver la convocation."],
    resources: [R.feiTcfCanada],
  },
  "t11:e2": {
    title: "Réservation de l'IELTS",
    why: "Réserver l'examen du 27/03 pour avoir les résultats avant la création du profil Entrée express.",
    steps: ["Réserver auprès du British Council ou d'IDP (papier ou ordinateur).", "Vérifier les dates disponibles et le tarif.", "Si le 27/03 n'est pas disponible, prendre la date la plus proche entre le 20/03 et le 10/04."],
    resources: [R.ieltsOrg],
  },
};

export function guideFor(topic: string): Guide | null {
  if (topic.startsWith("jalon:")) {
    const key = topic.slice(6);
    return JALONS[key] ?? (key.startsWith("i") ? GUIDES["ielts-task2"] : GUIDES["tcf-ee3"]);
  }
  return GUIDES[topic] ?? null;
}

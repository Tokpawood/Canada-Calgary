// Schéma de données partagé, porté du prototype (etat-complet.json) vers des tables normalisées.

export type StepStatus = "À faire" | "En cours" | "Bloqué" | "Fait" | "Si nécessaire";
export type DocumentStatus = "À obtenir" | "Demandé" | "Obtenu";
export type DocumentRequirement = "Obligatoire" | "Conseillé" | "Si applicable";
export type HistoryType = "Travail" | "Études" | "Sans emploi" | "Autre";

export interface Link {
  id: string;
  label: string;
  url: string;
}

export interface SubTask {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Step {
  id: string;
  dossierId: string;
  phase: string;
  title: string;
  due: string | null; // AAAA-MM-JJ
  status: StepStatus;
  planned: number | null;
  actual: number | null;
  org: string;
  req: string;
  notes: string;
  risk: string;
  position: number;
  tasks: SubTask[];
  links: Link[];
}

export interface DocumentCheck {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface VaultFile {
  id: string;
  documentId: string | null; // null = "Divers", non rattaché
  storagePath: string | null;
  provider: "supabase" | "gdrive";
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
}

export interface DocumentRecord {
  id: string;
  dossierId: string;
  name: string;
  status: DocumentStatus;
  use: string;
  from: string;
  date: string; // date d'obtention, vide si inconnue
  notes: string;
  req: DocumentRequirement;
  format: string;
  validity: string;
  checks: DocumentCheck[];
  links: Link[];
  files: VaultFile[];
}

export interface Saving {
  id: string;
  dossierId: string;
  label: string;
  planned: number | null;
  actual: number | null;
  notes: string;
}

export interface Contact {
  id: string;
  dossierId: string;
  org: string;
  role: string;
  contact: string;
  person: string;
  next: string;
  notes: string;
}

export interface Gap {
  id: string;
  dossierId: string;
  text: string;
  done: boolean;
}

export interface HistoryEntry {
  id: string;
  dossierId: string;
  from: string; // AAAA-MM-JJ ou AAAA-MM
  to: string; // idem, vide = en cours
  type: HistoryType;
  activity: string;
  org: string;
  place: string;
  parallel: boolean;
}

export interface AddressEntry {
  id: string;
  dossierId: string;
  from: string;
  to: string;
  address: string;
  city: string;
  note: string;
  parallel: boolean;
}

export interface Identity {
  dossierId: string;
  nom: string;
  prenoms: string;
  naissance: string | null;
  lieu: string;
  pere: string;
  mere: string;
  statut: string;
}

export interface Profile {
  dossierId: string;
  titre: string;
  enfants: string;
  nationalite: string;
  passeport: string;
  telephone: string;
  courriel: string;
  permis: string;
  adresse: string;
  programme: string;
  cnp: string;
  ville: string;
  repli: string;
}

export type FirstLanguage = "fr" | "en";

export interface FswProfile {
  dossierId: string;
  first: FirstLanguage;
  // Scores NCLC par épreuve, langue première (clé = `${first}_co|ce|eo|ee`)
  fr_co: string;
  fr_ce: string;
  fr_eo: string;
  fr_ee: string;
  en_co: string;
  en_ce: string;
  en_eo: string;
  en_ee: string;
  edu: string; // code EDU
  arranged: "0" | "10";
  adapt: "0" | "5" | "10";
}

export interface Dossier {
  id: string;
  ownerId: string;
  profileDate: string | null;
  fundsMin: number;
  fundsTarget: number;
  cadRate: number;
}

export type ReminderKind = "J-7" | "J-1";

export interface ReminderLog {
  id: string;
  stepId: string;
  kind: ReminderKind;
  sentAt: string;
}

export type CollaboratorRole = "titulaire" | "lecteur";

export interface Collaborator {
  dossierId: string;
  userId: string;
  role: CollaboratorRole;
}

// Vue d'ensemble utilisée par lib/rules (ne vient pas forcément d'une seule requête)
export interface DossierBundle {
  dossier: Dossier;
  identity: Identity;
  profile: Profile;
  fsw: FswProfile;
  steps: Step[];
  documents: DocumentRecord[];
  savings: Saving[];
  contacts: Contact[];
  gaps: Gap[];
  history: HistoryEntry[];
  addresses: AddressEntry[];
}

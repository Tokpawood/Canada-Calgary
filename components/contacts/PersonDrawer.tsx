"use client";

import { useMemo, useState, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";
import { PERSON_FIELDS, canReportTo, personLabel, type ContactPerson, type ContactStepLink, type PersonField, type StepLite } from "@/lib/network";
import { deletePerson, linkStep, movePerson, patchPerson, unlinkStep } from "@/lib/networkClient";
import { ConfirmButton, Drawer, Field, STEP_TONE, TONE_DOT, fmtShortDate } from "@/components/ui";
import { EditBar, useEditable } from "@/components/editable";
import { HeaderTabs } from "@/components/DarkHeader";
import { DrawerCard, DrawerFacts, DrawerTitle, ReadRow } from "@/components/DrawerParts";
import { IconChevronLeft, IconLink, IconMail, IconPhone, IconTrash, IconX } from "@/components/icons";
import { CopyButton } from "@/components/profil/FieldGrid";
import { contactLink, initials } from "./contactLink";
import { PhotoBadge, PhotoPicker } from "./PhotoPicker";

type Tab = "identite" | "taches";
type Draft = Pick<ContactPerson, PersonField | "contactId" | "parentId">;

interface Props {
  dossierId: string;
  person: ContactPerson;
  contacts: Contact[];
  persons: ContactPerson[];
  links: ContactStepLink[];
  steps: StepLite[];
  initialTab?: Tab;
  backLabel?: string;
  onBack?: () => void;
  onChange: (p: ContactPerson) => void;
  /** Appelé après un changement d'organisme (organigramme et liens à mettre à jour). */
  onMoved: (p: ContactPerson, contactId: string | null) => void;
  onDeleted: (p: ContactPerson) => void;
  onLinkAdd: (l: ContactStepLink) => void;
  onLinkRemove: (id: string) => void;
  onOpenStep: (stepId: string) => void;
  onOpenOrg: (contactId: string) => void;
  onClose: () => void;
}

/** Fiche complète d'une personne : photo, coordonnées, identification, rattachement et tâches liées. */
export function PersonDrawer(props: Props) {
  const { dossierId, person: p, contacts, persons, links, steps, initialTab = "identite", backLabel, onBack, onChange, onMoved, onDeleted, onLinkAdd, onLinkRemove, onOpenStep, onOpenOrg, onClose } = props;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [warn, setWarn] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const org = p.contactId ? contacts.find((c) => c.id === p.contactId) : undefined;
  const boss = p.parentId ? persons.find((x) => x.id === p.parentId) : undefined;

  const saved: Draft = useMemo(() => {
    const d = { contactId: p.contactId, parentId: p.parentId } as Draft;
    for (const k of PERSON_FIELDS) (d as Record<string, unknown>)[k] = p[k];
    return d;
  }, [p]);

  const ed = useEditable(saved, async (d) => {
    if (!d.name.trim()) throw new Error("Indiquez au moins un nom.");
    const patch: Partial<Pick<ContactPerson, PersonField>> = {};
    for (const k of PERSON_FIELDS) {
      // Comme en base (patchPerson) : textes sans espaces autour, sauf les notes ; date vide = null.
      const raw = d[k];
      const value = typeof raw === "string" && k !== "notes" ? raw.trim() || (k === "birthDate" ? null : "") : raw;
      if (value !== saved[k]) Object.assign(patch, { [k]: value });
    }
    await patchPerson(p.id, patch);
    let next: ContactPerson = { ...p, ...patch };
    if (d.contactId !== saved.contactId) {
      await movePerson(p, d.contactId);
      next = { ...next, contactId: d.contactId, parentId: null };
      onMoved(next, d.contactId);
    } else if (d.parentId !== saved.parentId) {
      const { error } = await createClient().from("contact_person").update({ parent_id: d.parentId }).eq("id", p.id);
      if (error) throw new Error("Rattachement impossible.");
      next = { ...next, parentId: d.parentId };
    }
    onChange(next);
    setWarn(false);
  });
  const v = ed.current;
  const set = (patch: Partial<Draft>) => ed.set(patch);
  const managers = persons.filter((x) => x.id !== p.id && x.contactId === v.contactId && v.contactId && canReportTo(persons, p.id, x.id));

  function guardedClose() {
    if (ed.dirty) return setWarn(true);
    onClose();
  }

  const tel = p.phone.replace(/[^\d+]/g, "");
  const wa = p.whatsapp.replace(/[^\d]/g, "");
  const quick = [
    tel && { key: "tel", href: `tel:${tel}`, label: "Appeler", icon: <IconPhone size={14} />, external: false },
    wa && { key: "wa", href: `https://wa.me/${wa}`, label: "WhatsApp", icon: <IconChat />, external: true },
    p.email && { key: "mail", href: `mailto:${p.email}`, label: "Écrire", icon: <IconMail size={14} />, external: false },
  ].filter((x): x is { key: string; href: string; label: string; icon: ReactElement; external: boolean } => !!x);

  const sub = [p.title, org ? org.org : p.relation || "Personne indépendante"].filter(Boolean).join(" · ");

  return (
    <Drawer
      label={`Personne : ${p.name}`}
      onClose={guardedClose}
      topActions={
        onBack && !ed.editing && (
          <button type="button" onClick={onBack} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-night-muted hover:bg-white/10 hover:text-night-ink">
            <IconChevronLeft size={16} /> <span className="max-w-[9rem] truncate">{backLabel ?? "Retour"}</span>
          </button>
        )
      }
      header={
        <>
          <div className="flex items-center gap-4 pr-24">
            <PhotoBadge url={p.photoUrl} label={initials(p.name)} shape="circle" size={64} className="ring-2 ring-white/15" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-night-muted uppercase">{org ? "Personne de l'organisme" : "Personne indépendante"}</p>
              <DrawerTitle value={v.name} editing={ed.editing} onChange={(name) => set({ name })} label="Nom" />
              {!ed.editing && sub && (
                <p className="mt-0.5 truncate text-[13px] text-night-muted">
                  {org ? (
                    <>
                      {p.title && `${p.title} · `}
                      <button type="button" onClick={() => onOpenOrg(org.id)} className="font-semibold text-night-ink hover:underline">
                        {org.org || "Organisme"}
                      </button>
                    </>
                  ) : (
                    sub
                  )}
                </p>
              )}
            </div>
          </div>
          {!ed.editing && quick.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Contacter">
              {quick.map((x) => (
                <a
                  key={x.key}
                  href={x.href}
                  target={x.external ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={`${x.label} ${p.name}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-night-ink hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                >
                  {x.icon} {x.label}
                </a>
              ))}
            </div>
          )}
          <DrawerFacts
            items={[
              { label: "Téléphone", value: p.phone || p.whatsapp || "—" },
              { label: "Courriel", value: p.email || "—" },
              { label: "Tâches liées", value: String(links.length) },
            ]}
          />
        </>
      }
      tabs={
        <HeaderTabs
          label="Sections de la fiche"
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "identite", label: "Identité" },
            { id: "taches", label: "Tâches", badge: links.length ? { text: String(links.length) } : null },
          ]}
        />
      }
      footer={
        <div>
          {warn && <p className="mb-2 text-[12.5px] font-semibold text-bad">Modifications non enregistrées : enregistrez-les ou annulez avant de fermer.</p>}
          {deleteError && (
            <p role="alert" className="mb-2 text-[12.5px] font-semibold text-bad">
              {deleteError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {ed.editing ? (
              <span className="text-[12.5px] font-semibold text-opt">Modification en cours</span>
            ) : (
              <ConfirmButton
                label="Supprimer la personne"
                confirmLabel="Supprimer la fiche"
                onConfirm={() => {
                  setDeleteError(null);
                  void deletePerson(p).then(
                    () => onDeleted(p),
                    (e: unknown) => setDeleteError(e instanceof Error ? e.message : "Suppression impossible."),
                  );
                }}
              >
                <IconTrash size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </ConfirmButton>
            )}
            <EditBar edit={ed} label="Modifier la fiche" />
          </div>
        </div>
      }
    >
      {tab === "identite" && (
        <div className="flex flex-col gap-4">
          <div className="px-1">
            <PhotoPicker
              dossierId={dossierId}
              kind="person"
              id={p.id}
              url={p.photoUrl}
              path={p.photoPath}
              label={initials(p.name)}
              onChange={(ph) => onChange({ ...p, photoPath: ph?.path ?? null, photoUrl: ph?.url ?? null })}
            />
          </div>

          <DrawerCard title="Rôle et rattachement">
            {ed.editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Organisme">
                  <select value={v.contactId ?? ""} onChange={(e) => set({ contactId: e.target.value || null, parentId: null })} className="input">
                    <option value="">Aucun (personne indépendante)</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.org || "Organisme sans nom"}
                      </option>
                    ))}
                  </select>
                </Field>
                {v.contactId ? (
                  <Field label="Rattachée à">
                    <select value={v.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })} disabled={v.contactId !== saved.contactId} className="input">
                      <option value="">Personne (en haut de l&apos;organigramme)</option>
                      {managers.map((x) => (
                        <option key={x.id} value={x.id}>
                          {personLabel(x)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <Field label="Fonction">
                  <input value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Conseillère, DRH, gérant…" className="input" />
                </Field>
                <Field label="Ce qu'elle est pour vous">
                  <input value={v.relation} onChange={(e) => set({ relation: e.target.value })} placeholder="Coursier, ami, chauffeur, voisin…" className="input" />
                </Field>
              </div>
            ) : (
              <dl className="m-0">
                <ReadRow
                  label="Organisme"
                  value={
                    org ? (
                      <button type="button" onClick={() => onOpenOrg(org.id)} className="text-act hover:underline">
                        {org.org || "Organisme sans nom"}
                      </button>
                    ) : (
                      "Aucun (personne indépendante)"
                    )
                  }
                />
                {org && <ReadRow label="Rattachée à" value={boss ? personLabel(boss) : ""} />}
                <ReadRow label="Fonction" value={p.title} />
                <ReadRow label="Ce qu'elle est pour vous" value={p.relation} />
              </dl>
            )}
          </DrawerCard>

          <DrawerCard title="Coordonnées">
            {ed.editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Téléphone">
                  <input type="tel" inputMode="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} className="input" />
                </Field>
                <Field label="WhatsApp">
                  <input type="tel" inputMode="tel" value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="input" />
                </Field>
                <Field label="Courriel">
                  <input type="email" inputMode="email" value={v.email} onChange={(e) => set({ email: e.target.value })} className="input" />
                </Field>
                <Field label="Site ou profil (LinkedIn…)">
                  <input inputMode="url" value={v.website} onChange={(e) => set({ website: e.target.value })} className="input" />
                </Field>
                <Field label="Adresse" className="sm:col-span-2">
                  <input value={v.address} onChange={(e) => set({ address: e.target.value })} className="input" />
                </Field>
                <Field label="Ville">
                  <input value={v.city} onChange={(e) => set({ city: e.target.value })} className="input" />
                </Field>
                <Field label="Pays">
                  <input value={v.country} onChange={(e) => set({ country: e.target.value })} className="input" />
                </Field>
              </div>
            ) : (
              <dl className="m-0">
                <ReadRow label="Téléphone" value={p.phone ? <Linked value={p.phone} href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} /> : ""} />
                <ReadRow label="WhatsApp" value={p.whatsapp ? <Linked value={p.whatsapp} href={`https://wa.me/${p.whatsapp.replace(/[^\d]/g, "")}`} external /> : ""} />
                <ReadRow label="Courriel" value={p.email ? <Linked value={p.email} href={`mailto:${p.email}`} /> : ""} />
                <ReadRow label="Site ou profil" value={p.website ? <Linked value={p.website} href={contactLink(p.website)?.href} external /> : ""} />
                <ReadRow label="Adresse" value={[p.address, p.city, p.country].filter(Boolean).join(", ")} />
              </dl>
            )}
          </DrawerCard>

          <DrawerCard title="Identification" sub="Visible de vous seul : jamais montrée aux lecteurs invités.">
            {ed.editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Date de naissance">
                  <input type="date" value={v.birthDate ?? ""} onChange={(e) => set({ birthDate: e.target.value || null })} className="input" />
                </Field>
                <Field label="Nationalité">
                  <input value={v.nationality} onChange={(e) => set({ nationality: e.target.value })} className="input" />
                </Field>
                <Field label="Pièce d'identité">
                  <input value={v.idType} onChange={(e) => set({ idType: e.target.value })} placeholder="CNI, passeport, permis…" list="id-types" className="input" />
                  <datalist id="id-types">
                    {["CNI", "Passeport", "Permis de conduire", "Carte consulaire", "Attestation d'identité"].map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Numéro de la pièce">
                  <input value={v.idNumber} onChange={(e) => set({ idNumber: e.target.value })} className="input mono" />
                </Field>
              </div>
            ) : (
              <dl className="m-0">
                <ReadRow label="Date de naissance" value={p.birthDate ? fmtShortDate(p.birthDate) : ""} />
                <ReadRow label="Nationalité" value={p.nationality} />
                <ReadRow label="Pièce d'identité" value={p.idType} />
                <ReadRow
                  label="Numéro"
                  value={
                    p.idNumber ? (
                      <span className="mono flex items-center gap-1">
                        {p.idNumber} <CopyButton text={p.idNumber} label="numéro de pièce" />
                      </span>
                    ) : (
                      ""
                    )
                  }
                />
              </dl>
            )}
          </DrawerCard>

          <DrawerCard title="Comment elle peut aider">
            {ed.editing ? (
              <textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className="input" aria-label="Notes" />
            ) : p.notes ? (
              <p className="text-[13.5px] whitespace-pre-line">{p.notes}</p>
            ) : (
              <p className="text-[13px] text-faint">Rien de noté.</p>
            )}
          </DrawerCard>
        </div>
      )}

      {tab === "taches" && (
        <DrawerCard title="Tâches liées" sub="Étapes du parcours où cette personne peut aider.">
          <PersonSteps person={p} links={links} steps={steps} canEdit={!ed.editing} onAdd={onLinkAdd} onRemove={onLinkRemove} onOpenStep={onOpenStep} />
        </DrawerCard>
      )}
    </Drawer>
  );
}

/** Bulle de discussion (WhatsApp), définie ici faute d'icône partagée. */
function IconChat() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function Linked({ value, href, external }: { value: string; href?: string; external?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      {href ? (
        <a href={href} target={external ? "_blank" : undefined} rel="noopener noreferrer" className="truncate text-act hover:underline">
          {value}
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
      <CopyButton text={value} label={value} />
    </span>
  );
}

function PersonSteps({
  person,
  links,
  steps,
  canEdit,
  onAdd,
  onRemove,
  onOpenStep,
}: {
  person: ContactPerson;
  links: ContactStepLink[];
  steps: StepLite[];
  canEdit: boolean;
  onAdd: (l: ContactStepLink) => void;
  onRemove: (id: string) => void;
  onOpenStep: (stepId: string) => void;
}) {
  const [stepId, setStepId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byStep = new Map(steps.map((s) => [s.id, s]));
  const taken = new Set(links.map((l) => l.stepId));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {links.length === 0 ? (
        <p className="text-[13px] text-faint">Aucune tâche liée.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((l) => {
            const s = byStep.get(l.stepId);
            if (!s) return null;
            return (
              <li key={l.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2/60">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[STEP_TONE[s.status]]}`} title={s.status} />
                <button type="button" onClick={() => onOpenStep(s.id)} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium hover:text-act hover:underline">
                  {s.title}
                </button>
                {s.due && <span className="mono shrink-0 text-[11.5px] text-faint">{fmtShortDate(s.due)}</span>}
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(async () => (await unlinkStep(l.id), onRemove(l.id)))}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-bad"
                    aria-label={`Délier « ${s.title} »`}
                  >
                    <IconX size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stepId) return;
            void run(async () => {
              onAdd(await linkStep(stepId, person.contactId, person.id));
              setStepId("");
            });
          }}
        >
          <select value={stepId} onChange={(e) => setStepId(e.target.value)} className="input min-w-0 flex-1 py-1.5 text-[13px]" aria-label="Tâche à lier">
            <option value="">Lier une tâche du parcours…</option>
            {steps
              .filter((s) => !taken.has(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
          <button type="submit" disabled={!stepId || busy} className="btn btn-sm btn-ghost">
            <IconLink size={14} /> Lier
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-[12px] text-bad">{error}</p>}
    </div>
  );
}

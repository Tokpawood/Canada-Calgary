"use client";

import { useState } from "react";

/** Champ mot de passe avec bouton Afficher / Masquer. */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  label,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  label?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input py-3 pr-20 text-[15px]"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-pressed={show}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"
      >
        {show ? "Masquer" : "Afficher"}
      </button>
    </span>
  );
}

/** Messages d'erreur Supabase Auth traduits. */
export function authErrorFr(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Courriel ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Adresse non confirmée.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives : patientez quelques minutes avant de réessayer.";
  if (m.includes("should be different")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (m.includes("password should be at least") || m.includes("weak")) return "Mot de passe trop court ou trop faible (10 caractères minimum).";
  if (m.includes("signups not allowed")) return "La création de compte est désactivée.";
  if (m.includes("fetch")) return "Serveur injoignable : vérifiez votre connexion.";
  return message;
}

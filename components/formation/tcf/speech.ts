"use client";
/**
 * Voix de l'appareil : lecture des documents de compréhension orale (synthèse vocale)
 * et transcription de la prise de parole (reconnaissance vocale de Safari ou Chrome).
 */
import type { Level } from "@/lib/tcf";

const FEMALE =
  /am[ée]lie|audrey|aur[ée]lie|marie|julie|chantal|virginie|c[ée]line|l[ée]a|denise|sylvie|sandy|flo|jacqueline|helena|female|femme/i;

function frenchVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window))
    return [];
  const all = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("fr"));
  // Accent canadien d'abord, puis voix locales (meilleure qualité hors ligne).
  return all.sort(
    (a, b) =>
      Number(b.lang === "fr-CA") - Number(a.lang === "fr-CA") ||
      Number(b.localService) - Number(a.localService),
  );
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Les voix arrivent parfois après le chargement de la page (Chrome) : on attend un court instant. */
export function voicesReady(): Promise<void> {
  if (!canSpeak() || window.speechSynthesis.getVoices().length)
    return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    window.speechSynthesis.addEventListener("voiceschanged", done, {
      once: true,
    });
    setTimeout(done, 1500);
  });
}

const RATE: Record<Level, number> = {
  A1: 0.82,
  A2: 0.88,
  B1: 0.94,
  B2: 1,
  C1: 1.02,
  C2: 1.05,
};

/** Lit un document réplique par réplique, en alternant voix féminine et masculine si possible. */
export function speakTurns(
  turns: Array<{ voice: "f" | "m"; text: string }>,
  level: Level,
  onEnd: () => void,
): () => void {
  if (!canSpeak()) {
    onEnd();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = frenchVoices();
  const fem = voices.find((v) => FEMALE.test(v.name)) ?? voices[0];
  const masc = voices.find((v) => !FEMALE.test(v.name)) ?? voices[0];
  let cancelled = false;
  turns.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t.text);
    const v = t.voice === "f" ? fem : masc;
    if (v) u.voice = v;
    u.lang = v?.lang ?? "fr-FR";
    u.rate = RATE[level];
    // Même voix pour les deux locuteurs : on les distingue par la hauteur.
    if (fem === masc) u.pitch = t.voice === "f" ? 1.15 : 0.85;
    if (i === turns.length - 1) u.onend = () => !cancelled && onEnd();
    u.onerror = () => i === turns.length - 1 && !cancelled && onEnd();
    synth.speak(u);
  });
  return () => {
    cancelled = true;
    synth.cancel();
  };
}

// ---------------------------------------------------------------------------
// Reconnaissance vocale

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const canListen = () => !!ctor();

/**
 * Transcrit en continu jusqu'à l'appel de stop(). La reconnaissance s'interrompt d'elle-même après un
 * silence : on la relance tant que la prise de parole n'est pas terminée.
 */
export function listen(
  onText: (finalText: string, interim: string) => void,
  onError: (msg: string) => void,
): { stop: () => void } {
  const Ctor = ctor();
  if (!Ctor) {
    onError(
      "La dictée n'est pas disponible sur cet appareil : tapez votre réponse.",
    );
    return { stop: () => {} };
  }
  let finalText = "";
  let active = true;
  let rec: Recognition | null = null;
  const start = () => {
    rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = `${finalText} ${r[0].transcript}`.trim();
        else interim += r[0].transcript;
      }
      onText(finalText, interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        onError(
          "Le micro est bloqué. Autorisez-le dans Réglages › Safari › Microphone (et activez la dictée), ou tapez votre réponse.",
        );
      }
    };
    rec.onend = () => {
      if (active) setTimeout(() => active && start(), 150);
    };
    try {
      rec.start();
    } catch {
      /* déjà démarrée */
    }
  };
  start();
  return {
    stop: () => {
      active = false;
      rec?.stop();
    },
  };
}

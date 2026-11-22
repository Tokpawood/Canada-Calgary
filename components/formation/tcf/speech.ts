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
  // Voix de meilleure qualité d'abord (premium, améliorées, neuronales : à télécharger dans les Réglages
  // de l'iPad), puis l'accent canadien, puis les voix locales.
  const quality = (v: SpeechSynthesisVoice) =>
    /premium/i.test(`${v.name} ${v.voiceURI}`)
      ? 3
      : /enhanced|am[ée]lior|neural|natural|siri/i.test(
            `${v.name} ${v.voiceURI}`,
          )
        ? 2
        : 0;
  return all.sort(
    (a, b) =>
      quality(b) - quality(a) ||
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

/**
 * Débloque la voix sur iPad : Safari ne parle que si la première lecture part directement d'un toucher.
 * À appeler dans le gestionnaire du clic (« Lancer le chronomètre », « Écouter »), sans attente avant.
 */
export function unlockSpeech() {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.resume();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  synth.speak(u);
}

/** Découpe en phrases : Safari et Chrome interrompent parfois les lectures longues sans prévenir. */
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Gardées en mémoire tant qu'elles sont lues : sinon Safari peut les libérer et ne jamais finir.
let live: SpeechSynthesisUtterance[] = [];

/**
 * Lit un document réplique par réplique, en alternant voix féminine et masculine si possible.
 * Appelle onStart quand le son démarre vraiment, onFail si rien ne démarre en 6 secondes,
 * onEnd à la fin (au plus tard après la durée estimée de lecture, pour ne jamais rester bloqué).
 */
export function speakTurns(
  turns: Array<{ voice: "f" | "m"; text: string }>,
  level: Level,
  cb: { onStart?: () => void; onEnd: () => void; onFail?: () => void },
): () => void {
  if (!canSpeak()) {
    cb.onFail?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  synth.resume();
  const voices = frenchVoices();
  const fem = voices.find((v) => FEMALE.test(v.name)) ?? voices[0];
  const masc = voices.find((v) => !FEMALE.test(v.name)) ?? voices[0];
  let state: "attente" | "lecture" | "fini" = "attente";
  const timers: {
    start?: ReturnType<typeof setTimeout>;
    end?: ReturnType<typeof setTimeout>;
  } = {};
  const finish = (ok: boolean) => {
    if (state === "fini") return;
    const started = state === "lecture";
    state = "fini";
    clearTimeout(timers.start);
    clearTimeout(timers.end);
    live = [];
    if (ok || started) cb.onEnd();
    else cb.onFail?.();
  };
  const chunks = turns.flatMap((t) =>
    sentences(t.text).map((text) => ({ voice: t.voice, text })),
  );
  const words = chunks.reduce((n, c) => n + c.text.split(/\s+/).length, 0);
  // Environ 2,6 mots par seconde à vitesse normale, plus une marge.
  const expected = (words / (2.6 * RATE[level])) * 1000 + chunks.length * 400;
  live = chunks.map((c, i) => {
    const u = new SpeechSynthesisUtterance(c.text);
    const v = c.voice === "f" ? fem : masc;
    if (v) u.voice = v;
    u.lang = v?.lang ?? "fr-FR";
    u.rate = RATE[level];
    // Même voix pour les deux locuteurs : on les distingue par la hauteur.
    if (fem === masc) u.pitch = c.voice === "f" ? 1.15 : 0.85;
    u.onstart = () => {
      if (state === "attente") {
        state = "lecture";
        clearTimeout(timers.start);
        cb.onStart?.();
      }
    };
    if (i === chunks.length - 1) u.onend = () => finish(true);
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      if (i === chunks.length - 1) finish(state === "lecture");
    };
    return u;
  });
  for (const u of live) synth.speak(u);
  timers.start = setTimeout(() => {
    if (state === "attente") {
      synth.cancel();
      finish(false);
    }
  }, 6000);
  timers.end = setTimeout(() => finish(true), expected * 1.6 + 15_000);
  return () => {
    state = "fini";
    clearTimeout(timers.start);
    clearTimeout(timers.end);
    live = [];
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

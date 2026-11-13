import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

/** Sans RESEND_API_KEY (cas par défaut avant déploiement), le rappel est simplement journalisé comme non envoyé. */
export async function sendReminderEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const resend = getClient();
  if (!resend) return { sent: false, reason: "RESEND_API_KEY non configurée" };

  const from = process.env.RESEND_FROM || "Projet Canada Calgary <rappels@example.com>";
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}

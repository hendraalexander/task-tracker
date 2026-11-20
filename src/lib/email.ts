import "server-only";

/**
 * Transactional email.
 *
 * MVP ships without a provider: messages are logged so verification, reset,
 * and invitation flows are fully testable locally. Wire Resend/SES by setting
 * RESEND_API_KEY — the call sites and templates stay unchanged.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`\n[email:dev] to=${input.to} subject="${input.subject}"\n${input.text}\n`);
    return { delivered: false as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "A Tracker <no-reply@atracker.app>",
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<p>${input.text.replace(/\n/g, "<br/>")}</p>`,
      }),
    });
    return { delivered: res.ok as boolean };
  } catch (error) {
    console.error("[email] delivery failed", error);
    return { delivered: false as const };
  }
}

export function appUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

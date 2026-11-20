import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

type NotifyKind = "ASSIGNMENT" | "MENTION" | "COMMENT" | "DUE_DATE" | "INVITATION" | "BILLING";

const prefKey: Record<NotifyKind, "assignmentEmail" | "mentionEmail" | "commentEmail" | "dueDateEmail" | "digestEmail" | "inApp" | null> = {
  ASSIGNMENT: "assignmentEmail",
  MENTION: "mentionEmail",
  COMMENT: "commentEmail",
  DUE_DATE: "dueDateEmail",
  INVITATION: null,
  BILLING: null,
};

/**
 * Fan-out notification to workspace members.
 * In-app rows respect the user's in-app preference; email respects category prefs.
 */
export async function notifyUsers(input: {
  userIds: string[];
  actorId?: string;
  workspaceId: string;
  type: NotifyKind;
  title: string;
  body?: string;
  url?: string;
  payload?: Record<string, unknown>;
  emailText?: string;
}) {
  const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  if (!recipients.length) return;

  const users = await prisma.user.findMany({
    where: { id: { in: recipients }, deletedAt: null },
    select: { id: true, email: true, name: true, notificationPreference: true },
  });

  const key = prefKey[input.type];

  for (const user of users) {
    const pref = user.notificationPreference;
    const inApp = pref?.inApp ?? true;
    if (inApp) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          workspaceId: input.workspaceId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          url: input.url ?? null,
          payload: (input.payload ?? undefined) as never,
        },
      });
    }

    const emailEnabled = key ? (pref?.[key] ?? true) : true;
    if (emailEnabled) {
      await sendEmail({
        to: user.email,
        subject: input.title,
        text: `${input.title}\n\n${input.emailText ?? input.body ?? ""}${
          input.url ? `\n\n${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${input.url}` : ""
        }`,
      });
    }
  }
}

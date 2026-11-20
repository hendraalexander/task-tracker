import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/access";
import { normalizeLocale } from "@/lib/i18n";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const [user, prefs, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.user.id } }),
    prisma.notificationPreference.findUnique({ where: { userId: ctx.user.id } }),
    prisma.session.findMany({
      where: { userId: ctx.user.id, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: 10,
    }),
  ]);

  if (!user) return null;

  return (
    <ProfileForm
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        timezone: user.timezone,
        dateFormat: user.dateFormat,
        theme: user.theme,
        animations: user.animations,
        verified: !!user.emailVerified,
      }}
      prefs={{
        assignmentEmail: prefs?.assignmentEmail ?? true,
        mentionEmail: prefs?.mentionEmail ?? true,
        commentEmail: prefs?.commentEmail ?? false,
        dueDateEmail: prefs?.dueDateEmail ?? true,
        digestEmail: prefs?.digestEmail ?? true,
        inApp: prefs?.inApp ?? true,
      }}
      sessions={sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ip: session.ip,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        current: session.id === ctx.user.sessionId,
      }))}
      locale={normalizeLocale(user.locale)}
    />
  );
}

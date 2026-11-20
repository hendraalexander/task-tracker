import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceForm, ProjectForm, InviteTeamForm } from "@/components/onboarding/forms";
import { VerifyEmailBanner } from "@/components/auth/verify-banner";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; w?: string; p?: string; verify?: string; new?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const locale = await getRequestLocale();
  const t = makeT(locale);

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  let workspace = params.w ? memberships.find((m) => m.workspace.slug === params.w)?.workspace : undefined;
  let step = Number(params.step ?? 1);
  if (![1, 2, 3].includes(step)) step = 1;

  if (step >= 2) {
    if (!workspace) {
      workspace = memberships[0]?.workspace;
      if (!workspace) redirect("/onboarding?step=1");
    }
  }
  if (step === 3 && !workspace) redirect("/onboarding?step=1");

  const account = await prisma.user.findUnique({ where: { id: user.id } });

  const steps = [
    { n: 1, label: t("onboarding.step1") },
    { n: 2, label: t("onboarding.step2") },
    { n: 3, label: t("onboarding.step3") },
  ];

  const title =
    step === 1 ? t("onboarding.step1") : step === 2 ? t("onboarding.step2") : t("onboarding.step3");

  return (
    <AuthShell locale={locale} title={t("onboarding.title")} subtitle={t("onboarding.subtitle")}>
      <div className="mb-6 flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                s.n < step
                  ? "bg-emerald-500 text-white"
                  : s.n === step
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-muted-foreground",
              )}
            >
              {s.n < step ? <CheckCircle size={14} weight="fill" /> : s.n}
            </div>
            <span className={cn("hidden text-[11px] font-medium sm:block", s.n === step ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {!account?.emailVerified && <VerifyEmailBanner locale={locale} />}

      {params.verify && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          {locale === "id"
            ? "Akun dibuat. Cek email verifikasi (di mode dev, tautan tampil di console server)."
            : "Account created. Check your verification email (dev mode logs the link to the server console)."}
        </div>
      )}

      <Card className="p-5">
        <h3 className="mb-4 text-[15px] font-semibold">{title}</h3>

        {step === 1 && (
          <>
            <WorkspaceForm />
            <Link
              href="/welcome"
              className="mt-3 block text-center text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              {t("onboarding.skipForNow")} →
            </Link>
            {memberships.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {locale === "id" ? "Workspace Anda" : "Your workspaces"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {memberships.map((m) => (
                    <Link
                      key={m.id}
                      href={`/w/${m.workspace.slug}/home`}
                      className="rounded-lg border border-border px-2 py-1 text-xs transition hover:bg-surface-muted"
                    >
                      {m.workspace.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && workspace && (
          <ProjectForm workspaceSlug={workspace.slug} />
        )}

        {step === 3 && workspace && (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-primary-soft/60 p-3 text-[12px] text-primary">
              <Sparkle size={15} className="mt-0.5 shrink-0" />
              {locale === "id"
                ? `Workspace ${workspace.name} siap. Undang tim sekarang atau lakukan nanti dari halaman Anggota.`
                : `Workspace ${workspace.name} is ready. Invite your team now or later from the Members page.`}
            </div>
            <InviteTeamForm
              workspaceSlug={workspace.slug}
              next={params.p ? `/w/${workspace.slug}/p/${params.p}/list` : `/w/${workspace.slug}/home`}
            />
          </>
        )}
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        {locale === "id" ? "Semua langkah dapat dilewati." : "Every step can be skipped."}
      </p>
    </AuthShell>
  );
}

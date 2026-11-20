import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export default async function IndexPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  redirect(membership ? `/w/${membership.workspace.slug}/home` : "/welcome");
}

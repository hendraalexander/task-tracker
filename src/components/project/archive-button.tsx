"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, Archive } from "@phosphor-icons/react";
import { Button } from "@/components/ui/primitives";
import { restoreProject, archiveProject } from "@/actions/project";
import { useT, useToast } from "@/components/providers";

export function ProjectArchiveButton({ projectId, archived }: { projectId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = archived ? await restoreProject(projectId) : await archiveProject(projectId);
          if (!res.ok) toast(res.error ?? t("common.error"), "error");
          else {
            toast(t("common.saved"));
            router.refresh();
          }
        })
      }
    >
      {archived ? <ArrowCounterClockwise size={14} /> : <Archive size={14} />}
      {archived ? t("projects.restore") : t("common.archive")}
    </Button>
  );
}

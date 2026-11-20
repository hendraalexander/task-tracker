"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag as TagIcon, Trash, Plus } from "@phosphor-icons/react";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { useT, useToast } from "@/components/providers";
import { createTag, deleteTag } from "@/actions/member";
import { TAG_COLORS } from "@/lib/utils";

export function TagsAdmin({
  workspaceSlug,
  tags,
}: {
  workspaceSlug: string;
  tags: { id: string; name: string; color: string; count: number }[];
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
          <TagIcon size={15} /> {t("settings.tagTitle")}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{t("settings.tagHint")}</p>

        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            startTransition(async () => {
              const res = await createTag(workspaceSlug, fd);
              if (!res.ok) toast(res.error ?? t("common.error"), "error");
              else {
                toast(t("common.saved"));
                form.reset();
              }
              router.refresh();
            });
          }}
        >
          <Field label={t("projects.name")} className="min-w-[180px] flex-1">
            <Input name="name" required placeholder="Design" />
          </Field>
          <Field label={t("projects.color")} className="w-[130px]">
            <Select name="color" defaultValue={TAG_COLORS[0]}>
              {TAG_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" size="md" loading={pending}>
            <Plus size={14} /> {t("common.add")}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
              style={{ background: `${tag.color}18`, color: tag.color }}
            >
              {tag.name}
              <span className="opacity-60">· {tag.count}</span>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await deleteTag(workspaceSlug, tag.id);
                    toast(t("common.saved"));
                    router.refresh();
                  })
                }
                className="cursor-pointer rounded-full p-0.5 opacity-60 transition hover:bg-black/5 hover:opacity-100"
                aria-label={t("common.delete")}
              >
                <Trash size={10} />
              </button>
            </span>
          ))}
          {tags.length === 0 && <p className="py-3 text-[12px] text-muted-foreground">{t("common.empty")}</p>}
        </div>
      </Card>
    </div>
  );
}

/**
 * Seed data for A Tracker.
 * Demo login: rina@atracker.test / Password123!
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const DAY = 86_400_000;
const now = new Date();
const at = (offsetDays: number, hour = 17) => {
  const d = new Date(now.getTime() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const passwordHash = await hash("Password123!");
  const userData = (name: string, email: string) => ({
    name,
    email,
    passwordHash,
    emailVerified: new Date(),
    locale: "id",
    timezone: "Asia/Jakarta",
  });

  const rina = await prisma.user.upsert({
    where: { email: "rina@atracker.test" },
    update: {},
    create: userData("Rina Pratama", "rina@atracker.test"),
  });
  const dimas = await prisma.user.upsert({
    where: { email: "dimas@atracker.test" },
    update: {},
    create: userData("Dimas Saputra", "dimas@atracker.test"),
  });
  const bagas = await prisma.user.upsert({
    where: { email: "bagas@atracker.test" },
    update: {},
    create: userData("Bagas Nugraha", "bagas@atracker.test"),
  });
  const sari = await prisma.user.upsert({
    where: { email: "sari@atracker.test" },
    update: {},
    create: userData("Sari Wijaya", "sari@atracker.test"),
  });
  const maya = await prisma.user.upsert({
    where: { email: "maya@atracker.test" },
    update: {},
    create: userData("Maya Anggraini", "maya@atracker.test"),
  });

  const ws = await prisma.workspace.upsert({
    where: { slug: "nusantara" },
    update: {},
    create: {
      name: "Nusantara Digital",
      slug: "nusantara",
      ownerId: rina.id,
      plan: "PRO",
      memberships: {
        create: [
          { userId: rina.id, role: "OWNER" },
          { userId: dimas.id, role: "ADMIN" },
          { userId: bagas.id, role: "MEMBER" },
          { userId: maya.id, role: "MEMBER" },
          { userId: sari.id, role: "GUEST" },
        ],
      },
      subscription: {
        create: {
          plan: "PRO",
          status: "ACTIVE",
          seats: 4,
          periodStart: at(-10),
          periodEnd: at(20),
          stripeCustomerId: "cus_demo_nusantara",
        },
      },
    },
  });

  const ws2 = await prisma.workspace.upsert({
    where: { slug: "studio-kecil" },
    update: {},
    create: {
      name: "Studio Kecil",
      slug: "studio-kecil",
      ownerId: rina.id,
      plan: "FREE",
      memberships: { create: [{ userId: rina.id, role: "OWNER" }] },
      subscription: { create: { plan: "FREE", status: "ACTIVE", seats: 1 } },
    },
  });

  // Clear dependent demo content so the seed is idempotent.
  await prisma.task.deleteMany({
    where: { project: { workspaceId: { in: [ws.id, ws2.id] } } },
  });
  await prisma.milestone.deleteMany({
    where: { project: { workspaceId: { in: [ws.id, ws2.id] } } },
  });
  await prisma.project.deleteMany({
    where: { workspaceId: { in: [ws.id, ws2.id] } },
  });
  await prisma.customField.deleteMany({ where: { project: { workspaceId: ws.id } } });
  await prisma.tag.deleteMany({ where: { workspaceId: { in: [ws.id, ws2.id] } } });
  await prisma.invoice.deleteMany({ where: { workspaceId: ws.id } });

  const tag = (name: string, color: string) => ({ workspaceId: ws.id, name, color });
  await prisma.tag.createMany({
    data: [
      tag("Design", "#8B5CF6"),
      tag("Engineering", "#2563EB"),
      tag("Marketing", "#F59E0B"),
      tag("Client", "#059669"),
      tag("Blocked", "#DC2626"),
    ],
  });
  const tags = await prisma.tag.findMany({ where: { workspaceId: ws.id } });
  const tagId = (name: string) => tags.find((t) => t.name === name)!.id;

  const website = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      name: "Redesign Website Klien",
      description:
        "Perombakan situs korporat Nusantara Digital: riset, desain, implementasi, dan peluncuran.",
      color: "#2563EB",
      icon: "browser",
      privacy: "PUBLIC",
      startDate: at(-21),
      dueDate: at(30),
      createdById: rina.id,
      position: 1000,
      members: {
        create: [
          { userId: rina.id, role: "PROJECT_ADMIN" },
          { userId: bagas.id },
          { userId: maya.id },
          { userId: sari.id },
        ],
      },
      customFields: {
        create: [
          { name: "Budget", type: "NUMBER", position: 0 },
          { name: "Klien", type: "TEXT", position: 1 },
          { name: "Tahap", type: "SINGLE_SELECT", options: ["Riset", "Desain", "Build", "Launch"], position: 2 },
          { name: "Perlu review klien", type: "CHECKBOX", position: 3 },
        ],
      },
      milestones: {
        create: [
          { name: "Wireframe disetujui", date: at(-7), createdBy: rina.id },
          { name: "Design system final", date: at(7), createdBy: rina.id },
          { name: "Peluncuran", date: at(30), createdBy: rina.id },
        ],
      },
    },
    include: { customFields: true, milestones: true },
  });

  const mobile = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      name: "Peluncuran Aplikasi Mobile",
      description: "Rilis v1 aplikasi mobile untuk pelanggan ritel. Fokus pada stabilitas dan onboarding.",
      color: "#059669",
      icon: "device-mobile",
      privacy: "PRIVATE",
      startDate: at(-14),
      dueDate: at(45),
      createdById: rina.id,
      position: 2000,
      members: {
        create: [
          { userId: rina.id, role: "PROJECT_ADMIN" },
          { userId: dimas.id },
          { userId: bagas.id },
        ],
      },
      customFields: {
        create: [
          { name: "Platform", type: "MULTI_SELECT", options: ["iOS", "Android"], position: 0 },
          { name: "Budget", type: "NUMBER", position: 1 },
        ],
      },
      milestones: {
        create: [
          { name: "Beta tertutup", date: at(14), createdBy: rina.id },
          { name: "Rilis publik", date: at(45), createdBy: rina.id },
        ],
      },
    },
    include: { customFields: true, milestones: true },
  });

  const campaign = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      name: "Kampanye Q4",
      description: "Kampanye akuisisi kuartal keempat: konten, iklan berbayar, dan webinar.",
      color: "#F59E0B",
      icon: "megaphone",
      privacy: "PUBLIC",
      startDate: at(-7),
      dueDate: at(21),
      createdById: dimas.id,
      position: 3000,
      members: {
        create: [
          { userId: dimas.id, role: "PROJECT_ADMIN" },
          { userId: rina.id },
          { userId: maya.id },
        ],
      },
      customFields: {
        create: [{ name: "Kanal", type: "SINGLE_SELECT", options: ["Instagram", "LinkedIn", "Email"], position: 0 }],
      },
      milestones: { create: [{ name: "Webinar besar", date: at(18), createdBy: dimas.id }] },
    },
    include: { customFields: true, milestones: true },
  });

  const archived = await prisma.project.create({
    data: {
      workspaceId: ws.id,
      name: "Riset Pasar 2026",
      description: "Arsip riset pasar yang sudah selesai.",
      color: "#64748B",
      privacy: "PUBLIC",
      archivedAt: at(-30),
      createdById: rina.id,
      position: 4000,
      members: { create: [{ userId: rina.id, role: "PROJECT_ADMIN" }] },
    },
  });

  const studioProject = await prisma.project.create({
    data: {
      workspaceId: ws2.id,
      name: "Portofolio Studio",
      description: "Perbarui portofolio dan halaman kontak.",
      color: "#2563EB",
      privacy: "PUBLIC",
      createdById: rina.id,
      members: { create: [{ userId: rina.id, role: "PROJECT_ADMIN" }] },
      customFields: { create: [{ name: "Budget", type: "NUMBER", position: 0 }] },
    },
  });

  type SeedTask = {
    title: string;
    description?: string;
    status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assigneeId?: string;
    startDate?: Date;
    dueDate?: Date;
    milestoneId?: string;
    position: number;
    completedAt?: Date;
    tags?: string[];
    subtasks?: { title: string; status: "TODO" | "IN_PROGRESS" | "DONE"; assigneeId?: string }[];
    fieldValues?: { fieldId: string; value: string }[];
  };

  const cfWebsite = Object.fromEntries(website.customFields.map((f) => [f.name, f.id]));
  const cfMobile = Object.fromEntries(mobile.customFields.map((f) => [f.name, f.id]));
  const cfCampaign = Object.fromEntries(campaign.customFields.map((f) => [f.name, f.id]));

  const websiteTasks: SeedTask[] = [
    {
      title: "Riset kompetitor dan audit konten",
      description: "Bandingkan 5 kompetitor utama, catat pola navigasi dan struktur konten.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: maya.id,
      startDate: at(-20),
      dueDate: at(-14),
      completedAt: at(-14),
      position: 1000,
      tags: ["Design", "Client"],
      fieldValues: [
        { fieldId: cfWebsite["Klien"], value: "PT Sinar Abadi" },
        { fieldId: cfWebsite["Budget"], value: "45000000" },
        { fieldId: cfWebsite["Tahap"], value: "Riset" },
      ],
    },
    {
      title: "Wireframe halaman utama",
      description: "Wireframe low-fidelity untuk home, layanan, dan kontak.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: bagas.id,
      startDate: at(-14),
      dueDate: at(-7),
      milestoneId: website.milestones[0].id,
      completedAt: at(-8),
      position: 2000,
      tags: ["Design"],
      fieldValues: [
        { fieldId: cfWebsite["Tahap"], value: "Desain" },
        { fieldId: cfWebsite["Budget"], value: "45000000" },
      ],
    },
    {
      title: "Design system: komponen dasar",
      description: "Token warna, tipografi, tombol, form, dan kartu.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: bagas.id,
      startDate: at(-6),
      dueDate: at(5),
      milestoneId: website.milestones[1].id,
      position: 3000,
      tags: ["Design"],
      subtasks: [
        { title: "Token warna & tipografi", status: "DONE", assigneeId: bagas.id },
        { title: "Tombol & form", status: "IN_PROGRESS", assigneeId: bagas.id },
        { title: "Kartu & navigasi", status: "TODO", assigneeId: maya.id },
      ],
      fieldValues: [
        { fieldId: cfWebsite["Tahap"], value: "Desain" },
        { fieldId: cfWebsite["Perlu review klien"], value: "true" },
      ],
    },
    {
      title: "Implementasi halaman layanan",
      description: "Bangun halaman layanan dari design system.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: maya.id,
      startDate: at(1),
      dueDate: at(12),
      position: 4000,
      tags: ["Engineering"],
      fieldValues: [{ fieldId: cfWebsite["Tahap"], value: "Build" }],
    },
    {
      title: "Review aksesibilitas",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: at(18),
      position: 5000,
      tags: ["Engineering"],
      subtasks: [
        { title: "Kontras teks", status: "TODO" },
        { title: "Navigasi keyboard", status: "TODO" },
      ],
      fieldValues: [{ fieldId: cfWebsite["Tahap"], value: "Build" }],
    },
    {
      title: "Siapkan peluncuran dan analitik",
      description: "Checklist go-live, redirect, sitemap, dan tracking.",
      status: "TODO",
      priority: "HIGH",
      dueDate: at(28),
      milestoneId: website.milestones[2].id,
      position: 6000,
      tags: ["Engineering", "Client"],
      fieldValues: [{ fieldId: cfWebsite["Tahap"], value: "Launch" }],
    },
    {
      title: "Kumpulkan aset foto klien",
      status: "IN_REVIEW",
      priority: "LOW",
      assigneeId: sari.id,
      dueDate: at(3),
      position: 7000,
      tags: ["Client"],
      fieldValues: [{ fieldId: cfWebsite["Klien"], value: "PT Sinar Abadi" }],
    },
  ];

  const mobileTasks: SeedTask[] = [
    {
      title: "Tentukan ruang lingkup rilis v1",
      status: "DONE",
      priority: "HIGH",
      assigneeId: rina.id,
      dueDate: at(-10),
      completedAt: at(-11),
      position: 1000,
      tags: ["Engineering"],
      fieldValues: [
        { fieldId: cfMobile["Platform"], value: '["iOS","Android"]' },
        { fieldId: cfMobile["Budget"], value: "180000000" },
      ],
    },
    {
      title: "Setup pipeline build iOS & Android",
      status: "IN_PROGRESS",
      priority: "URGENT",
      assigneeId: dimas.id,
      startDate: at(-3),
      dueDate: at(2),
      position: 2000,
      tags: ["Engineering"],
      subtasks: [
        { title: "Signing & provisioning", status: "DONE", assigneeId: dimas.id },
        { title: "Build Android", status: "IN_PROGRESS", assigneeId: dimas.id },
        { title: "Build iOS", status: "TODO", assigneeId: dimas.id },
      ],
      fieldValues: [{ fieldId: cfMobile["Platform"], value: '["iOS","Android"]' }],
    },
    {
      title: "Desain alur onboarding",
      status: "IN_REVIEW",
      priority: "HIGH",
      assigneeId: bagas.id,
      dueDate: at(6),
      position: 3000,
      tags: ["Design"],
      fieldValues: [{ fieldId: cfMobile["Platform"], value: '["Android"]' }],
    },
    {
      title: "Integrasi pembayaran",
      status: "TODO",
      priority: "HIGH",
      assigneeId: dimas.id,
      dueDate: at(20),
      milestoneId: mobile.milestones[0].id,
      position: 4000,
      tags: ["Engineering"],
      fieldValues: [{ fieldId: cfMobile["Platform"], value: '["iOS"]' }],
    },
    {
      title: "Uji beta tertutup dengan 25 pengguna",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: at(13),
      milestoneId: mobile.milestones[0].id,
      position: 5000,
      tags: ["Engineering"],
    },
  ];

  const campaignTasks: SeedTask[] = [
    {
      title: "Kalender konten November",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: maya.id,
      dueDate: at(4),
      position: 1000,
      tags: ["Marketing"],
      fieldValues: [{ fieldId: cfCampaign["Kanal"], value: "Instagram" }],
    },
    {
      title: "Landing page webinar",
      status: "TODO",
      priority: "HIGH",
      assigneeId: maya.id,
      dueDate: at(9),
      position: 2000,
      tags: ["Marketing"],
    },
    {
      title: "Brief iklan berbayar",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: dimas.id,
      dueDate: at(-2),
      position: 3000,
      tags: ["Marketing"],
      fieldValues: [{ fieldId: cfCampaign["Kanal"], value: "LinkedIn" }],
    },
    {
      title: "Email nurturing 3 seri",
      status: "DONE",
      priority: "MEDIUM",
      assigneeId: maya.id,
      dueDate: at(-5),
      completedAt: at(-4),
      position: 4000,
      tags: ["Marketing"],
    },
    {
      title: "Cek performa kampanye mingguan",
      status: "TODO",
      priority: "LOW",
      assigneeId: rina.id,
      dueDate: at(1),
      milestoneId: campaign.milestones[0].id,
      position: 5000,
    },
  ];

  const created: Record<string, string> = {};

  for (const [project, list] of [
    [website, websiteTasks],
    [mobile, mobileTasks],
    [campaign, campaignTasks],
  ] as const) {
    for (const t of list) {
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description,
          status: t.status ?? "TODO",
          priority: t.priority ?? "MEDIUM",
          assignees: t.assigneeId ? { create: [{ userId: t.assigneeId }] } : undefined,
          startDate: t.startDate,
          dueDate: t.dueDate,
          milestoneId: t.milestoneId,
          position: t.position,
          completedAt: t.completedAt,
          createdById: rina.id,
          tags: t.tags ? { create: t.tags.map((name) => ({ tagId: tagId(name) })) } : undefined,
          fieldValues: t.fieldValues ? { create: t.fieldValues } : undefined,
        },
      });
      created[t.title] = task.id;

      if (t.subtasks) {
        let i = 0;
        for (const s of t.subtasks) {
          i += 1;
          await prisma.task.create({
            data: {
              projectId: project.id,
              parentTaskId: task.id,
              title: s.title,
              status: s.status,
              priority: "MEDIUM",
              assignees: s.assigneeId ? { create: [{ userId: s.assigneeId }] } : undefined,
              position: i * 1000,
              createdById: rina.id,
              completedAt: s.status === "DONE" ? at(-2) : null,
            },
          });
        }
      }
    }
  }

  // Multi-assignee demo: a couple of tasks owned by two people.
  await prisma.task.update({
    where: { id: created["Design system: komponen dasar"] },
    data: { assignees: { create: [{ userId: maya.id }] } },
  });
  await prisma.task.update({
    where: { id: created["Siapkan peluncuran dan analitik"] },
    data: { assignees: { create: [{ userId: dimas.id }, { userId: bagas.id }] } },
  });

  // Dependencies (finish-to-start), consistent, no cycles.
  await prisma.taskDependency.createMany({
    data: [
      { taskId: created["Implementasi halaman layanan"], blockedByTaskId: created["Design system: komponen dasar"] },
      { taskId: created["Siapkan peluncuran dan analitik"], blockedByTaskId: created["Implementasi halaman layanan"] },
      { taskId: created["Uji beta tertutup dengan 25 pengguna"], blockedByTaskId: created["Integrasi pembayaran"] },
      { taskId: created["Landing page webinar"], blockedByTaskId: created["Kalender konten November"] },
    ],
  });

  // Comments + mentions
  const designTask = created["Design system: komponen dasar"];
  await prisma.comment.create({
    data: {
      taskId: designTask,
      authorId: bagas.id,
      body: "Token warna sudah siap. @Rina Pratama mohon cek kontras untuk tombol sekunder.",
      createdAt: new Date(now.getTime() - 2 * DAY),
    },
  });
  await prisma.comment.create({
    data: {
      taskId: designTask,
      authorId: rina.id,
      body: "Kontras aman. Lanjut ke form, jangan lupa state error.",
      createdAt: new Date(now.getTime() - 1 * DAY),
    },
  });
  await prisma.comment.create({
    data: {
      taskId: created["Brief iklan berbayar"],
      authorId: dimas.id,
      body: "Budget iklan menunggu approval. Sementara pakai angka placeholder.",
      createdAt: new Date(now.getTime() - 3 * DAY),
    },
  });

  // Activity log
  await prisma.activityLog.createMany({
    data: [
      {
        workspaceId: ws.id,
        projectId: website.id,
        taskId: designTask,
        actorId: bagas.id,
        action: "status_changed",
        field: "status",
        fromValue: "TODO",
        toValue: "IN_PROGRESS",
        createdAt: new Date(now.getTime() - 2 * DAY),
      },
      {
        workspaceId: ws.id,
        projectId: website.id,
        taskId: designTask,
        actorId: rina.id,
        action: "comment_created",
        createdAt: new Date(now.getTime() - 1 * DAY),
      },
      {
        workspaceId: ws.id,
        projectId: mobile.id,
        taskId: created["Setup pipeline build iOS & Android"],
        actorId: dimas.id,
        action: "status_changed",
        field: "status",
        fromValue: "TODO",
        toValue: "IN_PROGRESS",
        createdAt: new Date(now.getTime() - 1 * DAY),
      },
    ],
  });

  // Notifications for Rina & Bagas
  await prisma.notification.createMany({
    data: [
      {
        userId: rina.id,
        workspaceId: ws.id,
        type: "MENTION",
        title: "Bagas menyebut Anda",
        body: "Token warna sudah siap. Mohon cek kontras tombol sekunder.",
        url: `/w/${ws.slug}/p/${website.id}/list?task=${designTask}`,
        createdAt: new Date(now.getTime() - 2 * DAY),
      },
      {
        userId: rina.id,
        workspaceId: ws.id,
        type: "ASSIGNMENT",
        title: "Task di-assign ke Anda",
        body: "Cek performa kampanye mingguan",
        url: `/w/${ws.slug}/p/${campaign.id}/list`,
        createdAt: new Date(now.getTime() - 4 * 3600_000),
      },
      {
        userId: bagas.id,
        workspaceId: ws.id,
        type: "COMMENT",
        title: "Komentar baru di Design system",
        body: "Rina: Kontras aman. Lanjut ke form.",
        url: `/w/${ws.slug}/p/${website.id}/list?task=${designTask}`,
        readAt: new Date(now.getTime() - 12 * 3600_000),
        createdAt: new Date(now.getTime() - 1 * DAY),
      },
    ],
  });

  await prisma.notificationPreference.upsert({
    where: { userId: rina.id },
    update: {},
    create: { userId: rina.id },
  });

  // Invoices for billing page
  await prisma.invoice.createMany({
    data: [
      {
        workspaceId: ws.id,
        number: "INV-2026-0042",
        amountCents: 3200,
        status: "paid",
        periodStart: at(-40),
        periodEnd: at(-10),
        createdAt: at(-40),
      },
      {
        workspaceId: ws.id,
        number: "INV-2026-0061",
        amountCents: 3200,
        status: "paid",
        periodStart: at(-10),
        periodEnd: at(20),
        createdAt: at(-10),
      },
    ],
  });

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: ws.id,
        actorId: rina.id,
        action: "member_invited",
        targetType: "invitation",
        targetId: maya.id,
        metadata: { email: maya.email, role: "MEMBER" },
        createdAt: at(-20),
      },
      {
        workspaceId: ws.id,
        actorId: dimas.id,
        action: "role_changed",
        targetType: "membership",
        targetId: bagas.id,
        metadata: { from: "VIEWER", to: "MEMBER" },
        createdAt: at(-6),
      },
    ],
  });

  // A couple of tasks in the second workspace so switcher shows isolation.
  await prisma.task.create({
    data: {
      projectId: studioProject.id,
      title: "Tulis studi kasus proyek retail",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignees: { create: [{ userId: rina.id }] },
      dueDate: at(8),
      createdById: rina.id,
    },
  });
  await prisma.task.create({
    data: {
      projectId: studioProject.id,
      title: "Update halaman kontak",
      status: "TODO",
      priority: "LOW",
      dueDate: at(14),
      createdById: rina.id,
    },
  });

  console.log("Seed complete.");
  console.log("  Workspace:", ws.slug, "| Projects:", 4, "(1 archived)");
  console.log("  Users: rina@atracker.test, dimas@atracker.test, bagas@atracker.test, sari@atracker.test, maya@atracker.test");
  console.log("  Password: Password123!");
  console.log("  Archived demo project:", archived.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

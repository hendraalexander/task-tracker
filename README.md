# A Tracker

Project tracker multi-tenant untuk tim 5–50 orang — dibangun dari PRD `vodyanoy/PRD.md` (A Tracker v1.0).

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL 16 · Prisma 6 · Tailwind CSS 4 · Argon2id · JWT session cookie**.

---

## Jalankan

> Gunakan `127.0.0.1`, bukan `localhost`, pada `DATABASE_URL`. Di Windows, `localhost` bisa resolve ke IPv6 `::1` sementara Docker mem-bind IPv4.


```bash
npm install
docker compose up -d db        # Postgres di 127.0.0.1:5433 (container atracker-db)
npx prisma migrate deploy     # membuat skema dari prisma/migrations
npm run db:seed
npm run dev
```

Buka http://localhost:3000.

### Akun demo (setelah seed)

| Email | Password | Peran |
|---|---|---|
| `rina@atracker.test` | `Password123!` | Owner “Nusantara Digital” (Pro) |
| `dimas@atracker.test` | `Password123!` | Admin |
| `bagas@atracker.test` | `Password123!` | Member |
| `maya@atracker.test` | `Password123!` | Member |
| `sari@atracker.test` | `Password123!` | Guest (hanya 1 project) |

Workspace kedua: `studio-kecil` (Free) — untuk menguji isolasi tenant dan paket.

Seed membuat 4 project (1 arsip), task/subtask, dependency, milestone, custom field, tag, komentar, notifikasi, invoice, dan audit log.

### Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build + type check |
| `npm run db:up` / `db:down` | Postgres container |
| `npm run db:deploy` | Terapkan migration (produksi/CI) |
| `npm run db:push` | Sinkron skema cepat saat prototipe |
| `npm run db:seed` | Reset data demo (idempoten) |
| `npm run db:studio` | Prisma Studio |

---

## Cakupan MVP

**Sudah berjalan**

- **Auth**: signup/login/logout, validasi password umum, Argon2id, rate limit 10/menit + lockout 15 menit, verifikasi email (token 24 jam), reset password (token 60 menit, sekali pakai), sesi 30 hari httpOnly, daftar sesi + revoke, hapus akun (soft delete + anonimisasi).
- **Workspace**: multi-tenant, logo workspace (upload PNG/JPG/WebP/GIF, hapus), buat/switch workspace, onboarding 3 langkah (setiap langkah bisa dilewati; halaman `/welcome` untuk memulai tanpa workspace), undang anggota (token 7 hari, resend/revoke), role Owner/Admin/Member/Guest/Viewer, seat & limit per paket, audit log.
- **Project**: CRUD, public/private, arsip + restore, hapus dengan konfirmasi nama, milestone, project member (Project Admin), share link + undang guest.
- **Task**: CRUD, **multi-assignee** (semua anggota aktif workspace, guest dibatasi project), **subtask bersarang tanpa batas** (assignable di setiap level, progress per cabang), status default 4, prioritas 4, tanggal, milestone, tag, custom field, attachment (25 MB/file, 10/task, preview gambar/PDF), dependency finish-to-start + deteksi siklus (termasuk relasi parent/child) + peringatan task terblokir, soft delete 30 hari (data), activity log.
- **Home**: "My Tasks" menggabungkan overdue/today/upcoming dari task **dan subtask semua level**, dengan label parent subtask.
- **Views**: List (filter kombinasi, sort, grouping, inline edit, quick add), Board (drag & drop antar status), Calendar (bulan, klik tanggal = buat task), Timeline (zoom minggu/bulan, bar, milestone, today marker, garis dependency), Dashboard project (completion, distribusi status, overdue, workload, tren 8 minggu).
- **Kolaborasi**: komentar + edit/delete, @mention (notifikasi in-app + email), activity log per task, notifikasi in-app + badge + halaman notifikasi, preferensi notifikasi per kategori.
- **Search**: global (task/project/orang) dengan filter permission, command palette `Ctrl/Cmd + K` / `/`.
- **Billing**: Free/Pro/Business, upgrade/downgrade (simulasi Stripe), trial Pro 14 hari, seat sync, enforcement limit, invoice printable, mode read-only saat melewati limit.
- **i18n & UX**: ID/EN (cookie + preferensi user), timezone + format tanggal, dark mode, **animasi + toggle on/off di Profil**, keyboard nav, focus ring, kontras AA, skeleton loading, empty/error state, responsif 360–1920 px.
- **Profil**: ganti foto profil (PNG/JPG/WebP/**GIF animasi**, maks 5 MB), hapus foto, sesi aktif, preferensi notifikasi.

**Sengaja ditunda / disimulasikan (sesuai non-goals + keterbatasan environment)**

| Item | Status |
|---|---|
| Stripe Checkout & webhook | **Stub**. Alur plan berjalan lokal; titik integrasi ada di `src/actions/billing.ts`. |
| Email transaksional | **Stub**. Tanpa `RESEND_API_KEY`, link verifikasi/reset/undangan ditulis ke console + ditampilkan sebagai dev link di UI. |
| Lampiran S3 | Lokal di `public/uploads`. Produksi: ganti `uploadAttachment` ke S3 + signed URL. |
| Google OAuth | Belum (Should). |
| Bulk action, Trash UI, duplikasi task | Belum (Should/Could). Data soft-delete tersedia, restore belum punya halaman. |
| Digest harian, scan malware, 2FA/SSO, API publik, integrasi | Fase 2 (sesuai PRD). |
| PDF invoice | Halaman invoice printable (`Cetak / simpan PDF`) — bukan generator PDF server. |

---

## Arsitektur

```
src/
├─ app/
│  ├─ (auth)/            login, signup, forgot/reset, verify-email
│  ├─ onboarding/        workspace → project → invite
│  ├─ invite/[token]/    penerimaan undangan
│  ├─ w/[slug]/          shell workspace (sidebar, topbar, command palette)
│  │  ├─ home/           My Tasks + ringkasan
│  │  ├─ projects/       daftar project + arsip
│  │  ├─ notifications/
│  │  ├─ search/
│  │  ├─ settings/       members, billing, profile, tags, invoice
│  │  └─ p/[projectId]/  list, board, calendar, timeline, dashboard, settings
├─ actions/              server actions (auth, project, task, member, billing, search)
├─ components/           UI primitives, shell, views, drawer, settings
└─ lib/                  db, auth, access (tenant guard), views, i18n, notify, email
prisma/
├─ schema.prisma         model data lengkap + index sesuai PRD
└─ seed.ts               data demo realistis
```

**Performa**: request-scoped dedupe (`React cache`) untuk session/workspace/project/task, `staleTimes` untuk router cache, dan skeleton `loading.tsx` per segmen. Jalankan `npm run build && npm start` untuk mengukur performa produksi (dev server mengompilasi route saat pertama dibuka).

**Isolasi tenant**: setiap server action memanggil `requireWorkspace` / `requireProject` / `requireTask` (`src/lib/access.ts`) yang memvalidasi sesi, membership workspace, dan akses project sebelum query/mutasi. Guest hanya bisa melihat project tempat ia diundang, berkomentar, dan mengubah status task yang di-assign. Role write dibatasi Owner/Admin/Member; Viewer read-only; workspace `readOnly` memblokir seluruh mutasi.

**Index**: `tasks(projectId,status)`, `tasks(projectId,dueDate)`, `tasks(projectId,position)`, `TaskAssignee(userId)`, `comments(task_id,created_at)`, `notifications(user_id,read_at)`, plus index tenant di setiap tabel.

---

## Variabel lingkungan

Lihat `.env.example`. Wajib: `DATABASE_URL`, `AUTH_SECRET` (32+ karakter di produksi). Opsional: `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_*`, `NEXT_PUBLIC_APP_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`.

## Riwayat skema

- `0001_init` — skema awal.
- `0002_multi_assignee_nested` — pindah `Task.assigneeId` ke tabel join `TaskAssignee` (backfill otomatis), lalu multi-assignee + subtask tanpa batas kedalaman.
- `0003_user_animations` — preferensi animasi per user.

Catatan: PRD awal menyebut satu assignee dan subtask 2 level. Atas permintaan product, implementasi memakai multi-assignee lintas anggota workspace dan subtask tanpa batas.

## Deployment

- Docker: `Dockerfile` (multi-stage, standalone output) + `docker-compose.staging.yml` / `docker-compose.prod.yml`.
- Reverse proxy: `deploy/nginx/atracker-staging.conf` / `atracker-production.conf`.
- Health check: `GET /api/health` (app + database).
- Panduan langkah demi langkah: [`deploy_staging.md`](deploy_staging.md) dan [`deploy_prod.md`](deploy_prod.md).

## Catatan produksi

- Ganti `AUTH_SECRET`, jalankan di HTTPS (cookie `Secure` otomatis saat `NODE_ENV=production`).
- Jalankan `prisma migrate deploy`, bukan `db push`.
- Object storage + antivirus scan untuk lampiran sebelum membuka akses publik.
- Pasang Sentry/OTel, health check, dan backup harian (RPO 24 jam / RTO 4 jam).
- `npm run build` sudah lolos type check; tidak ada `middleware.ts` — otorisasi dilakukan di server layer, bukan hanya UI.

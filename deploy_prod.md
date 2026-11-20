# Deploy Production — A Tracker

Panduan ini untuk server production A Tracker: **satu VPS Ubuntu 24.04**, **Docker Compose**, **Nginx + Let's Encrypt**, dan **PostgreSQL terkelola** (bukan container database). Staging sudah dijelaskan di `deploy_staging.md`.

> **Penting sebelum go-live:** baca bagian **Kesiapan fitur** di bawah. Billing Stripe masih simulasi, email memerlukan Resend, dan halaman legal (Privacy/ToS/Cookie) belum tersedia. Jangan menjual paket berbayar atau membuka pendaftaran publik sebelum item tersebut selesai.

Arsitektur:

```text
Internet
  │ HTTPS (Nginx + Let's Encrypt)
  ▼
Nginx ── /uploads/* ──► /srv/atracker/data/uploads
  │
  └── proxy 127.0.0.1:3000 ──► container atracker-prod-app
                                  │
                                  └── TLS ──► PostgreSQL terkelola (backup + PITR)
```

File deploy:

| File | Fungsi |
|---|---|
| `Dockerfile` | Build standalone Next.js + image migrator. |
| `docker-compose.prod.yml` | App + job migrasi (tanpa DB container). |
| `deploy/nginx/atracker-production.conf` | Nginx, TLS termination, `/uploads`, `/healthz`. |
| `.env.example` | Referensi environment variable. |
| `/api/health` | Health check app + koneksi database. |

---

## 1. Prasyarat

| Item | Rekomendasi |
|---|---|
| VPS | 4 vCPU, 8 GB RAM, 80–100 GB NVMe, Ubuntu 24.04 LTS |
| Database | PostgreSQL 16 terkelola, backup otomatis + PITR |
| Domain | `app.atracker.app` (atau domain final) |
| Email | Resend (domain terverifikasi, SPF/DKIM/DMARC) |
| Akses | SSH key, DNS, password manager, Git repo |
| Monitoring | Uptime monitor eksternal + email/Slack alert |

Server staging dan production **harus terpisah**, termasuk database dan secret.

Buat DNS:

| Type | Name | Value |
|---|---|---|
| A | `app` | `<IP_PRODUCTION>` |
| A | `www` | `<IP_PRODUCTION>` (opsional, redirect ke apex) |

Cek propagasi:

```bash
dig +short app.atracker.app
```

---

## 2. Siapkan PostgreSQL terkelola

Langkah umum (nama menu berbeda per provider: RDS, Cloud SQL, Neon, Supabase, DO Managed DB, dll.):

1. Buat instance **PostgreSQL 16** di region terdekat pengguna (Singapore/Jakarta bila tersedia).
2. Buat database `atracker`.
3. Buat user aplikasi `atracker` dengan password kuat. **Bukan** superuser.
4. Wajibkan TLS (`sslmode=require` atau `verify-full`).
5. Batasi akses jaringan hanya dari IP production (`/32`). Jangan buka `0.0.0.0/0`.
6. Aktifkan **automated daily backup** dan **point-in-time recovery**. Retensi minimum 30 hari.
7. Catat connection string, contoh:

```text
postgresql://atracker:<PASSWORD_URL_ENCODED>@<DB_HOST>:5432/atracker?schema=public&sslmode=require&connection_limit=10
```

8. Uji dari server production:

```bash
psql "$DATABASE_URL" -c "select version();"
```

Catatan:

- Jika memakai connection pooler (PgBouncer/Supabase pooler), tambahkan parameter sesuai provider, mis. `?pgbouncer=true&connection_limit=10`. Uji migration lewat koneksi direktif (port direct), bukan pooler transaction mode.
- Simpan password di password manager. Jangan pernah commit.
- Catat prosedur restore provider — akan dipakai saat drill dan insiden.

---

## 3. Hardening server

Login root, buat user deploy, lalu login dengan SSH key:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys   # tempel public key
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Uji login `deploy` di terminal baru. Setelah berhasil:

```bash
timedatectl set-timezone Asia/Jakarta
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg git unzip htop
dpkg-reconfigure -plow unattended-upgrades

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status

systemctl enable --now fail2ban
```

Amankan SSH (`/etc/ssh/sshd_config`) setelah key login terverifikasi:

```text
PasswordAuthentication no
PermitRootLogin no
```

```bash
systemctl reload ssh
```

Jika provider punya cloud firewall, aktifkan juga dan batasi port 22/80/443.

Swap 2–4 GB untuk build image:

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 4. Install Docker

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
systemctl enable --now docker
```

Logout/login sebagai `deploy`, lalu verifikasi `docker compose version`.

---

## 5. Kode, environment, dan storage

```bash
sudo mkdir -p /srv/atracker
sudo chown deploy:deploy /srv/atracker
git clone <REPO_URL> /srv/atracker
cd /srv/atracker

mkdir -p data/uploads
sudo chown -R 1001:1001 data/uploads
sudo chmod 755 data/uploads
```

Buat `.env.production`:

```bash
nano .env.production
chmod 600 .env.production
```

Isi:

```dotenv
DATABASE_URL="postgresql://atracker:<PASSWORD_URL_ENCODED>@<DB_HOST>:5432/atracker?schema=public&sslmode=require&connection_limit=10"

AUTH_SECRET=<HASIL_OPENSSL_RAND_BASE64_48>
SESSION_TTL_DAYS=30

NEXT_PUBLIC_APP_URL="https://app.atracker.app"

UPLOAD_DIR="public/uploads"
MAX_UPLOAD_MB=25

RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"
EMAIL_FROM="A Tracker <no-reply@atracker.app>"

STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO=""
STRIPE_PRICE_BUSINESS=""
```

Aturan secret:

- `AUTH_SECRET` production **berbeda** dari staging; generate baru: `openssl rand -base64 48`.
- Ganti `AUTH_SECRET` = semua sesi lama logout (JWT invalid). Lakukan saat maintenance window.
- Rotasi password DB lewat provider, update `.env.production`, lalu `docker compose ... up -d app`.
- File hanya boleh dibaca user deploy. Jangan masukkan ke image/Git.
- `NEXT_PUBLIC_APP_URL` harus persis URL publik; dipakai untuk link verifikasi, reset, dan undangan.
- `STRIPE_*` sengaja kosong sampai integrasi Stripe selesai (lihat bagian 9).

---

## 6. Build, migrasi, dan jalankan

Dari `/srv/atracker`:

```bash
# Snapshot database dulu jika provider mendukung (wajib sebelum migration baru)
# Contoh: buat manual snapshot/backup di dashboard provider.

# 1) Build image (container lama tetap melayani)
docker compose -f docker-compose.prod.yml build app

# 2) Terapkan migration
docker compose -f docker-compose.prod.yml --profile tools run --rm --build migrate

# 3) Recreate app
docker compose -f docker-compose.prod.yml up -d app

# 4) Verifikasi
curl -fsS http://127.0.0.1:3000/api/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

**Jangan jalankan `db:seed` di production.** Production dimulai kosong: buat akun Owner pertama via `/signup`, verifikasi email, buat workspace.

Health yang benar:

```json
{"status":"ok","database":"up","time":"..."}
```

Jika `database: down`: cek `DATABASE_URL`, SSL, allowlist IP, dan status instance DB.

---

## 7. Nginx, TLS, dan HSTS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx

sudo cp deploy/nginx/atracker-production.conf /etc/nginx/sites-available/atracker-production
sudo ln -s /etc/nginx/sites-available/atracker-production /etc/nginx/sites-enabled/atracker-production
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Sesuaikan:

- `server_name` → domain production.
- `alias /uploads/` → `/srv/atracker/data/uploads/` (default).
- `proxy_pass` → `127.0.0.1:3000`.
- `client_max_body_size 30m`.

TLS:

```bash
sudo certbot --nginx -d app.atracker.app --redirect
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Setelah HTTPS stabil minimal beberapa hari, aktifkan HSTS di blok 443:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Hati-hati: HSTS sulit dibatalkan. Pastikan semua subdomain siap HTTPS sebelum `includeSubDomains`.

Nginx menyajikan `/uploads` langsung dari disk, jadi file tidak lewat Node. Konfigurasi juga memblokir eksekusi file yang diunggah (`.php`, `.sh`, `.html`, dll.) dan mengirim `nosniff`.

---

## 8. Email transaksional (Resend)

Tanpa email, verifikasi akun/reset password/undangan tidak sampai ke pengguna (tautan hanya ada di log server). Untuk production:

1. Buat akun Resend dan tambahkan domain pengirim (mis. `atracker.app`).
2. Tambahkan record DNS yang diminta Resend (SPF, DKIM). Tunggu status **Verified**.
3. Tambahkan DMARC minimal:
   ```text
   _dmarc.atracker.app  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@atracker.app"
   ```
4. Set `RESEND_API_KEY` dan `EMAIL_FROM` (alamat harus di domain terverifikasi).
5. Restart app:
   ```bash
   docker compose -f docker-compose.prod.yml up -d app
   ```
6. Uji signup baru, lupa password, dan undangan anggota. Cek spam score dan bounce.

Log pengiriman:

```bash
docker compose -f docker-compose.prod.yml logs app | grep -E "email|Resend"
```

Jangan gunakan alamat `no-reply` tanpa monitoring bounce/complaint.

---

## 9. Billing / Stripe — status saat ini

**Penting:** integrasi Stripe belum diimplementasikan. `src/actions/billing.ts` saat ini:

- mengubah plan di database secara lokal,
- membuat invoice lokal,
- menerapkan limit Free/Pro/Business,
- tetapi **tidak** membuat Checkout Session, tidak memverifikasi webhook, dan tidak menagih kartu.

Konsekuensi:

- Jangan mengaktifkan penjualan paket berbayar self-serve di production.
- Jika butuh revenue sebelum integrasi selesai, gunakan kontrak/invoice manual dan update plan oleh Admin.
- Jangan mengisi `STRIPE_*` dan menganggap pembayaran berjalan.

Sebelum monetisasi, kerjakan:

1. Checkout Session + Customer Portal.
2. Webhook `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` dengan verifikasi signature + idempotency.
3. Sinkronisasi seat dan status dunning.
4. Uji mode test end-to-end, lalu live dengan nominal kecil.
5. Samakan invoice aplikasi dengan source of truth Stripe.

---

## 10. Upload file dan storage

Saat ini lampiran dan logo disimpan di **disk lokal** (`/srv/atracker/data/uploads`), disajikan Nginx.

- Batas 25 MB/file, 10 file/task; `client_max_body_size 30m`.
- MIME whitelist + validasi signature untuk logo workspace.
- **Belum ada antivirus/malware scan.** Untuk production yang menampung file publik, tambahkan ClamAV/scanning atau object storage dengan scanning.
- Backup folder uploads setiap hari (lihat bagian 11).
- Jika nanti memakai lebih dari satu app instance, pindahkan ke S3-compatible storage + signed URL (perlu perubahan kode). Jangan mount NFS untuk upload tanpa pengujian.

Permission wajib:

```bash
sudo chown -R 1001:1001 /srv/atracker/data/uploads
sudo chmod 755 /srv/atracker/data/uploads
```

---

## 11. Backup dan restore

### Database

- Aktifkan backup otomatis + PITR di provider. Retensi **≥30 hari**.
- Buat snapshot manual sebelum setiap migration production.
- Uji restore ke database staging minimal 1× per kuartal.
- Simpan bukti restore (waktu, versi, hasil smoke test).

Jika perlu dump mandiri:

```bash
mkdir -p /var/backups/atracker
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > /var/backups/atracker/db-$(date +%F-%H%M).sql.gz
```

### Uploads

```bash
mkdir -p /var/backups/atracker
tar -czf /var/backups/atracker/uploads-$(date +%F).tar.gz -C /srv/atracker data/uploads
```

Salin keluar server (S3/R2/B2) dan enkripsi:

```bash
rclone copy /var/backups/atracker remote:atracker-backups/production
```

### Konfigurasi

Backup terenkripsi:

- `.env.production`
- config Nginx (`/etc/nginx/sites-available/atracker-production`)
- `docker-compose.prod.yml`
- versi/tag release yang sedang jalan

### Restore drill

1. Provision DB sementara.
2. Restore snapshot ke DB tersebut.
3. Arahkan staging ke DB hasil restore.
4. Jalankan smoke test (login, buka project, upload, dashboard).
5. Catat waktu restore aktual (target RTO 4 jam).

---

## 12. Monitoring, log, dan alert

Wajib:

- Uptime monitor ke `https://app.atracker.app/healthz` setiap 1 menit, alert email/Slack.
- Alert disk > 80%, memory > 85%, container restart, DB connections > 80%.
- Cek `docker compose ps` dan log harian.

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200 app
sudo tail -f /var/log/nginx/atracker-production.error.log
docker stats
df -h
```

Log Docker dibatasi oleh compose (20 MB × 5). Untuk error tracking, Sentry **belum terpasang** — tambahkan sebelum trafik tinggi.

Health endpoint hanya mengecek app + `SELECT 1`; tidak mengecek worker/queue karena belum ada worker terpisah.

---

## 13. Update dan rollback

### Update rutin

```bash
cd /srv/atracker
git fetch --tags
git checkout <RELEASE_TAG>

# Simpan image sebelumnya untuk rollback
docker tag atracker-app:production atracker-app:rollback-$(date +%Y%m%d-%H%M) || true

# Snapshot DB sebelum migration (wajib jika ada perubahan skema)
# ... buat snapshot di provider ...

docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml --profile tools run --rm --build migrate
docker compose -f docker-compose.prod.yml up -d app

curl -fsS https://app.atracker.app/healthz
docker compose -f docker-compose.prod.yml ps
```

Deploy ini mengganti satu container; downtime biasanya beberapa detik. Untuk zero-downtime sejati, perlu dua app container + upstream Nginx (belum dikonfigurasi).

### Rollback kode

```bash
cd /srv/atracker
git checkout <TAG_SEBELUMNYA>
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d app
curl -fsS https://app.atracker.app/healthz
```

Atau jalankan image rollback:

```bash
docker tag atracker-app:rollback-YYYYMMDD-HHMM atracker-app:production
docker compose -f docker-compose.prod.yml up -d app
```

### Rollback database

Hanya jika migration/data rusak:

1. Hentikan app (`docker compose ... stop app`).
2. Restore snapshot/PITR ke waktu sebelum deploy.
3. Jalankan app versi sebelumnya.
4. Verifikasi data kritis.
5. Catat insiden dan penyebab.

Karena itu, migration harus **additive** dan backward compatible; hindari drop/rename kolom dalam satu langkah deploy.

---

## 14. Maintenance keamanan

- Patch OS otomatis (`unattended-upgrades`), reboot sesuai kebutuhan.
- Update base image/Dependabot minimal bulanan; rebuild dan deploy.
- `npm audit` berkala; jangan deploy dengan vulnerability kritis yang belum ditangani.
- Rotasi `AUTH_SECRET` dan kredensial DB sesuai kebijakan (mis. 6–12 bulan atau saat insiden).
- Review audit log workspace (invite, role, billing, hapus project).
- Pastikan port DB tidak terbuka ke publik.
- Backup terenkripsi, akses backup dibatasi.
- Rate limit login saat ini **in-memory per instance**: restart mereset hitungan. Untuk multi-instance, pindahkan ke Redis.
- Session disimpan di DB; revoke session berfungsi. Rotasi `AUTH_SECRET` membatalkan semua token.

---

## 15. Batasan scaling saat ini

Aplikasi dioptimalkan untuk **satu instance app**:

| Area | Kondisi sekarang | Jika scale >1 instance |
|---|---|---|
| Upload | Disk lokal + Nginx | Pindah ke S3-compatible + signed URL |
| Rate limit auth | In-memory | Redis |
| Router cache | Per instance | Aman (stateless) |
| Session | JWT + row DB | Aman |
| Background job | Tidak ada worker | Tambah queue (Redis/BullMQ) sebelum digest/email massal |
| Realtime | Tidak ada | Polling/refresh manual |

Skala vertikal (CPU/RAM) lebih sederhana dan cukup untuk target awal (<1.000 user). Pantau p95 API, DB connections, dan disk uploads.

---

## 16. Kesiapan fitur sebelum publik

Item berikut **belum selesai** dan harus diselesaikan/diputuskan sebelum launch publik:

- [ ] **Halaman legal**: Privacy Policy, Terms of Service, cookie banner (PRD mewajibkan; belum ada route-nya).
- [ ] **Stripe live** (Checkout, webhook, invoice, dunning) — lihat bagian 9.
- [ ] **Email provider** terverifikasi (Resend + SPF/DKIM/DMARC).
- [ ] **Malware scan** untuk lampiran (PRD Should) atau keputusan risiko tertulis.
- [ ] **Sentry/error tracking** dan alert on-call.
- [ ] **Status page** / kanal support.
- [ ] Uji isolasi tenant & permission matrix di environment production-like.
- [ ] Uji restore backup dan catat RTO aktual.
- [ ] Review aksesibilitas alur inti (keyboard, kontras).
- [ ] Kebijakan retensi data setelah akun dihapus (PRD Q12).
- [ ] Domain email `no-reply@` dimonitor bounce/complaint.

---

## 17. Checklist go-live production

**Infrastruktur**

- [ ] DNS `app.atracker.app` → IP production.
- [ ] SSH key, password login off, root login off.
- [ ] UFW 22/80/443, fail2ban, unattended-upgrades.
- [ ] Docker + Compose terpasang; user deploy di grup docker.
- [ ] DB terkelola: TLS, backup otomatis, PITR, allowlist IP.
- [ ] `.env.production` permission 600, secret unik, tidak di Git.
- [ ] `/srv/atracker/data/uploads` permission 1001:1001.
- [ ] Build image sukses; migration applied.
- [ ] App `healthy`; `/api/health` 200 dari internet.
- [ ] Nginx + HTTPS + redirect; HSTS diputuskan.
- [ ] Upload lampiran/logo tersaji lewat `/uploads` dan tidak bisa dieksekusi.

**Operasional**

- [ ] Uptime monitor + alert.
- [ ] Backup DB & uploads harian, tersalin keluar server, terenkripsi.
- [ ] Restore drill berhasil.
- [ ] Log rotation aktif, akses log dibatasi.
- [ ] Prosedur update & rollback diuji di staging.
- [ ] Password manager berisi semua kredensial.
- [ ] Runbook insiden (kontak, akses, langkah restore).

**Produk**

- [ ] Signup → verifikasi email → workspace → project → task berjalan.
- [ ] Undangan anggota/guest dan email sampai.
- [ ] Reset password berjalan.
- [ ] Multi-tenant isolation diuji.
- [ ] Billing tidak dijual sebelum Stripe selesai.
- [ ] Legal pages & cookie consent tersedia.
- [ ] Seed demo **tidak** ada di production.

---

## 18. Runbook singkat saat insiden

| Gejala | Cek pertama | Tindakan |
|---|---|---|
| Site 502 | `docker compose ps`, `logs app` | Restart app; cek DB/env; rollback bila baru deploy |
| Health `database: down` | Status DB provider, allowlist IP, disk DB | Pulihkan DB; jangan redeploy berulang |
| Login gagal massal | `AUTH_SECRET` berubah? cookie/domain? | Kembalikan secret lama atau minta login ulang |
| Upload gagal | Disk penuh, permission, Nginx limit | `df -h`, chown 1001, cek `client_max_body_size` |
| Email tidak terkirim | Resend status, DNS, bounce | Perbaiki domain/key; komunikasikan ke pengguna |
| Deploy baru bermasalah | Log + health | Rollback image/tag sebelumnya, restore DB hanya jika perlu |
| Data terhapus | Backup/PITR | Hentikan app, restore, verifikasi, catat insiden |

Simpan dokumen ini di repo dan review setiap perubahan arsitektur.

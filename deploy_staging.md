# Deploy Staging — A Tracker

Dokumen ini menjelaskan cara men-deploy A Tracker ke server staging dari nol, apa saja yang harus disiapkan di server, dan cara update/rollback. Perintah ditulis untuk **Ubuntu 24.04 LTS** dengan **Docker Compose**, **Nginx** di host, dan **Certbot**.

Artefak deploy yang sudah ada di repo:

| File | Fungsi |
|---|---|
| `Dockerfile` | Multi-stage build (deps, builder, migrator, runner). |
| `docker-compose.staging.yml` | App + PostgreSQL 16 + job migrasi. |
| `.env.example` | Daftar environment variable. |
| `deploy/nginx/atracker-staging.conf` | Virtual host Nginx + penyajian `/uploads`. |
| `/api/health` | Health check app + database. |

Arsitektur staging:

```text
Internet
  │  HTTPS (Nginx + Let's Encrypt)
  ▼
Nginx (host) ── /uploads/* ──► /opt/atracker-staging/data/uploads
  │
  └── proxy 127.0.0.1:3000 ──► container atracker-staging-app
                                  │
                                  └── container atracker-staging-db (Postgres 16, volume)
```

Staging memakai PostgreSQL di dalam Docker. Production memakai database terkelola — lihat `deploy_prod.md`.

---

## 1. Prasyarat

Siapkan:

- VPS Ubuntu 24.04, minimum **2 vCPU / 4 GB RAM / 40 GB SSD**.
- Domain staging, contoh `staging.atracker.app`.
- Akses DNS untuk membuat record `A`.
- Repository Git yang bisa di-clone server (deploy key untuk repo privat).
- Akun email untuk notifikasi Certbot.

Buat DNS record lebih dulu:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `staging` | `<IP_SERVER>` | 300 |

Tunggu propagasi (`dig +short staging.atracker.app`).

---

## 2. Hardening dasar server

Login sebagai root, lalu buat user deploy:

```bash
adduser deploy
usermod -aG sudo deploy
```

Salin SSH public key Anda:

```bash
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys   # tempel public key
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Uji login `ssh deploy@<IP_SERVER>` di terminal baru **sebelum** menutup sesi root.

Set timezone, update sistem, dan firewall:

```bash
timedatectl set-timezone Asia/Jakarta
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg git unzip
dpkg-reconfigure -plow unattended-upgrades
```

Aktifkan firewall:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Aktifkan fail2ban:

```bash
systemctl enable --now fail2ban
fail2ban-client status
```

Swap 2 GB (berguna saat build image):

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Disable login root/password **setelah** login key untuk `deploy` berhasil:

```bash
nano /etc/ssh/sshd_config
# PasswordAuthentication no
# PermitRootLogin no
systemctl reload ssh
```

---

## 3. Install Docker

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

Logout lalu login lagi sebagai `deploy`, kemudian cek:

```bash
docker --version
docker compose version
```

---

## 4. Ambil kode dan siapkan direktori

```bash
sudo mkdir -p /opt/atracker-staging
sudo chown deploy:deploy /opt/atracker-staging
git clone <REPO_URL> /opt/atracker-staging
cd /opt/atracker-staging
```

Siapkan direktori upload dan permission untuk user container (`uid 1001`):

```bash
mkdir -p data/uploads
sudo chown -R 1001:1001 data/uploads
sudo chmod 755 data/uploads
```

Folder ini di-mount ke `/app/public/uploads` di container. Nginx membaca folder yang sama.

---

## 5. Environment staging

Buat file `.env.staging` di `/opt/atracker-staging`:

```bash
nano .env.staging
chmod 600 .env.staging
```

Isi minimal:

```dotenv
# Database (service "db" di docker-compose.staging.yml)
POSTGRES_PASSWORD=<PASSWORD_ALFANUMERIK_KUAT>
DATABASE_URL="postgresql://atracker:<PASSWORD_ALFANUMERIK_KUAT>@db:5432/atracker?schema=public"

# Auth — WAJIB unik, jangan pakai nilai contoh
AUTH_SECRET=<HASIL_OPENSSL_RAND_BASE64_48>
SESSION_TTL_DAYS=30

# URL publik (harus sama persis dengan domain HTTPS)
NEXT_PUBLIC_APP_URL="https://staging.atracker.app"

# Upload
UPLOAD_DIR="public/uploads"
MAX_UPLOAD_MB=25

# Email (opsional di staging)
RESEND_API_KEY=""
EMAIL_FROM="A Tracker Staging <no-reply@staging.atracker.app>"

# Stripe (belum dipakai; billing masih simulasi)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO=""
STRIPE_PRICE_BUSINESS=""
```

Generate secret:

```bash
openssl rand -base64 48
```

Catatan:

- Gunakan password database alfanumerik. Jika memakai karakter khusus, URL-encode di `DATABASE_URL`.
- `POSTGRES_PASSWORD` dan password di `DATABASE_URL` harus sama.
- Jangan commit `.env.staging`.
- Tanpa `RESEND_API_KEY`, email verifikasi/reset/undangan **tidak dikirim**; tautan hanya muncul di log app dan dev link di UI (khusus staging).

Variable lengkap ada di `.env.example`.

---

## 6. Build dan jalankan pertama kali

Dari `/opt/atracker-staging`:

```bash
# 1) Build image app
docker compose -f docker-compose.staging.yml build app

# 2) Nyalakan database dan tunggu sehat
docker compose -f docker-compose.staging.yml up -d db
docker compose -f docker-compose.staging.yml ps

# 3) Jalankan migrasi (wajib setiap deploy)
docker compose -f docker-compose.staging.yml --profile tools run --rm --build migrate

# 4) Nyalakan app
docker compose -f docker-compose.staging.yml up -d app

# 5) Cek log dan health
docker compose -f docker-compose.staging.yml logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

Health yang benar:

```json
{"status":"ok","database":"up","time":"..."}
```

### Data demo staging (opsional)

**Hanya staging.** Seed akan menghapus dan membuat ulang data demo workspace `nusantara` dan `studio-kecil`:

```bash
docker compose -f docker-compose.staging.yml --profile tools run --rm --build migrate npx tsx prisma/seed.ts
```

Akun demo (`Password123!`): `rina@atracker.test`, `dimas@atracker.test`, `bagas@atracker.test`, `maya@atracker.test`, `sari@atracker.test`.

**Jangan jalankan seed di production.**

---

## 7. Nginx dan TLS

Install Nginx dan Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Pasang virtual host dari repo:

```bash
sudo cp deploy/nginx/atracker-staging.conf /etc/nginx/sites-available/atracker-staging
sudo ln -s /etc/nginx/sites-available/atracker-staging /etc/nginx/sites-enabled/atracker-staging
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Sesuaikan `server_name` dan `alias /uploads/` bila domain/path berbeda. Nilai default:

- Domain: `staging.atracker.app`
- Upload: `/opt/atracker-staging/data/uploads/`
- App: `127.0.0.1:3000`
- `client_max_body_size 30m` (cocok dengan batas upload 25 MB + overhead).

Terbitkan sertifikat:

```bash
sudo certbot --nginx -d staging.atracker.app --redirect
```

Uji renew:

```bash
sudo certbot renew --dry-run
```

Setelah HTTPS stabil, opsional tambahkan HSTS di blok 443:

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

---

## 8. Smoke test

Dari komputer lokal:

```bash
curl -fsS https://staging.atracker.app/api/health
curl -I https://staging.atracker.app/login
dig +short staging.atracker.app
```

Checklist manual:

- [ ] Signup/login berjalan; cookie `at_session` terpasang `Secure` + `HttpOnly`.
- [ ] Buat workspace, project, task, subtask.
- [ ] Upload lampiran task (≤25 MB) dan buka file lewat `/uploads/...`.
- [ ] Ganti logo workspace (PNG/GIF) dan lihat di sidebar.
- [ ] Invite anggota; cek email atau dev link di UI.
- [ ] Timeline, dashboard, filter list berjalan.
- [ ] `docker compose ps` menunjukkan app `healthy` dan db `healthy`.
- [ ] Log tidak menampilkan error Prisma/action.

Cek email tanpa provider:

```bash
docker compose -f docker-compose.staging.yml logs app | grep "email:dev"
```

---

## 9. Update aplikasi

Alur setiap deploy staging:

```bash
cd /opt/atracker-staging
git pull --ff-only

# Build image baru (container lama tetap melayani)
docker compose -f docker-compose.staging.yml build app

# Migrasi dulu. Pastikan migration bersifat additive/backward compatible.
docker compose -f docker-compose.staging.yml --profile tools run --rm --build migrate

# Recreate app dengan image baru
docker compose -f docker-compose.staging.yml up -d app

# Verifikasi
curl -fsS https://staging.atracker.app/api/health
docker compose -f docker-compose.staging.yml ps
docker image prune -f
```

Backup database sebelum migrasi yang mengubah skema:

```bash
mkdir -p /var/backups/atracker-staging
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U atracker -d atracker | gzip > /var/backups/atracker-staging/predeploy-$(date +%F-%H%M).sql.gz
```

---

## 10. Rollback

Jika app gagal setelah update:

```bash
cd /opt/atracker-staging
git log --oneline -5
git checkout <COMMIT_ATAU_TAG_SEBELUMNYA>
docker compose -f docker-compose.staging.yml build app
docker compose -f docker-compose.staging.yml up -d app
curl -fsS https://staging.atracker.app/api/health
```

Catatan:

- Rollback kode **tidak** membatalkan migration. Karena itu migration harus additive.
- Jika migration merusak data, restore backup:

```bash
gunzip -c /var/backups/atracker-staging/predeploy-YYYY-MM-DD-HHMM.sql.gz | \
  docker compose -f docker-compose.staging.yml exec -T db psql -U atracker -d atracker
```

- Untuk kembali ke branch utama setelah rollback: `git checkout main && git pull --ff-only`.

---

## 11. Backup staging

Database (cron harian):

```bash
sudo mkdir -p /var/backups/atracker-staging
sudo crontab -e
```

Tambahkan:

```cron
0 2 * * * cd /opt/atracker-staging && docker compose -f docker-compose.staging.yml exec -T db pg_dump -U atracker -d atracker | gzip > /var/backups/atracker-staging/db-$(date +\%F).sql.gz
30 2 * * * cd /opt/atracker-staging && tar -czf /var/backups/atracker-staging/uploads-$(date +\%F).tar.gz data/uploads
0 3 * * * find /var/backups/atracker-staging -type f -mtime +14 -delete
```

Simpan juga salinan `.env.staging` di password manager. Backup staging tidak perlu dipertahankan lama, tetapi harus bisa direstore.

---

## 12. Monitoring dan log

```bash
# Log app
docker compose -f docker-compose.staging.yml logs -f --tail=200 app

# Log Nginx
sudo tail -f /var/log/nginx/atracker-staging.access.log
sudo tail -f /var/log/nginx/atracker-staging.error.log

# Resource
docker stats
df -h
free -h
```

Pasang uptime monitor (UptimeRobot/Better Stack/Uptime Kuma) ke:

```text
https://staging.atracker.app/api/health
```

Alert jika status ≠ 200 atau response > 2 detik.

Docker log sudah dibatasi oleh `logging` di compose (10 MB × 3–5 file).

---

## 13. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| App restart terus | `AUTH_SECRET`/`DATABASE_URL` salah, DB belum sehat | `docker compose logs app`, cek `.env.staging` |
| `502 Bad Gateway` | Container app mati / port beda | `docker compose ps`, `curl 127.0.0.1:3000/api/health` |
| `database: down` | Password DB salah atau DB belum siap | Cek `docker compose logs db`, reset password di `.env` |
| Upload 413 | `client_max_body_size` terlalu kecil | Naikkan di Nginx (minimal `30m`) lalu reload |
| File upload 404 | Bind mount/alias Nginx salah | Pastikan `data/uploads` dan `alias` menunjuk path sama |
| File upload tidak bisa ditulis | Permission uid 1001 | `sudo chown -R 1001:1001 data/uploads` |
| Email tidak terkirim | `RESEND_API_KEY` kosong | Isi key + `EMAIL_FROM`, atau cek log `email:dev` |
| Login redirect loop | `NEXT_PUBLIC_APP_URL` beda dengan domain | Samakan dengan URL HTTPS |
| Perubahan tidak terlihat | Image lama masih jalan | `build app` lalu `up -d app`; cek `docker compose images` |
| Build kehabisan memori | RAM < 4 GB | Tambah swap atau besarkan VPS |

---

## 14. Checklist staging selesai

- [ ] DNS mengarah ke server.
- [ ] SSH key + password login disabled.
- [ ] UFW aktif (22/80/443), fail2ban aktif.
- [ ] Docker + Compose terpasang, `deploy` masuk grup docker.
- [ ] `.env.staging` permission 600, secret unik.
- [ ] `docker compose ps`: app dan db `healthy`.
- [ ] Migration `0001`–`0003` applied.
- [ ] Nginx + HTTPS + redirect 80→443.
- [ ] `/api/health` 200 dari luar.
- [ ] Upload lampiran/logo workspace tersaji lewat `/uploads`.
- [ ] Backup harian + cron berjalan.
- [ ] Uptime monitor aktif.
- [ ] Seed hanya dijalankan di staging.

Lanjut ke production: `deploy_prod.md`.

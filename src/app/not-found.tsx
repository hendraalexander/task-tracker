import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
        <Compass size={24} />
      </span>
      <h1 className="mt-4 text-lg font-bold">Halaman tidak ditemukan</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Tautan mungkin salah, atau Anda tidak memiliki akses ke halaman ini.
      </p>
      <Link href="/" className="mt-4 text-sm font-semibold text-primary hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}

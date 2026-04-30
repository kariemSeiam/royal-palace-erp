"use client";

import { useRouter } from "next/navigation";
import { clearStoredAuth } from "@/lib/auth-storage";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        clearStoredAuth();
        router.push("/login");
      }}
      className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
    >
      تسجيل الخروج
    </button>
  );
}

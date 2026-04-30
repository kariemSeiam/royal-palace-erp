"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPath, getDefaultAuthorizedPath, isAdminPanelUser } from "./access";

const API_ME_URL = "https://api.royalpalace-group.com/api/v1/auth/me";

function clearAdminTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export default function useAdminAuth(pageName = "page") {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    async function loadUser() {
      try {
        const res = await fetch(API_ME_URL, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!res.ok) throw new Error("unauthorized");

        const me = await res.json();

        if (cancelled) return;

        if (!isAdminPanelUser(me)) {
          clearAdminTokens();
          router.replace("/login");
          return;
        }

        if (!canAccessPath(me, pathname)) {
          router.replace(getDefaultAuthorizedPath(me));
          return;
        }

        setUser(me);
        setReady(true);
      } catch {
        if (cancelled) return;
        clearAdminTokens();
        router.replace("/login");
      }
    }

    setReady(false);
    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router, pathname, pageName]);

  return { user, ready };
}

"use client";

import { useEffect } from "react";
import { getDefaultAuthorizedPath, isAdminPanelUser } from "./components/access";

const API_ME_URL = "https://api.royalpalace-group.com/api/v1/auth/me";

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export default function AdminRootPage() {
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    fetch(API_ME_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized");
        const me = await res.json();

        if (!isAdminPanelUser(me)) {
          clearTokens();
          window.location.replace("/login");
          return;
        }

        window.location.replace(getDefaultAuthorizedPath(me));
      })
      .catch(() => {
        clearTokens();
        window.location.replace("/login");
      });
  }, []);

  return (
    <main className="loading-shell">
      <div className="loading-card">جاري تحويلك إلى مساحة العمل المناسبة...</div>
    </main>
  );
}

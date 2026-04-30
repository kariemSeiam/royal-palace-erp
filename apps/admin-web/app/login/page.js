"use client";

import { useEffect, useState } from "react";
import { getDefaultAuthorizedPath, isAdminPanelUser } from "../components/access";

const API_LOGIN_URL = "https://api.royalpalace-group.com/api/v1/auth/login";
const API_ME_URL = "https://api.royalpalace-group.com/api/v1/auth/me";

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

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
          return;
        }

        window.location.href = getDefaultAuthorizedPath(me);
      })
      .catch(() => {
        clearTokens();
      });
  }, []);

  async function doLogin() {
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setMessage("يرجى إدخال اسم المستخدم أو البريد الإلكتروني أو الهاتف، مع كلمة المرور.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(API_LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.detail) || "فشل تسجيل الدخول");
      }

      if (!data?.access_token) {
        throw new Error("لم يتم استلام رمز الدخول من الخادم");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token || "");

      const meRes = await fetch(API_ME_URL, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
        cache: "no-store",
      });

      const me = await meRes.json().catch(() => null);

      if (!meRes.ok || !me || !isAdminPanelUser(me)) {
        clearTokens();
        throw new Error("هذا الحساب غير مخول للوصول إلى لوحة الإدارة");
      }

      window.location.href = getDefaultAuthorizedPath(me);
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="erp-auth-shell">
      <div className="erp-auth-backdrop" />

      <section className="erp-auth-card">
        <div className="erp-auth-brand">
          <div className="erp-auth-brand-mark">RP</div>
          <div>
            <h1>Royal Palace ERP</h1>
            <p>Executive Admin Portal</p>
          </div>
        </div>

        <div className="erp-auth-head">
          <h2>تسجيل الدخول</h2>
          <p>سجل دخولك للوصول إلى لوحة الإدارة التشغيلية لنظام Royal Palace.</p>
        </div>

        <div className="erp-auth-form">
          <div>
            <label className="erp-label">اسم المستخدم / البريد / الهاتف</label>
            <input
              className="erp-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              dir="rtl"
            />
          </div>

          <div>
            <label className="erp-label">كلمة المرور</label>
            <input
              className="erp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="rtl"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doLogin();
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={doLogin}
            disabled={loading}
            className="erp-auth-submit"
          >
            {loading ? "جارٍ تسجيل الدخول..." : "دخول إلى لوحة الإدارة"}
          </button>
        </div>

        {message ? <div className="erp-auth-error">{message}</div> : null}
      </section>
    </main>
  );
}

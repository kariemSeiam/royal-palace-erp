"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { currentUserRequest, loginRequest } from "@/lib/auth-api";

const REDIRECT_KEY = "royal_palace_post_login_redirect";

function getSafeNextFromBrowser(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (!next || !next.startsWith("/")) return null;
  return next;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [nextTarget, setNextTarget] = useState("/account");

  useEffect(() => {
    const fromQuery = getSafeNextFromBrowser();
    const fromSession =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(REDIRECT_KEY)
        : null;

    const target = fromQuery || fromSession || "/account";
    setNextTarget(target);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(REDIRECT_KEY, target);
    }

    async function checkExistingSession() {
      const result = await currentUserRequest();
      if (result.ok) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(REDIRECT_KEY);
        }
        window.location.href = target;
        return;
      }

      setCheckingSession(false);
    }

    checkExistingSession();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || checkingSession) return;

    setError("");
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setError("يرجى إدخال بيانات تسجيل الدخول كاملة.");
      return;
    }

    setLoading(true);

    const result = await loginRequest({
      identifier: cleanIdentifier,
      password: cleanPassword,
    });

    if (!result.ok) {
      setSuccess(false);
      setError(result.error || "تعذر تسجيل الدخول. تحقق من البيانات ثم أعد المحاولة.");
      setLoading(false);
      return;
    }

    setSuccess(true);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(REDIRECT_KEY);
    }

    setTimeout(() => {
      window.location.href = nextTarget || "/account";
    }, 350);
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <section className="grid gap-6 lg:grid-cols-[1.02fr_.98fr]">
            <div className="rounded-[32px] bg-royal-navy p-6 text-white shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                CLIENT ACCESS
              </p>
              <h1 className="mt-3 text-3xl font-extrabold md:text-5xl">
                تسجيل الدخول
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
                سجّل الدخول للوصول إلى حسابك، متابعة طلباتك، وإكمال الشراء داخل تجربة
                راقية ومترابطة.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">متابعة الطلبات</p>
                  <p className="mt-2 text-xs leading-6 text-white/70">
                    الوصول إلى سجل الطلبات وحالاتها من صفحة واحدة.
                  </p>
                </div>
                <div className="rounded-[24px] bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">إتمام أسرع</p>
                  <p className="mt-2 text-xs leading-6 text-white/70">
                    استخدام بيانات الحساب والعنوان لتجربة دفع أكثر سلاسة.
                  </p>
                </div>
                <div className="rounded-[24px] bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">تجربة أوضح</p>
                  <p className="mt-2 text-xs leading-6 text-white/70">
                    انتقال منظم بين الحساب، السلة، والطلبات الخاصة.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow-soft md:p-10">
              {checkingSession ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  جارٍ التحقق من حالة تسجيل الدخول...
                </div>
              ) : (
                <>
                  <div className="mb-6 text-right">
                    <h2 className="text-2xl font-bold text-royal-navy">أهلاً بعودتك</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      أدخل بياناتك للمتابعة إلى حسابك أو العودة إلى الصفحة المطلوبة.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="اسم المستخدم أو البريد الإلكتروني أو رقم الهاتف"
                      autoComplete="username"
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                    />

                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href="/forgot-password"
                        className="text-sm font-bold text-royal-gold"
                      >
                        نسيت كلمة المرور؟
                      </Link>

                      <span className="text-xs text-slate-500">
                        سيتم تحويلك إلى {nextTarget}
                      </span>
                    </div>

                    {error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                        {error}
                      </div>
                    ) : null}

                    {success ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                        تم تسجيل الدخول بنجاح. جارٍ تحويلك...
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={loading || success}
                      className="flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {success
                        ? "تم تسجيل الدخول"
                        : loading
                        ? "جارٍ تسجيل الدخول..."
                        : "تسجيل الدخول"}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-600">ليس لديك حساب بعد؟</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="inline-flex rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                  >
                    إنشاء حساب جديد
                  </Link>
                  <Link
                    href="/projects"
                    className="inline-flex rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
                  >
                    للمشاريع والطلبات الخاصة
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <StoreFooter />
    </>
  );
}

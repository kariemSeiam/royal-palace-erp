"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { currentUserRequest, loginRequest, registerRequest } from "@/lib/auth-api";

const REDIRECT_KEY = "royal_palace_post_login_redirect";

const benefits = [
  "حفظ بيانات العميل والعنوان لتجربة شراء أسرع",
  "متابعة الطلبات من داخل الحساب",
  "ربط الحساب بالشراء المباشر والطلبات الخاصة",
];

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkExistingSession() {
      const result = await currentUserRequest();
      if (result.ok) {
        window.location.href = "/account";
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

    if (
      !fullName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !governorate.trim() ||
      !city.trim() ||
      !addressLine.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setError("يرجى استكمال جميع الحقول المطلوبة.");
      return;
    }

    if (password.trim().length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setError("تأكيد كلمة المرور غير متطابق.");
      return;
    }

    setLoading(true);

    const registerResult = await registerRequest({
      full_name: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      governorate: governorate.trim(),
      city: city.trim(),
      address_line: addressLine.trim(),
      address_notes: addressNotes.trim() || undefined,
      password: password.trim(),
      confirm_password: confirmPassword.trim(),
    });

    if (!registerResult.ok) {
      setLoading(false);
      setError(registerResult.error || "تعذر إنشاء الحساب.");
      return;
    }

    const loginResult = await loginRequest({
      identifier: username.trim(),
      password: password.trim(),
    });

    if (!loginResult.ok) {
      setLoading(false);
      setError(loginResult.error || "تم إنشاء الحساب لكن تعذر تسجيل الدخول تلقائيًا.");
      return;
    }

    setSuccess(true);

    const target =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(REDIRECT_KEY) || "/account"
        : "/account";

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(REDIRECT_KEY);
    }

    setTimeout(() => {
      window.location.href = target;
    }, 350);
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <section className="grid gap-6 lg:grid-cols-[.94fr_1.06fr]">
            <div className="rounded-[32px] bg-white p-6 shadow-soft md:p-10">
              <div className="mb-6 text-right">
                <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">
                  إنشاء حساب جديد
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base md:leading-8">
                  أنشئ حساب عميل متكامل للوصول إلى تجربة شراء أوضح، ومتابعة الطلبات،
                  وربط العنوان الافتراضي بصفحة الدفع.
                </p>
              </div>

              {checkingSession ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  جارٍ التحقق من حالة الحساب...
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold md:col-span-2"
                  />

                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    autoComplete="username"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="البريد الإلكتروني"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="رقم الهاتف"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <input
                    type="text"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    placeholder="المحافظة"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="المدينة"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <textarea
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="العنوان التفصيلي"
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold md:col-span-2"
                  />

                  <textarea
                    value={addressNotes}
                    onChange={(e) => setAddressNotes(e.target.value)}
                    placeholder="ملاحظات إضافية للعنوان"
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold md:col-span-2"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة المرور"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تأكيد كلمة المرور"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-right outline-none transition focus:border-royal-gold"
                  />

                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 md:col-span-2">
                      {error}
                    </div>
                  ) : null}

                  {success ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 md:col-span-2">
                      تم إنشاء الحساب بنجاح. جارٍ تحويلك...
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || success}
                    className="flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                  >
                    {success
                      ? "تم إنشاء الحساب"
                      : loading
                      ? "جارٍ إنشاء الحساب..."
                      : "إنشاء الحساب"}
                  </button>
                </form>
              )}

              <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-600">لديك حساب بالفعل؟</p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  تسجيل الدخول
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] bg-royal-navy p-6 text-white shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                NEW CLIENT REGISTRATION
              </p>
              <h2 className="mt-3 text-3xl font-extrabold md:text-5xl">
                حساب عميل جاهز للشراء والمتابعة
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
                بمجرد إنشاء الحساب، تصبح بياناتك مرتبطة بالسلة والطلبات والعنوان
                الافتراضي لتجربة أكثر تنظيمًا ووضوحًا.
              </p>

              <div className="mt-8 space-y-4">
                {benefits.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[22px] bg-white/5 px-4 py-4"
                  >
                    <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-royal-gold" />
                    <span className="text-sm leading-7 text-white/85">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-bold text-white">مناسب أيضًا لـ:</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["الشراء المباشر", "المشاريع", "الطلبات الخاصة", "متابعة الطلبات"].map(
                    (item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/80"
                      >
                        {item}
                      </span>
                    )
                  )}
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

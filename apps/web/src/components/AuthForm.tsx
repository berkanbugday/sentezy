"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type SignupValues, signupSchema } from "@/lib/schemas";
import { PasswordInput } from "./PasswordInput";

const field =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted focus:border-signal";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [info, setInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setInfo(null);
    const supabase = createClient();
    const res = isSignup
      ? await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { display_name: values.name } },
        })
      : await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
    if (res.error) {
      setError("root", { message: res.error.message });
      return;
    }
    if (isSignup && !res.data.session) {
      setInfo("Hesabını doğrulamak için e-postanı kontrol et.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  });

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <div className="w-full max-w-[392px]">
      <div className="mb-6 flex items-center gap-2.5">
        <Image src="/sentezy-logo.png" alt="Sentezy" width={30} height={30} className="h-[30px] w-[30px]" />
        <span className="disp text-[22px] font-bold tracking-tight text-ink">Sentezy</span>
      </div>

      <h1 className="disp text-[25px] font-semibold text-ink">
        {isSignup ? "Hesap oluştur" : "Tekrar hoş geldin"}
      </h1>
      <p className="mb-6 mt-1.5 text-[14px] text-slate">
        {isSignup ? "Dakikalar içinde ilk videonu üret." : "Devam etmek için giriş yap."}
      </p>

      <button type="button" onClick={google} className="btn btn-ghost w-full">
        <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9Z"/><path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.3 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8L6 14.3Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1c.9-2.6 3.2-4.7 6-4.7Z"/></svg>
        Google ile devam et
      </button>

      <div className="my-4 flex items-center gap-3 text-[12.5px] text-muted">
        <span className="h-px flex-1 bg-hairline" /> ya da <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {isSignup && (
          <div>
            <input className={field} placeholder="Ad Soyad" {...register("name")} />
            {errors.name && <p className="mt-1 text-[12.5px] text-red-600">{errors.name.message}</p>}
          </div>
        )}
        <div>
          <input className={field} type="email" placeholder="E-posta" autoComplete="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-[12.5px] text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <PasswordInput
            className={field}
            placeholder="Şifre"
            autoComplete={isSignup ? "new-password" : "current-password"}
            {...register("password")}
          />
          {errors.password && <p className="mt-1 text-[12.5px] text-red-600">{errors.password.message}</p>}
        </div>

        {errors.root && <p className="text-[12.5px] text-red-600">{errors.root.message}</p>}
        {info && <p className="text-[12.5px] text-slate">{info}</p>}

        <button type="submit" disabled={isSubmitting} className="btn btn-primary mt-1 w-full disabled:opacity-60">
          {isSubmitting ? "…" : isSignup ? "Kayıt ol" : "Giriş yap"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13.5px] text-slate">
        {isSignup ? (
          <>Zaten hesabın var mı? <Link href="/login" className="font-semibold text-signal">Giriş yap</Link></>
        ) : (
          <>Hesabın yok mu? <Link href="/signup" className="font-semibold text-signal">Kayıt ol</Link></>
        )}
      </p>
    </div>
  );
}

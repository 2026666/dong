"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  accountToEmail,
  translateAuthError,
  validatePassword,
  validateUsername,
} from "@/lib/account";

export interface Profile {
  id: string;
  username: string;
  role: "member" | "admin";
  created_at: string;
  last_seen_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  /** 首次恢复登录态中 */
  loading: boolean;
  isAdmin: boolean;
  configured: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signUp: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (id: string) => {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("id, username, role, created_at, last_seen_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn("[auth] 读取 profile 失败:", error.message);
      setProfile(null);
      return;
    }
    setProfile((data as Profile | null) ?? null);
  }, []);

  // 首次恢复会话 + 监听登录状态变化
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const next = data.session?.user ?? null;
        setUser(next);
        if (next) void loadProfile(next.id);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (next) void loadProfile(next.id);
      else setProfile(null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // 登录后上报一次「最后活跃」
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      void getSupabase()
        .rpc("touch_profile")
        .then(({ error }) => {
          if (error) console.warn("[auth] touch_profile 失败:", error.message);
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [user]);

  const signIn = useCallback(async (username: string, password: string) => {
    const usernameError = validateUsername(username);
    if (usernameError) return { error: usernameError };
    const passwordError = validatePassword(password);
    if (passwordError) return { error: passwordError };
    if (!isSupabaseConfigured) {
      return { error: "还没配置 Supabase：请先填写 .env.local 里的地址与密钥" };
    }

    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: accountToEmail(username),
      password,
    });

    if (error) return { error: translateAuthError(error.message) };
    if (data.user) await loadProfile(data.user.id);
    return {};
  }, [loadProfile]);

  const signUp = useCallback(async (username: string, password: string) => {
    const usernameError = validateUsername(username);
    if (usernameError) return { error: usernameError };
    const passwordError = validatePassword(password);
    if (passwordError) return { error: passwordError };
    if (!isSupabaseConfigured) {
      return { error: "还没配置 Supabase：请先填写 .env.local 里的地址与密钥" };
    }

    const { data, error } = await getSupabase().auth.signUp({
      email: accountToEmail(username),
      password,
      options: { data: { username: username.trim() } },
    });

    if (error) return { error: translateAuthError(error.message) };
    if (!data.session) {
      return {
        error:
          "注册成功，但账号还需要邮箱确认。请到 Supabase → Authentication → Sign In / Providers → Email 关闭「Confirm email」后再试。",
      };
    }
    if (data.user) await loadProfile(data.user.id);
    return {};
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin: profile?.role === "admin",
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}

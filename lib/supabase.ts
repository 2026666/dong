"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** 是否填了真实的 Supabase 地址与密钥（否则走「未配置」降级提示） */
export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && anonKey.length > 40;

/** 登录态在 localStorage 里的键名（和页面访问统计无关） */
export const AUTH_STORAGE_KEY = "sgbh-auth";

let client: SupabaseClient | null = null;

/** 单例：整个应用只创建一个 Supabase 客户端 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      isSupabaseConfigured ? url : "https://placeholder.supabase.co",
      isSupabaseConfigured
        ? anonKey
        : "placeholder-anon-key-placeholder-placeholder-placeholder",
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: AUTH_STORAGE_KEY,
          flowType: "pkce",
        },
      }
    );
  }
  return client;
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-provider";

/**
 * 页面访问统计：每次切换页面，往 page_views 写一条记录。
 * 只记「路径」和时间，不记点击内容；未登录不记。
 */
export function PageViewTracker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !pathname) return;
    // React 严格模式下 effect 会跑两次，这里做一次去重
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const timer = setTimeout(() => {
      void getSupabase()
        .from("page_views")
        .insert({ user_id: user.id, path: pathname })
        .then(({ error }) => {
          if (error) console.warn("[pv] 记录失败:", error.message);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [user, pathname]);

  return null;
}

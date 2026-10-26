"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/** localStorage 存储 hook - 自动序列化/反序列化，兼容 SSR */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // 首次渲染（含服务端）始终使用 initialValue，保证 hydration 前后一致
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  // 记录已读取完成的 key，未完成前禁止写回，避免覆盖已有数据
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const initialRef = useRef(initialValue);

  // 挂载后再读取 localStorage
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(
        item !== null ? (JSON.parse(item) as T) : initialRef.current
      );
    } catch (error) {
      console.warn(`useLocalStorage: 读取 ${key} 失败`, error);
    }
    setLoadedKey(key);
  }, [key]);

  // 读取完成后才写回
  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`useLocalStorage: 写入 ${key} 失败`, error);
    }
  }, [key, storedValue, loadedKey]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) =>
      value instanceof Function ? (value as (prev: T) => T)(prev) : value
    );
  }, []);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`useLocalStorage: 删除 ${key} 失败`, error);
    }
    setStoredValue(initialRef.current);
  }, [key]);

  // 跨标签页同步
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setStoredValue(
          e.newValue ? (JSON.parse(e.newValue) as T) : initialRef.current
        );
      } catch (error) {
        console.warn(`useLocalStorage: 同步 ${key} 失败`, error);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/** 生成唯一 ID */
export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

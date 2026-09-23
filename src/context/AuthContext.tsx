"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "client" | "public";

interface User {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS = [
  { username: "admin", password: "admin123", role: "admin" as UserRole },
  { username: "public", password: "public123", role: "public" as UserRole },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      if (!supabase) {
        try {
          const saved = localStorage.getItem("flood_user");
          if (saved && active) setUser(JSON.parse(saved));
        } catch {
          localStorage.removeItem("flood_user");
        } finally {
          if (active) setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        if (active) setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", data.session.user.id)
        .single();

      if (active && profile) {
        setUser({
          username: profile.full_name || data.session.user.email || "User",
          role: profile.role as UserRole,
        });
      }

      if (active) setIsLoading(false);
    };

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", data.user.id)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        return null;
      }

      const userData = {
        username: profile.full_name || data.user.email || "User",
        role: profile.role as UserRole,
      };
      setUser(userData);
      return userData;
    }

    const found = DEMO_USERS.find(
      (candidate) =>
        candidate.username === email && candidate.password === password,
    );

    if (!found) return null;

    const userData = { username: found.username, role: found.role };
    setUser(userData);
    localStorage.setItem("flood_user", JSON.stringify(userData));
    return userData;
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("flood_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: Boolean(user),
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

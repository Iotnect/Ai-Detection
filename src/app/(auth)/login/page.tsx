"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const authenticatedUser = await login(username.trim(), password);
    if (authenticatedUser) {
      router.push("/");
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex bg-[#070b14]">
      {/* Left Side */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center p-12 border-r border-slate-800">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <Image
              src={`${basePath}/neovision.png`}
              alt="NV Logo"
              width={300}
              height={300}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white">AI Detection System</h1>
          <p className="text-slate-400 text-lg"></p>
          <p className="text-sm text-slate-500 leading-relaxed">
            
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-4">
            <Image
              src={`${basePath}/neovision.png`}
              alt="NeoVision Logo"
              width={112}
              height={112}
              className="object-contain"
              priority
            />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">
              Enter your credentials to access the system
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Email" : "Username"}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
                placeholder={
                  process.env.NEXT_PUBLIC_SUPABASE_URL
                    ? "name@company.com"
                    : "e.g. admin"
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition"
            >
              Sign In
            </button>
          </form>

          {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Demo accounts:</p>
              <div className="text-xs text-slate-400 space-y-1">
                <p>admin / admin123</p>
                <p>public / public123</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";

import { useAuth } from "@/context/AuthContext";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Logo() {
  const { user } = useAuth();
  const useMbsBranding = user?.role === "client";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src={`${basePath}/${useMbsBranding ? "Majlis_Bandaraya_Seremban.svg" : "neovision.png"}`}
        alt={useMbsBranding ? "Majlis Bandaraya Seremban Logo" : "NeoVision Logo"}
        width={40}
        height={40}
        className="shrink-0 object-contain"
        priority
      />

      {useMbsBranding ? (
        <span className="text-sm font-semibold leading-tight text-white">
          Majlis Bandaraya Seremban
        </span>
      ) : (
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold leading-tight text-white">
            AI Detection
          </span>
          <span className="text-xs text-slate-400">NeoVision</span>
        </div>
      )}
    </div>
  );
}

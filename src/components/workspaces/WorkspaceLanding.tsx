"use client";

import Image from "next/image";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";

export default function WorkspaceLanding() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] text-slate-200">
      <Topbar landing />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
        <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/neovision.png`}
          alt="NeoVision" width={240} height={240} priority unoptimized
          className="mb-6 h-44 w-60 object-contain object-left" />
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Choose your project</h1>
        <p className="mt-3 max-w-xl text-base text-slate-400">Open the MBS monitoring dashboard or explore the UM demo.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link href="/camera-status" prefetch={false}
            className="group flex min-h-52 flex-col justify-between rounded-xl border border-slate-700 bg-slate-900 p-7 transition hover:border-blue-500 hover:bg-slate-800 active:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
            <div><h2 className="text-3xl font-semibold text-white">MBS</h2>
              <p className="mt-3 text-sm text-slate-400">Majlis Bandaraya Seremban</p></div>
            <span className="mt-8 text-sm font-medium text-blue-400">Open dashboard</span>
          </Link>
          <Link href="/um" prefetch={false}
            className="group flex min-h-52 flex-col justify-between rounded-xl border border-slate-700 bg-slate-900 p-7 transition hover:border-blue-500 hover:bg-slate-800 active:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
            <div><h2 className="text-3xl font-semibold text-white">UM</h2>
              <p className="mt-3 text-sm text-slate-400">Demo workspace</p></div>
            <span className="mt-8 text-sm font-medium text-blue-400">Open demo</span>
          </Link>
        </div>
      </main>
      <footer className="px-5 py-6 text-center text-xs text-slate-500">NeoVision</footer>
    </div>
  );
}

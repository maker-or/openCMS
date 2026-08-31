import Link from "next/link";
import { ArrowUpRight, Blocks, Command, FileText } from "lucide-react";

const features = [
  { icon: FileText, label: "Documents", value: "Draft and publish content" },
  { icon: Blocks, label: "Composable", value: "Web, CLI, and SDK from one API" },
  { icon: Command, label: "Terminal-first", value: "Ship from wherever you work" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-20">
      <section className="max-w-3xl">
        <p className="mb-6 text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">The open content workspace</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.05em] text-white sm:text-7xl">
          Content should move as fast as your ideas.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
          OpenCMS gives your team a focused web workspace, a terminal UI, and a typed SDK backed by one secure API.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition hover:bg-cyan-100">
            Open workspace <ArrowUpRight className="size-4" />
          </Link>
          <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition hover:bg-white/[0.08]">
            Open the dashboard
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Icon className="size-5 text-cyan-300" />
            <p className="mt-10 font-medium text-white">{label}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-6 text-sm text-zinc-300">
        <span className="font-mono text-cyan-200">/api/health</span>
        <span className="ml-3 text-zinc-500">Elysia is mounted inside the Next.js App Router.</span>
      </section>
    </main>
  );
}

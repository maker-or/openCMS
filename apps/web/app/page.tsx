import Link from "next/link";
import { GeistPixelSquare } from "geist/font/pixel";


export default function Home() {
  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-[#000] bg-[position:center_10%] bg-no-repeat"
      style={{
        backgroundImage: "url('/ascii-magic-1.png')",
        backgroundSize: "clamp(22rem, 50vw, 54rem) auto",
      }}
    >
      <Link
        href="/dashboard"
        className={`${GeistPixelSquare.className} absolute right-6 top-6 z-10 bg-white px-5 py-3 text-sm font-semibold leading-none text-black transition hover:bg-cyan-100 sm:right-8 sm:top-8`}
      >
        Get started
      </Link>
      <div className="flex min-h-screen items-center justify-center px-6 pb-10 pt-10">
        <section className="flex -translate-y-[10vh] flex-col items-center text-center">
          <h1
            className={`${GeistPixelSquare.className} whitespace-nowrap text-[clamp(3.5rem,7.5vw,7rem)] font-semibold leading-none tracking-[-0.07em] text-white`}
          >
            The Content OS
          </h1>
          <div className="mt-10 bg-white/80 px-6 border-2 border-red-50 py-4 text-black rounded-md">
            <code className={`${GeistPixelSquare.className} text-sm font-semibold leading-none sm:text-base`}>
              bunx @maker-or/opencms@latest create
            </code>
          </div>
        </section>
      </div>
    </main>
  );
}

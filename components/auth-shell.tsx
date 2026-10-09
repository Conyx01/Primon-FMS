"use client";

import { PrimonLogo } from "@/components/logo";
import { Particles } from "@/components/ui/particles";
import { GridPattern } from "@/components/ui/grid-pattern";
import { BorderBeam } from "@/components/ui/border-beam";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-primon-950 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primon-100">
        <Particles
          className="absolute inset-0"
          quantity={55}
          ease={80}
          color="#ffffff"
          size={0.45}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primon-950/20 via-transparent to-primon-950/70" />
        <div className="relative z-10 w-full max-w-sm">
          <PrimonLogo variant="onDark" width={384} className="h-auto w-full" />
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="font-display text-[26px] leading-snug text-white">
            &ldquo;The gas has to reach a lethal dose above 600, consistently, for six
            days. That&apos;s what makes a fumigation successful.&rdquo;
          </p>
          <p className="mt-4 text-sm text-primon-300">
            — Operations standard, Primon Enterprises
          </p>
        </div>
        <p className="relative z-10 text-xs text-primon-400">
          Setting standard in pest management services since 2010.
        </p>
      </section>

      <section className="relative flex min-h-screen flex-col bg-primon-50">
        <div className="flex items-center bg-primon-950 px-6 py-5 lg:hidden">
          <PrimonLogo variant="onDark" width={240} />
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
          <GridPattern
            width={48}
            height={48}
            className="fill-primon-200/40 stroke-primon-200/50"
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white p-7 shadow-elevated sm:p-8">
            <BorderBeam
              size={160}
              duration={9}
              borderWidth={1.5}
              colorFrom="#6478BE"
              colorTo="#E9EDF8"
            />
            <div className="relative">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

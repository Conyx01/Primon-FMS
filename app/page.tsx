import Link from "next/link";
import { ShieldCheck, Wind, QrCode, ClipboardList } from "lucide-react";
import { PrimonLogo, PrimonMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <PrimonLogo width={188} />
        <nav className="hidden items-center gap-8 text-sm text-primon-800 md:flex">
          <a href="#platform" className="hover:text-primon-950">Platform</a>
          <a href="#certificate" className="hover:text-primon-950">The certificate</a>
          <a href="#monitoring" className="hover:text-primon-950">Monitoring</a>
        </nav>
        <Link href="/login">
          <Button variant="secondary" size="sm">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl overflow-hidden px-6 pb-24 pt-10 lg:px-10">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-reveal-up [animation-delay:80ms] opacity-0">
            <p className="mb-5 text-sm text-brass-600">
              Primon Enterprises Limited · Lilongwe, Malawi
            </p>
            <h1 className="font-display text-[2.75rem] leading-[1.08] text-primon-950 sm:text-6xl">
              Every fumigation, <em className="not-italic text-brass-600">certified</em> to the standard it deserves.
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
              The Fumigation Management System replaces paper conformance certificates
              and WhatsApp gas readings with one continuous record — from shipping
              instructions to a QR-verifiable certificate, for tobacco and grain,
              industrial and smallholder.
            </p>
            <div className="mt-9 flex items-center gap-4">
              <Link href="/login">
                <Button size="lg">Enter the platform</Button>
              </Link>
              <a href="#certificate" className="text-sm font-medium text-primon-800 hover:text-primon-950">
                See the certificate
              </a>
            </div>

            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8">
              <div>
                <dt className="font-display text-2xl text-primon-950 num">600ppm</dt>
                <dd className="mt-1 text-xs text-muted">Lethal threshold, monitored daily</dd>
              </div>
              <div>
                <dt className="font-display text-2xl text-primon-950 num">6 days</dt>
                <dd className="mt-1 text-xs text-muted">Consecutive compliant readings required</dd>
              </div>
              <div>
                <dt className="font-display text-2xl text-primon-950">2013</dt>
                <dd className="mt-1 text-xs text-muted">Incorporated, licensed applicator</dd>
              </div>
            </dl>
          </div>

          {/* Certificate hero visual */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="pointer-events-none absolute -inset-x-10 top-10 h-72 rounded-full bg-primon-100/70 blur-3xl" />
            <div className="relative w-full max-w-sm animate-scale-in rounded-2xl border border-border bg-white p-6 opacity-0 shadow-elevated [animation-delay:220ms] [transform:rotate(2deg)]">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <PrimonMark className="h-7 w-7 text-primon-800" />
                <span className="rounded-full bg-status-compliantTint px-2.5 py-1 text-[10px] font-medium text-status-compliant">
                  ● Certified
                </span>
              </div>
              <p className="mt-4 font-display text-[15px] text-primon-950">
                Fumigation Conformance Certificate
              </p>
              <p className="text-xs text-muted">FCC-PE-2026-000513</p>

              <div className="mt-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-dashed border-border pb-2">
                  <span className="text-muted">Supplier</span>
                  <span className="text-ink">Alliance One Malawi</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-border pb-2">
                  <span className="text-muted">Fumigant</span>
                  <span className="text-ink">Aluminium Phosphide</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-border pb-2">
                  <span className="text-muted">6-day monitoring</span>
                  <span className="text-status-compliant">All readings compliant</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-xl bg-primon-50 p-4">
                <div className="grid h-14 w-14 shrink-0 grid-cols-4 gap-[3px] rounded-md bg-primon-950 p-2">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className={i % 3 === 0 || i % 5 === 0 ? "bg-white" : "bg-transparent"}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-primon-900">Scan to verify</p>
                  <p className="text-[10px] text-muted">fms.primonenterprises.com/verify/FCC-PE-2026-000513</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform pillars */}
      <section id="platform" className="border-y border-border bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <p className="max-w-xl font-display text-2xl text-primon-950">
            One system, four disciplines of the job — built around how the certificate actually gets filled in.
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ClipboardList,
                title: "Shipping instructions",
                copy: "Clients complete supplier, consignee and crop details on their own timeline — fumigation doesn't wait on paperwork.",
              },
              {
                icon: Wind,
                title: "Fumigation description",
                copy: "Fumigant, formulation and dose, filtered by crop type and drawn straight from live stock.",
              },
              {
                icon: ShieldCheck,
                title: "6-day monitoring",
                copy: "Airspace and probe readings against the 600ppm threshold, flagged the moment a day falls critical.",
              },
              {
                icon: QrCode,
                title: "Certification & QR",
                copy: "One certifying action locks the record and issues a QR code that replaces the manual stamp.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white p-7">
                <f.icon className="h-5 w-5 text-brass-600" strokeWidth={1.5} />
                <h3 className="mt-4 font-display text-[17px] text-primon-950">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monitoring teaser */}
      <section id="monitoring" className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm text-brass-600">Replacing the WhatsApp thread</p>
            <h2 className="font-display text-3xl leading-tight text-primon-950 sm:text-4xl">
              A single reading below threshold is visible the moment it's recorded — not the moment someone scrolls back through chat.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Fumigation Supervisors log Airspace and Probe/Case readings directly into the
              system. Anything under 600ppm turns the day red, alerts the Operations
              Manager in-app and by email, and stays visible until a corrective action
              is logged and confirmed.
            </p>
            <Link href="/login" className="mt-7 inline-block">
              <Button variant="secondary">View the monitor</Button>
            </Link>
          </div>
          <div className="flex justify-center gap-3 rounded-2xl border border-border bg-white p-8 shadow-card">
            {[
              { d: 1, s: "compliant" },
              { d: 2, s: "compliant" },
              { d: 3, s: "critical" },
              { d: 4, s: "action_taken" },
              { d: 5, s: "compliant" },
              { d: 6, s: "compliant" },
            ].map((item) => (
              <div key={item.d} className="flex flex-col items-center gap-2">
                <div
                  className={
                    "flex h-24 w-6 items-end overflow-hidden rounded-full " +
                    (item.s === "critical"
                      ? "bg-status-criticalTint"
                      : item.s === "action_taken"
                        ? "bg-status-actionTint"
                        : "bg-status-compliantTint")
                  }
                >
                  <div
                    className={
                      "w-full rounded-full " +
                      (item.s === "critical"
                        ? "h-[42%] bg-status-critical"
                        : item.s === "action_taken"
                          ? "h-[58%] bg-status-action"
                          : "h-[78%] bg-status-compliant")
                    }
                  />
                </div>
                <span className="text-[10px] text-muted">D{item.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-primon-950 py-10 text-primon-300">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center lg:px-10">
          <PrimonLogo width={150} />
          <p className="text-xs">
            © 2026 Primon Enterprises Limited. Licensed commercial applicator, Malawi Pesticides Control Board.
          </p>
        </div>
      </footer>
    </main>
  );
}

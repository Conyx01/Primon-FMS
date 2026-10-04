"use client";

import { forwardRef } from "react";
import Image from "next/image";
import type { WorkOrder, GasReading } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(d: string | undefined | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function val(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className="mr-1 inline-block h-3.5 w-3.5 rounded-sm border border-current align-middle leading-none">
      {checked && <span className="block h-full w-full text-center text-[9px] leading-3.5">✓</span>}
    </span>
  );
}

function SigBlock({ label, name, date }: { label: string; name: string; date: string }) {
  return (
    <div className="flex flex-col gap-1 text-[9px]">
      <span className="font-bold uppercase tracking-wide">{label}</span>
      <div className="mt-3 border-b border-black/50 pb-0" />
      <span className="mt-0.5 text-[8px] text-gray-500">Signature</span>
      <span className="mt-2 font-medium">{name || "—"}</span>
      <span className="text-[8px] text-gray-500">Printed Name</span>
      <span className="mt-2">{date || "—"}</span>
      <span className="text-[8px] text-gray-500">Date</span>
    </div>
  );
}

// ─── column definitions ──────────────────────────────────────────────────────

const DAY_COLS = [
  { day: 0, label: "Placed\n(Day 0)", hours: null },
  { day: 1, label: "24 hrs", hours: 24 },
  { day: 2, label: "48 hrs", hours: 48 },
  { day: 3, label: "72 hrs", hours: 72 },
  { day: 4, label: "96 hrs", hours: 96 },
  { day: 5, label: "120 hrs", hours: 120 },
  { day: 6, label: "144 hrs", hours: 144 },
];

// ─── main component ──────────────────────────────────────────────────────────

interface Props {
  workOrder: WorkOrder;
}

export const CertificateView = forwardRef<HTMLElement, Props>(function CertificateView(
  { workOrder: wo },
  ref
) {
  const si = wo.si;
  const fum = wo.fumigation;

  // Build reading lookup by dayNumber
  const byDay = new Map<number, GasReading>(wo.readings.map((r) => [r.day, r]));

  // Formulation flags
  const formLower = (fum.formulation ?? "").toLowerCase();
  const isPlate = formLower.includes("plate");
  const isSachet = formLower.includes("sachet");
  const isTablet = formLower.includes("tablet");

  // Type flags
  const isContainer = fum.fumigationType === "container";
  const isSheeted = fum.fumigationType === "sheeted_stack";

  // Signature lookup
  const sigMap = new Map(wo.signatures?.map((s) => [s.role, s]) ?? []);
  const sigFum = sigMap.get("supervising_fumigator");
  const sigSup = sigMap.get("supplier_rep");
  const sigCer = sigMap.get("certifying_officer");

  const certDate = wo.certifiedAt ? fmt(wo.certifiedAt) : "—";

  // Primon address (hardcoded — always the contractor)
  const PRIMON_ADDRESS =
    "PLOT 13/51, AFRICANA BUILDING, CAPITAL CITY,\nP.O BOX 31633, LILONGWE, MALAWI.";
  const PRIMON_PHONE = "+265 (0) 1 754 432";
  const PRIMON_EMAIL = "info@primonenterprises.com";

  return (
    <article
      ref={ref}
      className="mx-auto w-[900px] max-w-full bg-white font-sans text-[10px] text-black shadow-md print:shadow-none"
      style={{ fontFamily: "'Arial', sans-serif" }}
    >
      {/* ── HEADER ── */}
      <div className="border-b-2 border-primon-800 px-8 py-4">
        <div className="flex items-start justify-between gap-6">
          {/* Left: logo + company */}
          <div className="flex flex-col gap-1.5">
            <Image
              src="/Primon-logo.png"
              alt="Primon Enterprises Ltd"
              width={160}
              height={Math.round((160 * 242) / 858)}
              className="object-contain"
              priority
              style={{ filter: "invert(1) sepia(1) saturate(3) hue-rotate(180deg)" }}
            />
            <p className="text-[7.5px] leading-4 text-gray-600 whitespace-pre-line">
              {PRIMON_ADDRESS}
              {"\n"}Tel: {PRIMON_PHONE} | Email: {PRIMON_EMAIL}
            </p>
          </div>

          {/* Right: title + meta */}
          <div className="flex flex-col items-end gap-1 text-right">
            <h1 className="text-[13px] font-extrabold uppercase tracking-widest text-primon-900">
              Fumigation Conformance Certificate
            </h1>
            <p className="text-[8px] font-medium text-gray-500 uppercase tracking-wide">
              {wo.cropType === "tobacco" ? "Tobacco" : titleCase(wo.cropType)} Fumigation
            </p>
            {wo.certificateNumber && (
              <p className="mt-1 rounded bg-primon-800 px-2 py-0.5 text-[9px] font-bold text-white tracking-widest">
                {wo.certificateNumber}
              </p>
            )}
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[8.5px]">
              {wo.salesOrderNo && (
                <>
                  <span className="font-semibold text-gray-500">Sales Order No.:</span>
                  <span>{wo.salesOrderNo}</span>
                </>
              )}
              {wo.shipmentNo && (
                <>
                  <span className="font-semibold text-gray-500">Shipment No.:</span>
                  <span>{wo.shipmentNo}</span>
                </>
              )}
              {wo.deliveryNo && (
                <>
                  <span className="font-semibold text-gray-500">Delivery No.:</span>
                  <span>{wo.deliveryNo}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: PARTIES ── */}
      <section className="px-8 pt-3 pb-2">
        <SectionTitle>1. Party Information</SectionTitle>
        <table className="w-full border-collapse text-[9px]">
          <tbody>
            <PartyRow
              label="TOBACCO SUPPLIER"
              name={si.tobaccoSupplier || "—"}
              address={si.supplierAddress || "—"}
            />
            <PartyRow
              label="CONSIGNEE"
              name={si.consignee || "—"}
              address={si.consigneeAddress || "—"}
            />
            <PartyRow
              label="FUMIGATION CONTRACTOR"
              name={si.fumigationContractor || "Primon Enterprises Limited"}
              address={PRIMON_ADDRESS.replace(/\n/g, ", ")}
            />
          </tbody>
        </table>
      </section>

      {/* ── SECTION 2: TOBACCO DESCRIPTION ── */}
      <section className="px-8 pt-2 pb-2">
        <SectionTitle>2. Tobacco Description</SectionTitle>
        <div className="grid grid-cols-4 gap-x-4 gap-y-1 border border-gray-300 p-2 text-[9px]">
          <Field label="Tobacco Type" value={si.tobaccoType || "—"} />
          <Field label="Grade Name" value={si.gradeName || "—"} />
          <Field label="Crop Year" value={si.cropYear || "—"} />
          <Field label="Country of Origin" value={si.countryOfOrigin || "—"} />
          <Field label="Net Weight (kg)" value={si.netWeight || "—"} />
          <Field label="Quantity (bales/cases)" value={si.quantity || "—"} />
          <Field label="Polylined" value={si.polylined || "—"} />
          <Field label="Case Nos." value={si.caseNos || "—"} />
          <Field label="Location" value={si.location || "—"} className="col-span-2" />
          <Field label="Warehouse Section" value={si.warehouseSection || "—"} className="col-span-2" />
        </div>
      </section>

      {/* ── SECTION 3: FUMIGATION DESCRIPTION ── */}
      <section className="px-8 pt-2 pb-2">
        <SectionTitle>3. Fumigation Description</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 border border-gray-300 p-2 text-[9px]">
          {/* Left column */}
          <div className="flex flex-col gap-1.5">
            <div>
              <span className="font-semibold text-gray-500 uppercase text-[8px]">Type</span>
              <div className="mt-0.5 flex gap-4">
                <label className="flex items-center gap-1">
                  <Checkbox checked={isContainer} />
                  Container
                </label>
                <label className="flex items-center gap-1">
                  <Checkbox checked={isSheeted} />
                  Sheeted Stack
                </label>
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-500 uppercase text-[8px]">Formulation</span>
              <div className="mt-0.5 flex gap-4">
                <label className="flex items-center gap-1">
                  <Checkbox checked={isPlate} />
                  Plate
                </label>
                <label className="flex items-center gap-1">
                  <Checkbox checked={isSachet} />
                  Sachet
                </label>
                <label className="flex items-center gap-1">
                  <Checkbox checked={isTablet} />
                  Tablet
                </label>
              </div>
            </div>
          </div>
          {/* Right column */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Field label="Fumigant" value={titleCase(fum.fumigantName || "—")} />
            <Field label="Dose (g/m³)" value={val(fum.dose)} />
            <Field label="Total Volume (m³)" value={val(fum.totalVolume)} />
            <Field label="Total Fumigant Used (g)" value={val(fum.totalFumigantUsed)} />
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FUMIGATION DATA ── */}
      <section className="px-8 pt-2 pb-2">
        <SectionTitle>4. Fumigation Data</SectionTitle>

        {/* Dates row */}
        <div className="mb-1.5 grid grid-cols-3 gap-x-4 border border-gray-300 px-2 py-1 text-[9px]">
          <Field label="Date Fumigant Placed" value={fmt(wo.datePlaced)} />
          <Field label="Aeration Began" value={fmt(wo.aerationBegan)} />
          <Field label="Aeration Completed" value={fmt(wo.aerationCompleted)} />
          {wo.durationHours != null && (
            <Field
              label="Duration under Gas (hrs)"
              value={String(wo.durationHours)}
              className="col-span-3"
            />
          )}
        </div>

        {/* Readings table — horizontal (columns = days, rows = measurements) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className="w-[120px] border border-gray-400 bg-gray-100 px-1.5 py-1 text-left font-semibold text-gray-700">
                  Parameter
                </th>
                {DAY_COLS.map((c) => (
                  <th
                    key={c.day}
                    className="border border-gray-400 bg-gray-100 px-1 py-1 text-center font-semibold text-gray-700 whitespace-pre-line"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="border border-gray-400 bg-gray-50 px-1.5 py-0.5 text-left text-[7.5px] font-medium text-gray-500">
                  Date
                </th>
                {DAY_COLS.map((c) => {
                  const r = byDay.get(c.day);
                  return (
                    <td
                      key={c.day}
                      className="border border-gray-400 bg-gray-50 px-1 py-0.5 text-center text-[7.5px] text-gray-600"
                    >
                      {r ? fmt(r.date) : "—"}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Airspace ppm */}
              <ReadingRow
                label="Airspace (ppm)"
                byDay={byDay}
                getValue={(r, day) =>
                  day === 0 ? "N/A" : val(r?.airspace)
                }
              />
              {/* Probe/Case ppm */}
              <ReadingRow
                label="Case/Base Probe (ppm)"
                byDay={byDay}
                getValue={(r, day) =>
                  day === 0 ? "N/A" : val(r?.probeCase)
                }
              />
              {/* Ambient temp — all days */}
              <ReadingRow
                label="Ambient Temp (°C)"
                byDay={byDay}
                getValue={(r) => val(r?.ambientTemp)}
                highlight={(r) => r?.ambientTemp == null}
              />
              {/* Product temp — Day 0 only, then N/A */}
              <ReadingRow
                label="Product Temp (°C)"
                byDay={byDay}
                getValue={(r, day) =>
                  day === 0 ? val(r?.productTemp) : "—"
                }
                highlight={(r, day) =>
                  day === 0 && (r?.productTemp ?? 0) < 16 && r?.productTemp != null
                }
              />
            </tbody>
          </table>
        </div>
        <p className="mt-0.5 text-[7.5px] text-gray-400 italic">
          * Ambient temperature must be recorded for all days. Product temperature is recorded on Day 0 (pre-fumigation check) only.
        </p>
      </section>

      {/* ── SECTION 5: CERTIFICATION ── */}
      <section className="px-8 pt-2 pb-3">
        <SectionTitle>5. Certification</SectionTitle>
        <div className="border border-gray-300 p-3 text-[8.5px] leading-5">
          <p>
            This is to certify that the above-described commodity was fumigated with phosphine gas
            (Magnesium or Aluminium Phosphide) in compliance with the recommendations and guidelines
            of <strong>CORESTA (Cooperation Centre for Scientific Research Relative to Tobacco)</strong> and
            the requirements of the <strong>National Plant Protection Organisation (NPPO)</strong> of the
            country of destination. The fumigation was carried out under the direct supervision of a
            qualified and authorised fumigator, and all gas concentration readings were monitored and
            recorded throughout the prescribed fumigation period.
          </p>
          <p className="mt-2">
            The commodity was deemed compliant at the conclusion of the fumigation period, and
            aeration was conducted prior to movement or release of the commodity. This certificate
            is issued based on the results obtained during fumigation monitoring and is valid for the
            purposes of phytosanitary compliance, export clearance, and trade documentation.
          </p>
          {wo.certificateNumber && (
            <p className="mt-2 font-semibold">
              Certificate No.: {wo.certificateNumber} &nbsp;|&nbsp; Date Certified: {certDate}
            </p>
          )}
        </div>
      </section>

      {/* ── SIGNATURES + QR ── */}
      <section className="px-8 pb-4">
        <div className="flex items-start gap-4">
          {/* Signature blocks */}
          <div className="flex flex-1 gap-6">
            <SigBlock
              label="Supervising Fumigator"
              name={sigFum?.signerName ?? ""}
              date={sigFum?.signedAt ? fmt(sigFum.signedAt) : ""}
            />
            <SigBlock
              label="For the Supplier"
              name={sigSup?.signerName ?? ""}
              date={sigSup?.signedAt ? fmt(sigSup.signedAt) : ""}
            />
            <SigBlock
              label="Certifying Officer"
              name={sigCer?.signerName ?? ""}
              date={sigCer?.signedAt ? fmt(sigCer.signedAt) : ""}
            />
          </div>

          {/* QR code */}
          {wo.verificationUrl && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(wo.verificationUrl)}`}
                alt="Verification QR"
                width={80}
                height={80}
                className="rounded border border-gray-200"
              />
              <span className="text-[7px] text-gray-400 text-center">
                Scan to verify
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 px-8 py-1.5 text-center text-[7.5px] text-gray-300">
        www.primonenterprises.com
      </footer>
    </article>
  );
});

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 text-[9px] font-bold uppercase tracking-wide text-primon-800 border-b border-primon-200 pb-0.5">
      {children}
    </h2>
  );
}

function PartyRow({
  label,
  name,
  address,
}: {
  label: string;
  name: string;
  address: string;
}) {
  return (
    <tr>
      <td className="w-[140px] border border-gray-300 bg-gray-50 px-2 py-1 font-bold uppercase text-[8px] text-gray-600 align-top">
        {label}
      </td>
      <td className="border border-gray-300 px-2 py-1 font-medium align-top">{name}</td>
      <td className="w-[30px] border border-gray-300 bg-gray-50 px-2 py-1 font-bold uppercase text-[8px] text-gray-600 align-top">
        Address
      </td>
      <td className="border border-gray-300 px-2 py-1 align-top whitespace-pre-line">{address}</td>
    </tr>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="block text-[7.5px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="block font-medium">{value}</span>
    </div>
  );
}

function ReadingRow({
  label,
  byDay,
  getValue,
  highlight,
}: {
  label: string;
  byDay: Map<number, GasReading>;
  getValue: (r: GasReading | undefined, day: number) => string;
  highlight?: (r: GasReading | undefined, day: number) => boolean;
}) {
  return (
    <tr>
      <td className="border border-gray-400 bg-gray-50 px-1.5 py-1 font-semibold text-gray-700">
        {label}
      </td>
      {DAY_COLS.map((c) => {
        const r = byDay.get(c.day);
        const v = getValue(r, c.day);
        const hl = highlight?.(r, c.day) ?? false;
        return (
          <td
            key={c.day}
            className={`border border-gray-400 px-1 py-1 text-center ${
              hl ? "bg-red-50 font-bold text-red-700" : ""
            }`}
          >
            {v}
          </td>
        );
      })}
    </tr>
  );
}

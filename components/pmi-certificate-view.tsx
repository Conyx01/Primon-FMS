"use client";

import { forwardRef } from "react";
import type { WorkOrder, GasReading } from "@/lib/types";
import { certificateSuccessfulReadings } from "@/lib/successful-days";

const PRINCE_CHIWALO = /prince\s+chiwalo/i;

function fmt(d: string | undefined | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
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

function Checkmark({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="font-bold underline decoration-2 underline-offset-2 mx-1">X</span>
  ) : (
    <span className="inline-block w-4 border-b border-black text-center mx-1">&nbsp;</span>
  );
}

export type PmiCertificateVariant = "pmi_crest" | "primon_logo";

interface Props {
  workOrder: WorkOrder;
  variant?: PmiCertificateVariant;
}

export const PmiCertificateView = forwardRef<HTMLElement, Props>(function PmiCertificateView(
  { workOrder: wo, variant = "pmi_crest" },
  ref
) {
  const si = wo.si;
  const fum = wo.fumigation;

  // Gas readings mapping
  const byDay = new Map<number, GasReading>();
  const day0 = wo.readings.find((r) => r.day === 0);
  if (day0) byDay.set(0, day0);
  const hasNonMon = wo.readings.some((r) => r.status === "not_monitored");
  certificateSuccessfulReadings(wo.readings).forEach((r, i) => {
    byDay.set(hasNonMon ? r.day : i + 1, r);
  });

  // Calculate minimum ambient temperature recorded during fumigation
  const validAmbientTemps = wo.readings
    .filter((r) => r.day > 0 && r.ambientTemp != null && r.status !== "not_monitored")
    .map((r) => r.ambientTemp as number);
  const minAmbientTemp = validAmbientTemps.length > 0 ? Math.min(...validAmbientTemps) : null;

  // Formulation flags
  const formLower = (fum.formulation ?? "").toLowerCase();
  const isPlate = formLower.includes("plate");
  const isTablet = formLower.includes("tablet");

  // Enclosure flags
  const isContainer = fum.fumigationType === "container";
  const isSheeted = fum.fumigationType === "sheeted_stack";

  // Signatures
  const sigMap = new Map(wo.signatures?.map((s) => [s.role, s]) ?? []);
  const sigFum = sigMap.get("supervising_fumigator");
  const sigSup = sigMap.get("supplier_rep");
  const certified = wo.status === "certified";
  const showPrinceSignature =
    certified && Boolean(sigFum?.signerName && PRINCE_CHIWALO.test(sigFum.signerName));

  const certDate = wo.certifiedAt ? fmt(wo.certifiedAt) : "—";
  const certNumberDisplay = wo.certificateNumber || wo.code;

  // Day 0 tobacco temperature
  const day0ProductTemp = day0?.productTemp != null ? day0.productTemp : null;

  // Infestation defaults
  const cigaretteBeetle = si.cigaretteBeetle ?? "N/A";
  const tobaccoMoth = si.tobaccoMoth ?? "N/A";
  const wetDeactivated = si.wetDeactivated !== false;

  function cellReading(dayNum: number, field: "airspace" | "probeCase") {
    const r = byDay.get(dayNum);
    if (!r) return "—";
    if (r.status === "not_monitored") return "Close";
    const v = r[field];
    return v != null ? String(v) : "—";
  }

  const PRIMON_ADDRESS = "P.O.BOX 31633 LILONGWE 3 MALAWI";

  return (
    <article
      ref={ref}
      className="mx-auto w-[794px] max-w-full bg-white font-sans text-[8.5px] text-black shadow-md print:shadow-none p-8 leading-tight"
      style={{ fontFamily: "'Arial', sans-serif" }}
    >
      {/* ── HEADER ── */}
      <div className="relative mb-3 pt-1 pb-2">
        {variant === "pmi_crest" ? (
          <>
            {/* PMI Crest variant: bold title centred, PMI SVG top-right */}
            <div className="text-center">
              <h1 className="text-[13px] font-black uppercase tracking-wide text-black">
                PMI-DESTINED TOBACCO FUMIGATION
              </h1>
              <p className="text-[9px] text-gray-800 mt-0.5">
                (via Standard Operating Procedure - SOP, PME Method # 751)
              </p>
              <div className="mt-2 text-[10px] font-bold">
                <span>CERTIFICATE NO. &nbsp;</span>
                <span className="border-b-2 border-black px-3 py-0.5 tracking-wider">
                  {certNumberDisplay}
                </span>
              </div>
            </div>
            <div className="absolute right-0 top-0 flex items-center justify-end h-16 w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pmi-logo.svg"
                alt="Philip Morris International"
                className="h-12 w-auto object-contain"
              />
            </div>
          </>
        ) : (
          /* Primon Logo variant: Primon logo centred, no right-side logo */
          <div className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-no-bg.png"
              alt="Primon Enterprises Limited"
              className="h-14 w-auto object-contain"
            />
            <div className="mt-1 text-[10px] font-bold">
              <span>CERTIFICATE NO. &nbsp;</span>
              <span className="border-b-2 border-black px-3 py-0.5 tracking-wider">
                {certNumberDisplay}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── TABLE 1: PARTIES ── */}
      <table className="w-full border-collapse border-2 border-black text-[8.5px] mb-2">
        <thead>
          <tr className="bg-slate-100">
            <th className="w-[28%] border border-black">&nbsp;</th>
            <th className="w-[44%] border border-black px-2 py-1 text-center font-bold">NAME</th>
            <th className="w-[28%] border border-black px-2 py-1 text-center font-bold">ADDRESSE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1.5 align-middle">
              <span className="block font-bold text-center">TOBACCO SUPPLIER</span>
            </td>
            <td className="border border-black p-1.5">
              <span className="font-bold">
                {si.tobaccoSupplier ||
                  "ALLIANCE ONE TOBACCO (MALAWI) LIMITED ON BEHALF OF ALLIANCE ONE INTERNATIONAL GMBH"}
              </span>
            </td>
            <td className="border border-black p-1.5 text-center font-medium">
              {si.supplierAddress || "P.O. BOX 30522 LILONGWE 3 MALAWI"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center font-bold">GRADE</td>
            <td className="border border-black p-1 text-center font-bold">{si.gradeName || "—"}</td>
            <td className="border border-black p-1 text-center font-medium">
              {si.consigneeAddress ? "203403" : "—"}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1.5 align-middle">
              <span className="block font-bold text-center">
                FUMIGATION CONTRACTOR
                <br />
                (or FUMIGATOR)
              </span>
            </td>
            <td className="border border-black p-1.5 font-bold">
              {si.fumigationContractor || "PRIMON ENTERPRISES LIMITED"}
            </td>
            <td className="border border-black p-1.5 text-center font-medium">
              {PRIMON_ADDRESS}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── SECTION 2: TOBACCO DESCRIPTION ── */}
      <div className="border-2 border-black p-2 mb-2">
        <h2 className="text-[10px] font-black underline mb-1">Tobacco Description</h2>
        <div className="grid grid-cols-[1fr_auto] gap-x-6">
          {/* Left Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="font-bold">Type: </span>
              <span>{si.productType || "Unmanufactured Malawi Burley Tobacco Strips"}</span>
            </div>
            <div>
              <span className="font-bold">Net Weight: </span>
              <span>{si.netWeight ? Number(si.netWeight).toLocaleString() : "—"}</span>
            </div>

            <div>
              <span className="font-bold">Crop Year: </span>
              <span>{si.cropYear || "2026"}</span>
            </div>
            <div>
              <span className="font-bold">Qty (no of cases): </span>
              <span>{si.quantity || "—"}</span>
            </div>

            <div>
              <span className="font-bold">Grade: </span>
              <span>{si.gradeName || "—"}</span>
            </div>
            <div>
              <span className="font-bold">Poly Lined: </span>
              <span>
                Yes <Checkmark checked={si.polylined === "Yes"} />
                No <Checkmark checked={si.polylined === "No"} />
                N/A <Checkmark checked={!si.polylined} />
              </span>
            </div>

            <div>
              <span className="font-bold">Container #: </span>
              <span>{si.containerNo || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold">Seal #: </span>
              <span>{si.sealNo || "N/A"}</span>
            </div>
          </div>

          {/* Right Checklist: Infested with */}
          <div className="border-l-2 border-black pl-4 flex flex-col justify-center min-w-[210px]">
            <span className="font-bold block mb-0.5">Infested with:</span>
            <div className="space-y-1">
              <div>
                <span>Cigarette beetle: </span>
                <span>
                  Yes <Checkmark checked={cigaretteBeetle === "Yes"} />
                  No <Checkmark checked={cigaretteBeetle === "No"} />
                  N/A <Checkmark checked={cigaretteBeetle === "N/A"} />
                </span>
              </div>
              <div>
                <span>Tobacco moth: </span>
                <span>
                  Yes <Checkmark checked={tobaccoMoth === "Yes"} />
                  No <Checkmark checked={tobaccoMoth === "No"} />
                  N/A <Checkmark checked={tobaccoMoth === "N/A"} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Prior Temperature Bar */}
        <div className="mt-1.5 pt-1 border-t border-gray-400">
          <span className="font-bold">
            Tobacco temperature (Centre of case/bale) recorded prior fumigation: &nbsp;
          </span>
          <span className="font-bold underline">
            {day0ProductTemp != null ? day0ProductTemp : "—"}
          </span>
          <span className="font-bold"> &nbsp;°C</span>
        </div>
      </div>

      {/* ── SECTION 3: FUMIGATION DESCRIPTION ── */}
      <div className="border-2 border-black p-2 mb-2 space-y-1">
        <h2 className="text-[10px] font-black underline">Fumigation Description</h2>
        <div>
          <span className="font-bold">Enclosure type: &nbsp;</span>
          <span>Container <Checkmark checked={isContainer} /></span>
          <span>Sheeted Stack <Checkmark checked={isSheeted} /></span>
          <span>Whole warehouse <Checkmark checked={false} /></span>
          <span>Chamber <Checkmark checked={false} /></span>
          <span>Other <Checkmark checked={!isContainer && !isSheeted} />,</span>
        </div>

        <div>
          <span className="font-bold">Fumigant Name: </span>
          <span className="font-bold uppercase">
            {fum.fumigantName ? fum.fumigantName.toUpperCase() : "MAGNESIUM PHOSPHIDE"}
          </span>
        </div>

        <div>
          <span className="font-bold">Formulation: &nbsp;</span>
          <span>Pellet <Checkmark checked={false} /></span>
          <span>Tablet <Checkmark checked={isTablet} /></span>
          <span>Bag <Checkmark checked={false} /></span>
          <span>Plate <Checkmark checked={isPlate} /></span>
          <span>Other <Checkmark checked={!isTablet && !isPlate} />,</span>
        </div>

        <div className="flex flex-wrap gap-x-6">
          <div>
            <span className="font-bold">Total Volume Fumigated (m³): </span>
            <span className="underline">{val(fum.totalVolume)}</span>
          </div>
          <div>
            <span className="font-bold">Dose PH3(g/m³): </span>
            <span className="underline">{val(fum.dose)}</span>
          </div>
          <div>
            <span className="font-bold">Total Fumigant used (g): </span>
            <span className="underline">{val(fum.totalFumigantUsed)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8">
          <div>
            <span className="font-bold">Total hours under gas: </span>
            <span className="underline">144</span>
          </div>
          <div>
            <span className="font-bold">Total Hours of Aeration: </span>
            <span className="underline">{wo.durationHours != null ? wo.durationHours : "48"}</span>
          </div>
          <div>
            <span className="font-bold">Fumigant wet deactivated: &nbsp;</span>
            <span>Yes <Checkmark checked={wetDeactivated} /></span>
            <span>No <Checkmark checked={!wetDeactivated} /></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4">
          <div>
            <span className="font-bold">Dates/Times: Fumigant placed: </span>
            <span className="underline">{fmt(wo.datePlaced)}</span>
          </div>
          <div>
            <span className="font-bold">Aeration begun: </span>
            <span className="underline">{fmt(wo.aerationBegan)}</span>
          </div>
          <div>
            <span className="font-bold">Aeration completed: </span>
            <span className="underline">{fmt(wo.aerationCompleted)}</span>
          </div>
        </div>

        <div>
          <span className="font-bold">
            Minimum ambient (surrounding) temperature recorded during fumigation: &nbsp;
          </span>
          <span className="underline font-bold">
            {minAmbientTemp != null ? minAmbientTemp : "—"}
          </span>
          <span className="font-bold"> &nbsp;°C</span>
        </div>
      </div>

      {/* ── SECTION 4: FUMIGATION DATA & REFERENCE TABLE ── */}
      <div className="border-2 border-black p-2 mb-2">
        <h2 className="text-[10px] font-black underline mb-1">Fumigation data</h2>

        {/* Reference Table */}
        <table className="w-full border-collapse border border-black text-[8px] mb-1.5 text-center">
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="border border-black p-0.5">Tobacco Pest</th>
              <th className="border border-black p-0.5">Tobacco Temprature (oC)</th>
              <th className="border border-black p-0.5">Phosphine Conc. (ppm)</th>
              <th className="border border-black p-0.5">Min. exposure-time (days)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={4} className="border border-black p-0.5 font-bold align-middle">
                Cigarette beetle
              </td>
              <td className="border border-black p-0.5">16 - 20</td>
              <td className="border border-black p-0.5">300</td>
              <td className="border border-black p-0.5">2</td>
            </tr>
            <tr>
              <td rowSpan={2} className="border border-black p-0.5 align-middle">20 - 25</td>
              <td className="border border-black p-0.5">300-700</td>
              <td className="border border-black p-0.5">12</td>
            </tr>
            <tr>
              <td className="border border-black p-0.5">&gt;700</td>
              <td className="border border-black p-0.5">10</td>
            </tr>
            <tr>
              <td className="border border-black p-0.5">&gt;25</td>
              <td className="border border-black p-0.5">300 - 600<br />&gt;600</td>
              <td className="border border-black p-0.5">12<br />6</td>
            </tr>
          </tbody>
        </table>

        {/* Regulatory notes */}
        <div className="text-[7.5px] leading-tight space-y-0.5 mb-1.5 text-gray-900">
          <p>Gas reading must be taken at the centre of one case/bale, away from the fumigant placement, USING A PROBE.</p>
          <p>The first reading shall be made 6-12 hours after fumigant placement.</p>
          <p className="font-bold">
            The tobacco consignment can be moved/transported on when &lt;0.1ppm phosphine is reached in the tobacco.
          </p>
        </div>

        {/* Telemetry Reading Table */}
        <table className="w-full border-collapse border-2 border-black text-[8px] text-center">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1 text-left w-[26%] font-bold">
                Time after fumigant Placement (hours)
              </th>
              <th className="border border-black p-0.5 w-[7%]">indicative</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">24</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">48</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">72</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">96</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">120</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">144</th>
              <th className="border border-black p-0.5 w-[8%] font-bold">168</th>
              <th className="border border-black p-0.5 w-[11%] font-bold bg-slate-50">End of Aeration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1 text-left font-bold" rowSpan={2}>
                Fumigation Phosphine Conc. (ppm)
              </td>
              <td className="border border-black p-0.5 font-medium">actual</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5">&nbsp;</td>
              <td className="border border-black p-0.5 bg-slate-50 font-bold">
                {wo.clearanceGasPpm != null ? wo.clearanceGasPpm : "0.01"}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left font-bold" colSpan={1}>
                Airspace* Tobacco Case/Bale
              </td>
              <td className="border border-black p-0.5 font-bold">{cellReading(1, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(2, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(3, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(4, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(5, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(6, "airspace")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(7, "airspace")}</td>
              <td className="border border-black p-0.5 bg-slate-50 font-bold">
                {wo.clearanceGasPpm != null ? wo.clearanceGasPpm : "0.01"}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left font-bold" colSpan={2}>
                Aeration Phosphine conc. (ppm) — Airspace (surrounding) Tobacco Case/Bale (until 0.1ppm)
              </td>
              <td className="border border-black p-0.5 font-bold">{cellReading(1, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(2, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(3, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(4, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(5, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(6, "probeCase")}</td>
              <td className="border border-black p-0.5 font-bold">{cellReading(7, "probeCase")}</td>
              <td className="border border-black p-0.5 bg-slate-50 font-bold">
                {wo.clearanceGasPpm != null ? wo.clearanceGasPpm : "0.01"}
              </td>
            </tr>
          </tbody>
        </table>
        <span className="text-[7px] text-gray-700 block mt-0.5">*optional</span>

        {/* Comments Row */}
        <div className="mt-1 pt-1 border-t border-gray-400 text-[8px]">
          <span className="font-bold">Comments: </span>
          <span className="text-gray-700">(For example, corrective actions made due to gas leaks, etc) &nbsp;</span>
          <span className="font-bold text-black">{wo.remarks || "—"}</span>
        </div>
      </div>

      {/* ── SECTION 5: SIGNATURES (Strictly on 1 page!) ── */}
      <div className="border-2 border-black p-2 bg-white">
        <h2 className="text-[10px] font-black underline mb-0.5">Signatures:</h2>
        <p className="text-[7.5px] text-gray-800 mb-2">
          (Attesting the information above is correct, that the fumigation practices adhered to the consignees instructions and that all fumigant residues were removed from the consignment).
        </p>

        <div className="flex items-stretch justify-between gap-6 pt-1">
          {/* Supervising Fumigator */}
          <div className="flex-1 space-y-2">
            {/* Name row */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">Supervising Fumigator:</span>
              <span className="border-b border-black flex-1 pb-0.5 font-bold text-[8px] px-1">
                {sigFum?.signerName || "Prince Chiwalo"}
              </span>
            </div>
            {/* Signature row — dedicated height for sig image */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">Signature:</span>
              <div className="relative border-b border-black flex-1 h-9">
                {showPrinceSignature && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/signature.png"
                    alt="Signature"
                    className="absolute bottom-0.5 left-2 h-8 w-auto object-contain"
                  />
                )}
              </div>
            </div>
            {/* Date row — its own line, no crowding */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">Date:</span>
              <span className="border-b border-black flex-1 pb-0.5 font-bold text-[8px] px-1">
                {certDate}
              </span>
            </div>
          </div>

          {/* For the Supplier */}
          <div className="flex-1 space-y-2">
            {/* Name row */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">For the Supplier:</span>
              <span className="border-b border-black flex-1 pb-0.5 font-bold text-[8px] px-1">
                {sigSup?.signerName || "—"}
              </span>
            </div>
            {/* Signature row */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">Signature:</span>
              <div className="border-b border-black flex-1 h-9"></div>
            </div>
            {/* Date row */}
            <div className="flex items-end gap-2">
              <span className="font-bold whitespace-nowrap text-[8px]">Date:</span>
              <span className="border-b border-black flex-1 pb-0.5 font-bold text-[8px] px-1">
                {certDate}
              </span>
            </div>
          </div>

          {/* Verification QR Code — displayed upon certification */}
          {certified && wo.verificationUrl && (
            <div className="flex flex-col items-center justify-center shrink-0 pl-3 border-l-2 border-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=65x65&data=${encodeURIComponent(wo.verificationUrl)}`}
                alt="Verification QR"
                width={65}
                height={65}
                className="rounded border border-black"
              />
              <span className="text-[7px] font-extrabold text-black text-center mt-0.5 tracking-tight">
                Scan to verify
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

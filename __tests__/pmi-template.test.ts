import { describe, it, expect } from "vitest";
import { certificateFilename } from "@/lib/download-certificate";

function isPmiTemplate(si: {
  certificateTemplate?: string | null;
  consignee?: string | null;
  consigneeAddress?: string | null;
}): boolean {
  return Boolean(
    si.certificateTemplate === "pmi" ||
      /philip\s*morris|pmi/i.test(si.consignee || "") ||
      /philip\s*morris|pmi/i.test(si.consigneeAddress || "")
  );
}

describe("PMI Template Detection & Filename Generation", () => {
  it("detects PMI when certificateTemplate is explicitly 'pmi'", () => {
    expect(isPmiTemplate({ certificateTemplate: "pmi" })).toBe(true);
  });

  it("auto-detects PMI when consignee is Philip Morris International", () => {
    expect(
      isPmiTemplate({
        consignee: "Philip Morris International Management SA",
      })
    ).toBe(true);
  });

  it("auto-detects PMI when consignee address mentions PMI", () => {
    expect(
      isPmiTemplate({
        consignee: "Alliance One GmbH",
        consigneeAddress: "PMI Operations Center, Lausanne",
      })
    ).toBe(true);
  });

  it("defaults to standard when consignee is Nyasa Tobacco or Limbe Leaf", () => {
    expect(
      isPmiTemplate({
        certificateTemplate: "standard",
        consignee: "Nyasa Tobacco Manufacturing Ltd",
      })
    ).toBe(false);
  });

  it("formats distinct filenames for both PMI variants and standard FCC", () => {
    const certNo = "087PE-26";
    const woCode = "WO-2026-00087";

    expect(certificateFilename(certNo, woCode, "pmi_crest")).toBe(
      "PMI-Crest-087PE-26.pdf"
    );
    expect(certificateFilename(certNo, woCode, "primon_logo")).toBe(
      "Primon-PMI-087PE-26.pdf"
    );
    expect(certificateFilename(certNo, woCode, "standard")).toBe(
      "Primon-standard-087PE-26.pdf"
    );
    expect(certificateFilename(certNo, woCode)).toBe("Primon-087PE-26.pdf");
  });
});

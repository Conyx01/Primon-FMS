import { describe, it, expect } from "vitest";
import { certificateFilename } from "@/lib/download-certificate";

function isPmiTemplate(si: {
  certificateTemplate?: string | null;
  consignee?: string | null;
  consigneeAddress?: string | null;
}): boolean {
  return Boolean(
    si.certificateTemplate === "pmi" ||
      /phil+ip\s*morris|pmi/i.test(si.consignee || "") ||
      /phil+ip\s*morris|pmi/i.test(si.consigneeAddress || "")
  );
}

describe("PMI Template Detection & Filename Generation", () => {
  it("detects PMI when certificateTemplate is explicitly 'pmi'", () => {
    expect(isPmiTemplate({ certificateTemplate: "pmi" })).toBe(true);
  });

  it("auto-detects PMI when consignee is Phillip Morris with double l", () => {
    expect(
      isPmiTemplate({
        consignee: "Phillip Morris",
      })
    ).toBe(true);
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

  it("maps PMI shipping grade, grade number, HTS, PO, and reference numbers", async () => {
    const { mapFccToWorkOrder } = await import("@/lib/map-fcc");
    const mapped = mapFccToWorkOrder({
      id: "fcc-123",
      certificateNumber: "088PM-12",
      status: "certified",
      workOrder: {
        id: "wo-123",
        code: "WO-2026-00088",
        cropType: "tobacco",
      },
      shippingInstructions: {
        tobaccoSupplier: "Alliance One Tobacco Malawi Ltd",
        tobaccoSupplierAddress: "P.O. Box 30522",
        consignee: "Philip Morris",
        consigneeAddress: "PMI Center",
        cropYear: "2026",
        tobaccoType: "Burley",
        netWeight: 38214,
        gradeName: "7S1MW",
        countryOfOrigin: "Malawi",
        location: null,
        warehouseSection: null,
        certificateTemplate: "pmi",
        shippingGrade: "7S26103",
        shippingGradeNo: "205590",
        htsNo: "2401.20.8520",
        pmiPoNo: "4900001210",
        pmiRefNo: "26-302",
      },
      readings: [],
    } as any);

    expect(mapped.si.shippingGrade).toBe("7S26103");
    expect(mapped.si.shippingGradeNo).toBe("205590");
    expect(mapped.si.gradeName).toBe("7S1MW");
    expect(mapped.si.htsNo).toBe("2401.20.8520");
    expect(mapped.si.pmiPoNo).toBe("4900001210");
    expect(mapped.si.pmiRefNo).toBe("26-302");
  });
});

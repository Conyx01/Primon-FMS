import { describe, it, expect } from "vitest";

/**
 * Pure diff computation function mirroring the backend FCC amendment audit logic.
 */
function computeAmendmentDiff(
  existing: {
    workOrder: {
      code: string;
      cropType: string;
      customProduct?: string | null;
      salesOrderNo?: string | null;
      shipmentNo?: string | null;
      deliveryNo?: string | null;
    };
    shippingInstructions: {
      consignee?: string | null;
      netWeight?: number | null;
      grossWeight?: number | null;
      containerNo?: string | null;
      sealNo?: string | null;
      additionalInfo?: string | null;
    } | null;
    signatures: { role: string; signerName: string }[];
  },
  payload: {
    reason: string;
    code?: string;
    cropType?: string;
    customProduct?: string | null;
    salesOrderNo?: string | null;
    shipmentNo?: string | null;
    deliveryNo?: string | null;
    consignee?: string | null;
    netWeight?: number | null;
    grossWeight?: number | null;
    containerNo?: string | null;
    sealNo?: string | null;
    additionalInfo?: string | null;
    signers?: Record<string, string>;
  }
) {
  const trimmedReason = payload.reason?.trim();
  if (!trimmedReason) {
    throw new Error("A valid reason for amendment is strictly required.");
  }

  const changes: Record<string, { from: any; to: any }> = {};

  // Work order
  if (payload.code !== undefined && payload.code.trim() !== existing.workOrder.code) {
    changes.workOrderCode = { from: existing.workOrder.code, to: payload.code.trim() };
  }
  if (payload.salesOrderNo !== undefined) {
    const nextVal = payload.salesOrderNo?.trim() || null;
    const prevVal = existing.workOrder.salesOrderNo || null;
    if (nextVal !== prevVal) {
      changes.salesOrderNo = { from: prevVal, to: nextVal };
    }
  }

  // Shipping instructions
  const si = existing.shippingInstructions;
  if (payload.consignee !== undefined) {
    const nextVal = payload.consignee?.trim() || null;
    const prevVal = si?.consignee || null;
    if (nextVal !== prevVal) {
      changes.consignee = { from: prevVal, to: nextVal };
    }
  }
  if (payload.containerNo !== undefined) {
    const nextVal = payload.containerNo?.trim() || null;
    const prevVal = si?.containerNo || null;
    if (nextVal !== prevVal) {
      changes.containerNo = { from: prevVal, to: nextVal };
    }
  }
  if (payload.sealNo !== undefined) {
    const nextVal = payload.sealNo?.trim() || null;
    const prevVal = si?.sealNo || null;
    if (nextVal !== prevVal) {
      changes.sealNo = { from: prevVal, to: nextVal };
    }
  }
  if (payload.netWeight !== undefined) {
    const nextVal = payload.netWeight ?? null;
    const prevVal = si?.netWeight ?? null;
    if (nextVal !== prevVal) {
      changes.netWeight = { from: prevVal, to: nextVal };
    }
  }

  // Signers
  if (payload.signers) {
    for (const [role, newName] of Object.entries(payload.signers)) {
      const prev = existing.signatures.find((s) => s.role === role)?.signerName || null;
      const next = newName.trim() || null;
      if (prev !== next) {
        changes[`signer_${role}`] = { from: prev, to: next };
      }
    }
  }

  return {
    reason: trimmedReason,
    changesCount: Object.keys(changes).length,
    changes,
  };
}

describe("FCC Amendment Diff & Audit Validation", () => {
  const sampleFcc = {
    workOrder: {
      code: "NYASA120-25",
      cropType: "tobacco",
      salesOrderNo: "SO-9912",
    },
    shippingInstructions: {
      consignee: "Alliance One International",
      containerNo: "MSCU123456",
      sealNo: "MLW-001",
      netWeight: 120000,
    },
    signatures: [
      { role: "supervising_fumigator", signerName: "Prince Chiwalo" },
      { role: "supplier_rep", signerName: "J. Phiri" },
      { role: "certifying_officer", signerName: "M. Banda" },
    ],
  };

  it("throws an error when mandatory amendment reason is empty or whitespace", () => {
    expect(() =>
      computeAmendmentDiff(sampleFcc, {
        reason: "   ",
        containerNo: "MSCU654321",
      })
    ).toThrow("A valid reason for amendment is strictly required.");
  });

  it("tracks container number and seal number corrections", () => {
    const result = computeAmendmentDiff(sampleFcc, {
      reason: "Client swapped container at loading gate",
      containerNo: "MSCU999888",
      sealNo: "MLW-999",
    });

    expect(result.reason).toBe("Client swapped container at loading gate");
    expect(result.changesCount).toBe(2);
    expect(result.changes.containerNo).toEqual({
      from: "MSCU123456",
      to: "MSCU999888",
    });
    expect(result.changes.sealNo).toEqual({
      from: "MLW-001",
      to: "MLW-999",
    });
  });

  it("does not report unchanged fields as changes", () => {
    const result = computeAmendmentDiff(sampleFcc, {
      reason: "Check with same container",
      containerNo: "MSCU123456",
      sealNo: "MLW-001",
    });

    expect(result.changesCount).toBe(0);
    expect(result.changes).toEqual({});
  });

  it("tracks signatory corrections when a name was misspelled", () => {
    const result = computeAmendmentDiff(sampleFcc, {
      reason: "Corrected typo in certifying officer name",
      signers: {
        certifying_officer: "M. Banda (Senior Inspector)",
      },
    });

    expect(result.changesCount).toBe(1);
    expect(result.changes.signer_certifying_officer).toEqual({
      from: "M. Banda",
      to: "M. Banda (Senior Inspector)",
    });
  });

  it("tracks work order code typo correction", () => {
    const result = computeAmendmentDiff(sampleFcc, {
      reason: "Corrected work order code to match Nyasa invoice",
      code: "NYASA121-25",
    });

    expect(result.changesCount).toBe(1);
    expect(result.changes.workOrderCode).toEqual({
      from: "NYASA120-25",
      to: "NYASA121-25",
    });
  });
});

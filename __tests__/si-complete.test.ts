import { describe, it, expect } from "vitest";
import { isShippingInstructionsComplete, resumeWizardStep } from "@/lib/si-complete";

describe("isShippingInstructionsComplete", () => {
  it("requires both consignor and consignee names", () => {
    expect(isShippingInstructionsComplete(null)).toBe(false);
    expect(isShippingInstructionsComplete({ tobaccoSupplier: "A", consignee: "" })).toBe(
      false
    );
    expect(isShippingInstructionsComplete({ tobaccoSupplier: "A", consignee: "B" })).toBe(
      true
    );
  });
});

describe("resumeWizardStep", () => {
  it("opens SI when the client has not filled consignor and consignee", () => {
    expect(resumeWizardStep({ shippingInstructions: null, fumigationDescription: null })).toBe(
      1
    );
  });

  it("opens fumigation when SI is complete and description is missing", () => {
    expect(
      resumeWizardStep({
        shippingInstructions: { tobaccoSupplier: "Consignor", consignee: "Buyer" },
        fumigationDescription: null,
      })
    ).toBe(2);
  });

  it("sends staff to the monitor when fumigation description already exists", () => {
    expect(
      resumeWizardStep({
        shippingInstructions: { tobaccoSupplier: "Consignor", consignee: "Buyer" },
        fumigationDescription: { id: "desc" },
      })
    ).toBeNull();
  });
});

/** SI is "complete" when consignor (supplier) and consignee names are present. */
export function isShippingInstructionsComplete(si: {
  tobaccoSupplier?: string | null;
  consignee?: string | null;
} | null | undefined): boolean {
  return Boolean(si?.tobaccoSupplier?.trim() && si?.consignee?.trim());
}

/**
 * Where staff should resume a draft work order in the wizard.
 * 1 = Shipping instructions, 2 = Fumigation description.
 * Returns null when the job already has fumigation and should open the monitor.
 */
export function resumeWizardStep(args: {
  shippingInstructions?: {
    tobaccoSupplier?: string | null;
    consignee?: string | null;
  } | null;
  fumigationDescription?: unknown | null;
}): number | null {
  if (args.fumigationDescription) return null;
  if (isShippingInstructionsComplete(args.shippingInstructions)) return 2;
  return 1;
}

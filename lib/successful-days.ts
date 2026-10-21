/** Six lethal-concentration days required before certification. */
export const REQUIRED_SUCCESSFUL_GAS_DAYS = 6;

export type GasDayFields = {
  dayNumber: number;
  status: string;
  readingDate?: Date | string;
};

function isGasDay(r: GasDayFields): boolean {
  return r.dayNumber > 0;
}

export function successfulGasDayCount(readings: GasDayFields[]): number {
  return readings.filter((r) => isGasDay(r) && r.status === "compliant").length;
}

export function hasPendingGasDay(readings: GasDayFields[]): boolean {
  return readings.some((r) => isGasDay(r) && r.status === "pending");
}

export function hasOpenCriticalGasDay(readings: GasDayFields[]): boolean {
  return readings.some((r) => isGasDay(r) && r.status === "critical");
}

export function canCertifyGasReadings(readings: GasDayFields[]): boolean {
  return (
    successfulGasDayCount(readings) >= REQUIRED_SUCCESSFUL_GAS_DAYS &&
    !hasOpenCriticalGasDay(readings) &&
    !hasPendingGasDay(readings)
  );
}

/** Certificate columns 1–6: successful days only, in date order. */
export function certificateSuccessfulReadings<
  T extends { day: number; status: string; date: string },
>(readings: T[]): T[] {
  return readings
    .filter((r) => r.day > 0 && r.status === "compliant")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, REQUIRED_SUCCESSFUL_GAS_DAYS);
}

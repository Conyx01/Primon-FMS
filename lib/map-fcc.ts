import type { FccStatus, GasReading, ShippingInstructions, WorkOrder } from "@/lib/types";

type ApiFcc = {
  id: string;
  certificateNumber: string | null;
  status: FccStatus;
  certifiedAt: string | null;
  verificationUrl: string | null;
  workOrder: {
    id: string;
    code: string;
    source?: string;
    cropType: WorkOrder["cropType"];
    scale?: string;
    salesOrderNo: string | null;
    shipmentNo: string | null;
    deliveryNo: string | null;
    createdAt: string;
    client?: { name: string } | null;
  };
  shippingInstructions?: {
    tobaccoSupplier: string | null;
    tobaccoSupplierAddress: string | null;
    consignee: string | null;
    consigneeAddress: string | null;
    fumigationContractor: string | null;
    cropYear: string | null;
    tobaccoType: string | null;
    netWeight: number | null;
    quantity: number | null;
    polylined: boolean | null;
    gradeName: string | null;
    caseNos: string | null;
    countryOfOrigin: string | null;
    location: string | null;
    warehouseSection: string | null;
    lockedAt?: string | null;
  } | null;
  fumigationDescription?: {
    fumigationType: string;
    fumigant?: { name: string };
    formulation?: { name: string };
    doseGm3: number;
    totalVolumeM3: number;
    totalFumigantUsedG: number;
  } | null;
  gasReadings?: {
    dayNumber: number;
    readingDate: string;
    airspacePpm: number | null;
    probeCasePpm: number | null;
    ambientTempC: number | null;
    productTempC: number | null;
    relativeHumidityPct: number | null;
    status: GasReading["status"];
    correctiveAction?: {
      description: string;
      actionTakenAt: string;
      loggedBy?: { name: string };
    } | null;
  }[];
  closeout?: {
    datePlaced: string;
    aerationBegan: string | null;
    aerationCompleted: string | null;
    durationHours: number | null;
  } | null;
  signatures?: {
    role: string;
    signerName: string;
    signedAt: string;
  }[];
};

function emptySi(): ShippingInstructions {
  return {
    tobaccoSupplier: "",
    supplierAddress: "",
    consignee: "",
    consigneeAddress: "",
    fumigationContractor: "Primon Enterprises Limited",
    cropYear: "",
    tobaccoType: "",
    netWeight: "",
    quantity: "",
    polylined: "No",
    gradeName: "",
    caseNos: "",
    countryOfOrigin: "",
    location: "",
    warehouseSection: "",
    complete: false,
  };
}

export function mapFccToWorkOrder(fcc: ApiFcc): WorkOrder {
  const siRow = fcc.shippingInstructions;
  const si: ShippingInstructions = siRow
    ? {
        tobaccoSupplier: siRow.tobaccoSupplier ?? "",
        supplierAddress: siRow.tobaccoSupplierAddress ?? "",
        consignee: siRow.consignee ?? "",
        consigneeAddress: siRow.consigneeAddress ?? "",
        fumigationContractor: siRow.fumigationContractor ?? "Primon Enterprises Limited",
        cropYear: siRow.cropYear ?? "",
        tobaccoType: siRow.tobaccoType ?? "",
        netWeight: siRow.netWeight != null ? String(siRow.netWeight) : "",
        quantity: siRow.quantity != null ? String(siRow.quantity) : "",
        polylined: siRow.polylined ? "Yes" : "No",
        gradeName: siRow.gradeName ?? "",
        caseNos: siRow.caseNos ?? "",
        countryOfOrigin: siRow.countryOfOrigin ?? "",
        location: siRow.location ?? "",
        warehouseSection: siRow.warehouseSection ?? "",
        complete: Boolean(siRow.tobaccoSupplier && siRow.consignee),
      }
    : emptySi();

  const fum = fcc.fumigationDescription;
  const fumigantName =
    fum?.fumigant?.name === "magnesium_phosphide"
      ? "Magnesium Phosphide"
      : "Aluminium Phosphide";

  return {
    id: fcc.workOrder.id,
    code: fcc.workOrder.code,
    codeSource:
      fcc.workOrder.source === "client_supplied"
        ? "client_supplied"
        : fcc.workOrder.source === "website"
          ? "website"
          : "auto_generated",
    client: fcc.workOrder.client?.name ?? "—",
    cropType: fcc.workOrder.cropType,
    scale: fcc.workOrder.scale === "smallholder" ? "smallholder" : "industrial",
    status: fcc.status,
    createdAt: fcc.workOrder.createdAt,
    salesOrderNo: fcc.workOrder.salesOrderNo ?? undefined,
    shipmentNo: fcc.workOrder.shipmentNo ?? undefined,
    deliveryNo: fcc.workOrder.deliveryNo ?? undefined,
    si,
    fumigation: {
      fumigationType: fum?.fumigationType === "container" ? "container" : "sheeted_stack",
      fumigantName,
      formulation: fum?.formulation?.name?.replaceAll("_", " ") ?? "",
      dose: fum?.doseGm3 ?? 0,
      totalVolume: fum?.totalVolumeM3 ?? 0,
      totalFumigantUsed: fum?.totalFumigantUsedG ?? 0,
      complete: Boolean(fum),
    },
    readings: (fcc.gasReadings ?? []).map((r) => ({
      day: r.dayNumber,
      date: r.readingDate,
      airspace: r.airspacePpm,
      probeCase: r.probeCasePpm,
      ambientTemp: r.ambientTempC,
      productTemp: r.productTempC,
      humidity: r.relativeHumidityPct,
      status: r.status,
      correctiveAction: r.correctiveAction
        ? {
            note: r.correctiveAction.description,
            loggedBy: r.correctiveAction.loggedBy?.name ?? "Staff",
            loggedAt: r.correctiveAction.actionTakenAt,
          }
        : undefined,
    })),
    datePlaced: fcc.closeout?.datePlaced,
    aerationBegan: fcc.closeout?.aerationBegan ?? undefined,
    aerationCompleted: fcc.closeout?.aerationCompleted ?? undefined,
    durationHours: fcc.closeout?.durationHours ?? undefined,
    certificateNumber: fcc.certificateNumber ?? undefined,
    certifiedAt: fcc.certifiedAt ?? undefined,
    verificationUrl: fcc.verificationUrl ?? undefined,
    signatures: fcc.signatures ?? [],
  };
}

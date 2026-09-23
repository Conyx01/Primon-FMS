export type CropType = "tobacco" | "grain";
export type FumigationType = "container" | "sheeted_stack";
export type FumigantName = "Aluminium Phosphide" | "Magnesium Phosphide";

export type FccStatus =
  | "draft"
  | "in_progress"
  | "under_review"
  | "flagged"
  | "certified";

export type DayStatus = "pending" | "compliant" | "critical" | "action_taken";

export interface ShippingInstructions {
  tobaccoSupplier: string;
  supplierAddress: string;
  consignee: string;
  consigneeAddress: string;
  cropYear: string;
  tobaccoType: string;
  netWeight: string;
  quantity: string;
  polylined: "Yes" | "No";
  gradeName: string;
  caseNos: string;
  countryOfOrigin: string;
  location: string;
  warehouseSection: string;
  complete: boolean;
}

export interface FumigationDescription {
  fumigationType: FumigationType;
  fumigantName: FumigantName;
  formulation: string;
  dose: number;
  totalVolume: number;
  totalFumigantUsed: number;
  complete: boolean;
}

export interface GasReading {
  day: number;
  date: string;
  airspace: number | null;
  probeCase: number | null;
  ambientTemp: number | null;
  productTemp: number | null;
  humidity: number | null;
  status: DayStatus;
  correctiveAction?: {
    note: string;
    loggedBy: string;
    loggedAt: string;
  };
}

export interface WorkOrder {
  id: string;
  code: string;
  codeSource: "client_supplied" | "auto_generated" | "website";
  client: string;
  cropType: CropType;
  scale: "industrial" | "smallholder";
  status: FccStatus;
  createdAt: string;
  salesOrderNo?: string;
  shipmentNo?: string;
  deliveryNo?: string;
  si: ShippingInstructions;
  fumigation: FumigationDescription;
  readings: GasReading[];
  datePlaced?: string;
  aerationBegan?: string;
  aerationCompleted?: string;
  durationHours?: number;
  certificateNumber?: string;
  certifiedAt?: string;
}

export interface StockFormulation {
  id: string;
  fumigant: FumigantName;
  formulation: string;
  cropType: CropType | "both";
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
}

export type DemoRole = "ops_manager" | "admin" | "supervisor" | "client" | "executive";

export interface PendingSubmission {
  id: string;
  sourceType: "work_order" | "rfq" | "rfw";
  name: string;
  contact: string;
  cropOrService: string;
  message: string;
  receivedAt: string;
}

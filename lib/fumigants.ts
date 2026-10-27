import { CropType, FumigantName, StockFormulation } from "./types";

export const FUMIGANTS: FumigantName[] = ["Aluminium Phosphide", "Magnesium Phosphide"];

export function availableFormulations(
  fumigant: FumigantName,
  cropType: CropType,
  stock: StockFormulation[]
): StockFormulation[] {
  return stock.filter(
    (s) =>
      s.fumigant === fumigant &&
      (s.cropType === cropType || s.cropType === "both" || cropType === "other")
  );
}

"use client";

import { createContext, useContext, useMemo } from "react";
import { useLocalStorage } from "./use-local-storage";
import { mockStock, mockWorkOrders } from "./mock-data";
import { DemoRole, StockFormulation, WorkOrder } from "./types";

interface DemoStore {
  workOrders: WorkOrder[];
  addWorkOrder: (wo: WorkOrder) => void;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>) => void;
  stock: StockFormulation[];
  adjustStock: (id: string, delta: number) => void;
  hydrated: boolean;
}

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [workOrders, setWorkOrders, woHydrated] = useLocalStorage<WorkOrder[]>(
    "primon-demo-work-orders",
    mockWorkOrders
  );
  const [stock, setStock, stockHydrated] = useLocalStorage<StockFormulation[]>(
    "primon-demo-stock",
    mockStock
  );

  const addWorkOrder = (wo: WorkOrder) => setWorkOrders((prev) => [wo, ...prev]);

  const updateWorkOrder = (id: string, patch: Partial<WorkOrder>) =>
    setWorkOrders((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );

  const adjustStock = (id: string, delta: number) =>
    setStock((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, quantityOnHand: Math.max(0, s.quantityOnHand + delta) }
          : s
      )
    );

  const value = useMemo(
    () => ({
      workOrders,
      addWorkOrder,
      updateWorkOrder,
      stock,
      adjustStock,
      hydrated: woHydrated && stockHydrated,
    }),
    [workOrders, stock, woHydrated, stockHydrated]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

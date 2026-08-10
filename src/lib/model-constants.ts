import { PRODUCT_CATEGORIES } from "./product-constants";

// ADR-0011: a Model's identity is (name, category), where category **equals**
// products.product_category (the canonical, list-driven PRODUCT_CATEGORIES —
// Coat/Jacket/…/Accessories/Other). The old dormant lowercase enum
// (coat/jacket/shirt/…) is gone — both here and as the dropped DB CHECK.
export const MODEL_CATEGORIES = PRODUCT_CATEGORIES;

// ── Model Version lifecycle (ADR-0011 §3.4) ──────────────────────────────
// active → frozen (on ProductionBatch creation) → deprecated (manual).
export const MODEL_VERSION_STATUSES = ["active", "frozen", "deprecated"] as const;
export type ModelVersionStatus = (typeof MODEL_VERSION_STATUSES)[number];
export const MODEL_VERSION_STATUS_LABELS: Record<ModelVersionStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  deprecated: "Deprecated",
};

// ── Model Version non-main material roles ────────────────────────────────
// Mirrors model_version_materials.role CHECK. Main material stays on the Product;
// these are the shared non-main slots the Version owns (lining incl.).
export const MODEL_VERSION_MATERIAL_ROLES = [
  "lining",
  "sleeve_lining",
  "pocket_facing",
  "pocket_bag",
  "interfacing",
  "accessories",
] as const;
export type ModelVersionMaterialRole = (typeof MODEL_VERSION_MATERIAL_ROLES)[number];
export const MODEL_VERSION_MATERIAL_ROLE_LABELS: Record<ModelVersionMaterialRole, string> = {
  lining: "Lining",
  sleeve_lining: "Sleeve Lining",
  pocket_facing: "Pocket Facing",
  pocket_bag: "Pocket Bag",
  interfacing: "Interfacing",
  accessories: "Accessories",
};

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProductRecipeCard, type ProductRecipeCard } from "@/app/actions/models";
import { ModelVersionEditModal } from "@/components/model-version-editor";
import { CollapsibleCard } from "@/components/collapsible-card";
import { calcMfgAmountFromHours } from "@/lib/pricing";
import { formatHours } from "@/lib/presets";

const fmt = (n: number) => Math.round(n).toLocaleString();
const MFG_KEYS = ["cutting", "sewing", "knitting", "thread", "finish", "packing"] as const;
const MFG_LABELS: Record<(typeof MFG_KEYS)[number], string> = {
  cutting: "Cutting", sewing: "Sewing", knitting: "Knitting", thread: "Thread", finish: "Finish", packing: "Packing",
};

// ADR-0011 §9.7 — read-only window into the linked Model Version's shared recipe. The recipe
// (non-main materials + 用尺, lining, sizes, accessory composition, mfg template) is Version-owned;
// this card displays it and links to the Version editor (which live-propagates cost to pre-batch
// products). The product's OWN main material / manufacturing time / pricing stay in the forms above.
export function ProductModelRecipeCard({ productId }: { productId: string }) {
  const router = useRouter();
  const [card, setCard] = useState<ProductRecipeCard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    getProductRecipeCard(productId).then((c) => { if (alive) { setCard(c); setLoaded(true); } });
    return () => { alive = false; };
  }, [productId]);
  useEffect(() => load(), [load]);

  // A version edit propagates cost to pre-batch products — refetch this card AND refresh the page
  // so the Materials & Cost section picks up the recalculated numbers.
  const afterVersionChange = useCallback(() => {
    setEditing(false);
    load();
    router.refresh();
  }, [load, router]);

  // Not linked to a version (e.g. a legacy product): render nothing rather than an empty card.
  if (loaded && !card) return null;

  const seasonLabel = card ? card.bundle.data.season : "";
  const roleLabel = (r: string) => card?.bundle.roleLabels[r] ?? r;

  return (
    <>
      <CollapsibleCard
        title={loaded ? `Model Recipe (${seasonLabel})` : "Model Recipe"}
        defaultOpen={false}
        right={
          card?.isOldVersion ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              old version{card.latestSeason ? ` · newer: ${card.latestSeason}` : ""}
            </span>
          ) : undefined
        }
      >
        {!loaded ? (
          <p className="text-sm text-gray-400 py-2">Loading…</p>
        ) : card ? (
          <RecipeBody card={card} roleLabel={roleLabel} onEdit={() => setEditing(true)} />
        ) : null}
      </CollapsibleCard>

      {editing && card && (
        <ModelVersionEditModal
          versionId={card.bundle.data.versionId}
          versionIds={card.versionIds}
          onClose={() => setEditing(false)}
          onDone={afterVersionChange}
          onDuplicated={afterVersionChange}
        />
      )}
    </>
  );
}

function RecipeBody({
  card,
  roleLabel,
  onEdit,
}: {
  card: ProductRecipeCard;
  roleLabel: (r: string) => string;
  onEdit: () => void;
}) {
  const { data, materials, laborRate } = card.bundle;
  const matById = new Map(materials.map((m) => [m.id, m]));
  const setPriceOf = (id: string) => Number(matById.get(id)?.set_price_jpy ?? 0);
  const colorName = (materialId: string, colorId: string | null) =>
    colorId ? matById.get(materialId)?.colors?.find((c) => c.id === colorId)?.color ?? null : null;

  const lining = data.materials.find((m) => m.role === "lining") ?? null;
  const others = data.materials.filter((m) => m.role !== "lining");
  const liningCost = lining ? setPriceOf(lining.material_id) * lining.usage_amount : 0;
  const othersCost = others.reduce((s, m) => s + setPriceOf(m.material_id) * m.usage_amount, 0);
  const nonMainTotal = liningCost + othersCost;
  const mfgHours = MFG_KEYS.map((k) => data.minutes[k] / 60);
  const totalHours = mfgHours.reduce((s, h) => s + h, 0);
  const mfgCost = mfgHours.reduce((s, h) => s + calcMfgAmountFromHours(h, laborRate), 0);

  const matLine = (materialId: string, colorId: string | null, usage: number) => {
    const m = matById.get(materialId);
    const cn = colorName(materialId, colorId);
    return (
      <>
        <span className="text-gray-900">{m?.name ?? "—"}</span>
        {m?.material_number && <span className="ml-1.5 text-gray-400 font-mono text-[11px]">{m.material_number}</span>}
        {cn && <span className="ml-1.5 text-gray-500">/ {cn}</span>}
        <span className="ml-2 text-gray-400">{usage} {m?.unit_type ?? ""}</span>
      </>
    );
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {data.modelName} · {data.category}
          {data.locked && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🔒 in production</span>}
        </p>
        <button type="button" onClick={onEdit}
          className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900">
          Edit Model version →
        </button>
      </div>

      {/* Lining */}
      <div className="border border-gray-100 rounded-lg p-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{roleLabel("lining")}</p>
        {lining ? (
          <div className="flex items-center justify-between">
            <span>{matLine(lining.material_id, lining.material_color_id, lining.usage_amount)}</span>
            <span className="font-mono text-gray-500">¥{fmt(liningCost)}</span>
          </div>
        ) : (
          <span className="text-gray-400 italic text-xs">None</span>
        )}
      </div>

      {/* Other non-main materials */}
      <div className="border border-gray-100 rounded-lg p-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Other non-main materials &amp; 用尺</p>
        {others.length ? (
          <ul className="space-y-1">
            {others.map((m, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>
                  <span className="text-gray-500 w-28 inline-block">{roleLabel(m.role)}</span>
                  {matLine(m.material_id, m.material_color_id, m.usage_amount)}
                </span>
                <span className="font-mono text-gray-500">¥{fmt(setPriceOf(m.material_id) * m.usage_amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-300 italic text-xs">None</span>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 mt-2 pt-2">
          <span className="text-xs font-medium text-gray-600">Non-main material subtotal</span>
          <span className="font-mono font-semibold text-gray-900">¥{fmt(nonMainTotal)}</span>
        </div>
      </div>

      {/* Sizes + composition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-gray-100 rounded-lg p-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Orderable sizes</p>
          {data.orderableSizes.length ? (
            <div className="flex flex-wrap gap-1">
              {data.orderableSizes.map((s) => (
                <span key={s} className="min-w-[1.75rem] text-center px-1.5 py-0.5 rounded border border-gray-300 text-xs text-gray-700">{s}</span>
              ))}
            </div>
          ) : <span className="text-gray-300 italic text-xs">None</span>}
        </div>
        <div className="border border-gray-100 rounded-lg p-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Accessory composition</p>
          <span className="text-gray-700 text-xs">{data.accessoryComposition || <span className="text-gray-300 italic">None</span>}</span>
        </div>
      </div>

      {/* Manufacturing template (informational — the product owns its actual time in Materials & Cost) */}
      <div className="border border-gray-100 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Manufacturing template</p>
          <span className="text-[11px] text-gray-400">this product&apos;s actual time is editable above</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {MFG_KEYS.map((k, i) => (
            <span key={k}>{MFG_LABELS[k]}: <span className="font-mono">{formatHours(mfgHours[i])}h</span></span>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Total {formatHours(totalHours)}h · ¥{fmt(mfgCost)} (@ ¥{fmt(laborRate)}/h)</p>
      </div>
    </div>
  );
}

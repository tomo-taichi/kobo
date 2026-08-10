"use client";

import { ProductForm } from "@/components/product-form";
import { ProductCostForm } from "@/components/product-cost-form";
import { ProductPhotosManager } from "@/components/product-photos-manager";
import { ProductCareForm } from "@/components/product-care-form";
import { CollapsibleCard } from "@/components/collapsible-card";
import { updateProduct } from "@/app/actions/products";
import type { ProductEditBundle } from "@/lib/product-edit-data";

// The full product edit experience (Basic Info + Materials & Cost + Cost Summary +
// Photos + Care & Logistics). Shared by the /edit page and the products-list popup.
// Basic Info is always editable; only the Cost section locks when finalised (b.locked).
export function ProductEditView({ bundle: b }: { bundle: ProductEditBundle }) {
  return (
    <div className="space-y-4">
      <ProductForm
        action={updateProduct}
        locked={false}
        seasons={b.seasons}
        materials={b.materials}
        pastModelNames={b.pastModelNames}
        categoryOptions={b.categoryOptions}
        sexOptions={b.sexOptions}
        tagOptions={b.tagOptions}
        accessoryCompositionOptions={b.accessoryCompositionOptions}
        initialData={b.initialData}
        id={b.id}
      />
      <ProductCostForm
        locked={b.locked}
        productId={b.id}
        productCategory={b.productCategory}
        mainMaterial={b.mainMaterial}
        liningMaterial={b.liningMaterial}
        initialMainQuantity={b.initialMainQuantity}
        initialLiningQuantity={b.initialLiningQuantity}
        allMaterials={b.materials}
        initialAdditionalRows={b.initialAdditionalRows}
        initialManufacturing={b.initialManufacturing}
        laborRate={b.laborRate}
        initialCostEurRate={b.initialCostEurRate}
        colors={b.colors}
        presets={b.presets}
        retailMultiplier={b.retailMultiplier}
      />

      <CollapsibleCard title="Photos" defaultOpen={false} subtitle={`${(b.images ?? []).length} image(s)`}>
        <ProductPhotosManager productId={b.id} colors={b.photoColors} images={b.images} />
      </CollapsibleCard>

      <CollapsibleCard title="Care & Logistics" defaultOpen={false}>
        <ProductCareForm
          productId={b.id}
          initialCleaningInstruction={b.careCleaningInstruction}
          initialWeightG={b.careWeightG}
          initialHsCode={b.careHsCode}
          productCategory={b.productCategory}
          productSex={b.productSex}
          mainComp1Label={b.mainComp1Label}
        />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2">Tag Print</h3>
          <div className="flex gap-2">
            <a href={`/api/products/${b.id}/product-tag`} target="_blank" rel="noreferrer"
              className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700">Product Tag PDF</a>
            <a href={`/api/products/${b.id}/composition-tag`} target="_blank" rel="noreferrer"
              className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">Composition Tag PDF</a>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

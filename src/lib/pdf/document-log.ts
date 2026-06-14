// Document version log helpers (server-side). Used by the PDF "Generate & Save"
// actions to record every generated file as a versioned row.
//
// Version label format: YYMMDD_vNN  (YYMMDD = creation date in JST, NN = per
// logical-document sequence). Phase 3 treats one (order, doc_type) as a single
// logical document; Phase 5 generalises Final/Commercial/Delivery to batches.

export type DocType = "oc" | "deposit" | "final" | "commercial" | "delivery";

/** YYMMDD in Asia/Tokyo (the brand's local date). */
export function todayYYMMDD(): string {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
  return ymd.slice(2).replace(/-/g, "");
}

export function formatVersionLabel(versionNo: number, yymmdd = todayYYMMDD()): string {
  return `${yymmdd}_v${String(versionNo).padStart(2, "0")}`;
}

type Began = { documentId: string; versionNo: number; versionLabel: string };

/**
 * Find (or create) the logical document for (order, doc_type) and reserve the
 * next version label. `documentId` lets the caller link a ledger entry (Phase 4/5).
 * For batch docs a specific `documentId` can be passed to revise an existing one.
 */
export async function beginVersion(
  supabase: any,
  orderId: string,
  docType: DocType,
  existingDocumentId?: string | null,
): Promise<Began> {
  let documentId = existingDocumentId ?? null;

  if (!documentId) {
    const { data: docs } = await supabase
      .from("order_documents")
      .select("id")
      .eq("order_id", orderId)
      .eq("doc_type", docType)
      .order("seq_no", { ascending: true })
      .limit(1);
    documentId = docs?.[0]?.id ?? null;
  }

  if (!documentId) {
    const { data: created, error } = await supabase
      .from("order_documents")
      .insert({ order_id: orderId, doc_type: docType, seq_no: 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    documentId = created.id;
  }

  const { data: vers } = await supabase
    .from("order_document_versions")
    .select("version_no")
    .eq("document_id", documentId)
    .order("version_no", { ascending: false })
    .limit(1);
  const versionNo = (vers?.[0]?.version_no ?? 0) + 1;

  return { documentId: documentId as string, versionNo, versionLabel: formatVersionLabel(versionNo) };
}

/** Persist the version row after the PDF has been uploaded. */
export async function finalizeVersion(
  supabase: any,
  v: { documentId: string; versionNo: number; versionLabel: string; fileUrl: string },
): Promise<void> {
  const { error } = await supabase.from("order_document_versions").insert({
    document_id: v.documentId,
    version_no: v.versionNo,
    version_label: v.versionLabel,
    file_url: v.fileUrl,
  });
  if (error) throw new Error(error.message);
}

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

type Began = { documentId: string; seqNo: number; versionNo: number; versionLabel: string };

type BeginOpts = {
  documentId?: string | null; // revise this logical doc
  forceNew?: boolean;         // create a new logical doc (new batch)
  itemIds?: string[] | null;  // selected order_item ids (batch docs)
};

/**
 * Find/create the logical document for (order, doc_type) and reserve the next
 * version label.
 * - OC / Deposit (no opts): one logical doc per (order, doc_type) — find or create.
 * - Batch New (forceNew): always create a new logical doc with seq_no = max+1.
 * - Batch Revise (documentId): reuse that doc, refreshing item_ids.
 */
export async function beginVersion(
  supabase: any,
  orderId: string,
  docType: DocType,
  opts: BeginOpts = {},
): Promise<Began> {
  let documentId = opts.documentId ?? null;
  let seqNo = 1;

  // OC/Deposit: reuse the single existing logical doc when not forcing a new batch
  if (!documentId && !opts.forceNew) {
    const { data: docs } = await supabase
      .from("order_documents")
      .select("id, seq_no")
      .eq("order_id", orderId)
      .eq("doc_type", docType)
      .order("seq_no", { ascending: true })
      .limit(1);
    if (docs?.[0]) { documentId = docs[0].id; seqNo = docs[0].seq_no; }
  }

  if (!documentId) {
    // create new logical doc (new batch or first-ever doc of this type)
    const { data: maxRow } = await supabase
      .from("order_documents")
      .select("seq_no")
      .eq("order_id", orderId)
      .eq("doc_type", docType)
      .order("seq_no", { ascending: false })
      .limit(1);
    seqNo = (maxRow?.[0]?.seq_no ?? 0) + 1;
    const { data: created, error } = await supabase
      .from("order_documents")
      .insert({ order_id: orderId, doc_type: docType, seq_no: seqNo, item_ids: opts.itemIds ?? null })
      .select("id, seq_no")
      .single();
    if (error) throw new Error(error.message);
    documentId = created.id;
    seqNo = created.seq_no;
  } else {
    const { data: existing } = await supabase
      .from("order_documents")
      .select("seq_no")
      .eq("id", documentId)
      .single();
    seqNo = existing?.seq_no ?? seqNo;
    if (opts.itemIds) {
      await supabase.from("order_documents").update({ item_ids: opts.itemIds }).eq("id", documentId);
    }
  }

  const { data: vers } = await supabase
    .from("order_document_versions")
    .select("version_no")
    .eq("document_id", documentId)
    .order("version_no", { ascending: false })
    .limit(1);
  const versionNo = (vers?.[0]?.version_no ?? 0) + 1;

  return { documentId: documentId as string, seqNo, versionNo, versionLabel: formatVersionLabel(versionNo) };
}

/**
 * Record (or sync) the AR debit for an invoice document in the Payment Log.
 * Linked to the logical document via order_documents.payment_id so re-generating
 * a revision updates the same debit instead of duplicating it. Returns the
 * payment id, or null if there is nothing to bill (amount <= 0).
 */
export async function upsertDocumentDebit(
  supabase: any,
  args: {
    documentId: string;
    orderId: string;
    customerId: string;
    category: "deposit" | "balance";
    amount: number;
    currency: string;
    note: string;
  },
): Promise<string | null> {
  const { documentId, orderId, customerId, category, amount, currency, note } = args;
  if (!customerId || !(amount > 0)) return null;

  const entryDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

  const { data: doc } = await supabase
    .from("order_documents")
    .select("payment_id")
    .eq("id", documentId)
    .single();
  const existingId: string | null = doc?.payment_id ?? null;

  if (existingId) {
    await supabase
      .from("customer_payments")
      .update({ amount, currency, category, entry_date: entryDate, note })
      .eq("id", existingId);
    return existingId;
  }

  const { data: created, error } = await supabase
    .from("customer_payments")
    .insert({ customer_id: customerId, order_id: orderId, entry_date: entryDate, type: "debit", category, amount, currency, note })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("order_documents").update({ payment_id: created.id }).eq("id", documentId);
  return created.id as string;
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

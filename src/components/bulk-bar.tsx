"use client";

// Shared floating bulk-action bar (dark, bottom-centre) — the default list-page
// pattern: Archive / Unarchive / Delete on the current selection, plus optional
// extra actions passed as children (e.g. product tag menu).
export function BulkBar({
  count,
  pending,
  onArchive,
  onUnarchive,
  onDelete,
  onClear,
  children,
  deleteLabel = "Delete",
  archiveLabel = "Archive",
  unarchiveLabel = "Unarchive",
}: {
  count: number;
  pending?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  onClear: () => void;
  children?: React.ReactNode;
  deleteLabel?: string;
  archiveLabel?: string;
  unarchiveLabel?: string;
}) {
  if (count <= 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-900 text-white rounded-xl shadow-lg px-2 py-1.5 text-sm">
      <span className="px-3 py-1 text-gray-300">{count} selected</span>
      {(onArchive || onUnarchive) && <span className="w-px h-5 bg-white/15" />}
      {onArchive && (
        <button type="button" disabled={pending} onClick={onArchive} className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">{archiveLabel}</button>
      )}
      {onUnarchive && (
        <button type="button" disabled={pending} onClick={onUnarchive} className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">{unarchiveLabel}</button>
      )}
      {children && <><span className="w-px h-5 bg-white/15" />{children}</>}
      <span className="w-px h-5 bg-white/15" />
      <button type="button" disabled={pending} onClick={onDelete} className="px-3 py-1 rounded-lg text-red-300 hover:bg-white/10 disabled:opacity-50">{deleteLabel}</button>
      <span className="w-px h-5 bg-white/15" />
      <button type="button" onClick={onClear} className="px-2 py-1 rounded-lg text-gray-400 hover:bg-white/10" aria-label="Clear selection">✕</button>
    </div>
  );
}

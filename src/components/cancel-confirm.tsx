"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared "don't lose my input" behavior for data-entry modals.
 *
 * - Outside-click no longer closes the modal: the caller simply stops wiring a
 *   backdrop onClick handler.
 * - Closing is only allowed via Cancel / ✕, both of which call `requestClose`.
 * - `requestClose` shows an in-app confirmation ONLY when the form is dirty;
 *   an untouched form closes immediately.
 *
 * Dirty is detected by spreading `onContentChange` on the modal body's `onChange`
 * (React change events bubble, so every native field edit is caught). For state
 * changes driven by buttons rather than native inputs, call `markDirty()` directly.
 *
 * Success-close paths (server-action redirect / explicit setOpen(false) after a
 * save) must NOT go through `requestClose` — call `onClose` directly so the
 * confirmation never appears on a successful submit.
 */
export function useCancelConfirm(isOpen: boolean, onClose: () => void) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Reset whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setDirty(false);
      setConfirming(false);
    }
  }, [isOpen]);

  const markDirty = useCallback(() => setDirty(true), []);
  const onContentChange = useCallback(() => setDirty(true), []);

  const requestClose = useCallback(() => {
    if (dirty) setConfirming(true);
    else onClose();
  }, [dirty, onClose]);

  // Yes → discard & close. No → back to the modal.
  const discard = useCallback(() => {
    setConfirming(false);
    onClose();
  }, [onClose]);
  const keep = useCallback(() => setConfirming(false), []);

  return { dirty, confirming, markDirty, onContentChange, requestClose, discard, keep };
}

/**
 * The "Are you sure you want to cancel?" dialog. Rendered on top of its host
 * modal (z-60 > the z-50 modal). Clicking its backdrop keeps editing (No) — that
 * is the safe direction and never discards input.
 */
export function CancelConfirmDialog({
  open,
  onKeep,
  onDiscard,
}: {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onKeep(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-72 p-5" role="alertdialog" aria-modal="true">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Cancel editing?</h3>
        <p className="text-xs text-gray-500 mb-4">Are you sure you want to cancel? Unsaved changes will be lost.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
          >
            No
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="text-sm px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

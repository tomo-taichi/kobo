"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadCustomerContract, deleteCustomerContract } from "@/app/actions/customer-contracts";

export type ContractFile = {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  url: string | null;
};

export function CustomerContractsSection({
  customerId,
  contracts,
}: {
  customerId: string;
  contracts: ContractFile[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startUpload(async () => {
      const err = await uploadCustomerContract(customerId, fd);
      if (err) {
        setUploadError(err);
      } else {
        setUploadError(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  }

  function handleDelete(contractId: string, storagePath: string) {
    if (!confirm("この契約書を削除しますか？")) return;
    startDelete(async () => {
      await deleteCustomerContract(contractId, storagePath, customerId);
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
        Contracts
      </h3>

      {contracts.length > 0 && (
        <ul className="space-y-2 mb-4">
          {contracts.map((c) => (
            <li key={c.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-gray-400 text-sm shrink-0">📄</span>
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate"
                  >
                    {c.filename}
                  </a>
                ) : (
                  <span className="text-sm text-gray-700 truncate">{c.filename}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(c.uploaded_at).toLocaleDateString("ja-JP")}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(c.id, c.storage_path)}
                disabled={deleting}
                className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {contracts.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">契約書が登録されていません</p>
      )}

      <form onSubmit={handleUpload} className="flex gap-2 items-center flex-wrap">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:border file:border-gray-300 file:rounded file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={uploading}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 shrink-0"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
      {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
    </div>
  );
}

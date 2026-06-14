"use client";

import { NewModal } from "@/components/new-modal";
import { SeasonForm } from "@/components/season-form";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

export function SeasonNewToggle({ action }: { action: Action }) {
  return (
    <NewModal title="新規シーズン作成">
      {(onClose) => <SeasonForm action={action} onCancel={onClose} />}
    </NewModal>
  );
}

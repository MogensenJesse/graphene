// src/hooks/useDeleteConfirm.ts
import { useEffect, useState } from "react";

export function useDeleteConfirm(itemId: string): {
  confirming: boolean;
  startConfirm: () => void;
  cancelConfirm: () => void;
} {
  const [confirming, setConfirming] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemId is an intentional trigger — reset confirming whenever the viewed item changes
  useEffect(() => {
    setConfirming(false);
  }, [itemId]);

  useEffect(() => {
    if (!confirming) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [confirming]);

  return {
    confirming,
    startConfirm: () => setConfirming(true),
    cancelConfirm: () => setConfirming(false),
  };
}

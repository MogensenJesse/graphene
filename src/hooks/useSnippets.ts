// src/hooks/useSnippets.ts
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSnippets, saveSnippets } from "../lib/storage";
import type { Snippet } from "../types";

const DEBOUNCE_MS = 300;

export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from disk on mount
  useEffect(() => {
    loadSnippets()
      .then((loaded) => {
        setSnippets(loaded);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Flush any pending debounced save on unmount
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const scheduleSave = useCallback((updated: Snippet[]) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveSnippets(updated).catch(console.error);
    }, DEBOUNCE_MS);
  }, []);

  const addSnippet = useCallback(
    (fields: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "copies">) => {
      const now = new Date().toISOString();
      const snippet: Snippet = {
        ...fields,
        id: nanoid(),
        createdAt: now,
        updatedAt: now,
        copies: 0,
      };
      setSnippets((prev) => {
        const updated = [snippet, ...prev];
        scheduleSave(updated);
        return updated;
      });
      return snippet.id;
    },
    [scheduleSave],
  );

  const updateSnippet = useCallback(
    (id: string, fields: Partial<Omit<Snippet, "id" | "createdAt">>) => {
      setSnippets((prev) => {
        const updated = prev.map((s) =>
          s.id === id
            ? { ...s, ...fields, updatedAt: new Date().toISOString() }
            : s,
        );
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const deleteSnippet = useCallback(
    (id: string) => {
      setSnippets((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const incrementCopyCount = useCallback(
    (id: string) => {
      setSnippets((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, copies: s.copies + 1 } : s,
        );
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  return {
    snippets,
    loading,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    incrementCopyCount,
  };
}

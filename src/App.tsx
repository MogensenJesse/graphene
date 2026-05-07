// src/App.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import EmptyState from "./components/EmptyState";
import Sidebar from "./components/Sidebar";
import SnippetDetail from "./components/SnippetDetail";
import SnippetForm from "./components/SnippetForm";
import { useSnippets } from "./hooks/useSnippets";
import type { Snippet } from "./types";

type Mode = "detail" | "new" | "edit";

const appWindow = getCurrentWindow();

function App() {
  const {
    snippets,
    loading,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    incrementCopyCount,
  } = useSnippets();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("detail");

  // Auto-select the first snippet when snippets load
  useEffect(() => {
    if (!loading && snippets.length > 0 && !selectedId) {
      setSelectedId(snippets[0].id);
    }
  }, [loading, snippets, selectedId]);

  // When the selected snippet is deleted, move selection to the first remaining one
  useEffect(() => {
    if (selectedId && !snippets.some((s) => s.id === selectedId)) {
      setSelectedId(snippets.length > 0 ? snippets[0].id : null);
      setMode("detail");
    }
  }, [snippets, selectedId]);

  const selectedSnippet: Snippet | undefined = snippets.find(
    (s) => s.id === selectedId,
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMode("detail");
  };

  const handleNew = () => {
    setMode("new");
    setSelectedId(null);
  };

  const handleSaveNew = (
    fields: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "copies">,
  ) => {
    const newId = addSnippet(fields);
    setSelectedId(newId);
    setMode("detail");
  };

  const handleEdit = () => {
    setMode("edit");
  };

  const handleSaveEdit = (
    fields: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "copies">,
  ) => {
    if (!selectedId) return;
    updateSnippet(selectedId, fields);
    setMode("detail");
  };

  const handleCancel = () => {
    setMode("detail");
  };

  const handleDelete = (id: string) => {
    deleteSnippet(id);
    // Selection is updated reactively by the useEffect above
  };

  const handleCopied = (id: string) => {
    incrementCopyCount(id);
  };

  const renderMain = () => {
    if (mode === "new") {
      return <SnippetForm onSave={handleSaveNew} onCancel={handleCancel} />;
    }

    if (mode === "edit" && selectedSnippet) {
      return (
        <SnippetForm
          initial={selectedSnippet}
          onSave={handleSaveEdit}
          onCancel={handleCancel}
        />
      );
    }

    if (selectedSnippet) {
      return (
        <SnippetDetail
          snippet={selectedSnippet}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopied={handleCopied}
        />
      );
    }

    return <EmptyState onNew={handleNew} />;
  };

  return (
    <div className="app" data-tauri-drag-region>
      <div className="app__body">
        <div className="app__sidebar">
          <Sidebar
            snippets={snippets}
            selectedId={selectedId}
            searchQuery={searchQuery}
            activeTag={activeTag}
            onSelect={handleSelect}
            onNew={handleNew}
            onSearchChange={setSearchQuery}
            onTagChange={setActiveTag}
          />
        </div>
        <main className="app__main">
          <div className="app__drag-strip" data-tauri-drag-region />
          <div className="app__win-controls">
            <button
              type="button"
              className="app__win-btn"
              onClick={() => appWindow.minimize()}
              aria-label="Minimize"
              title="Minimize"
            >
              <svg
                width="10"
                height="1"
                viewBox="0 0 10 1"
                fill="none"
                aria-hidden="true"
              >
                <rect width="10" height="1" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="app__win-btn app__win-btn--close"
              onClick={() => appWindow.close()}
              aria-label="Close"
              title="Close"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 1L9 9M9 1L1 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {renderMain()}
        </main>
      </div>
    </div>
  );
}

export default App;

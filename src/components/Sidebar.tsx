// src/components/Sidebar.tsx
import { useMemo } from "react";
import { filterSnippets } from "../lib/search";
import type { Snippet } from "../types";
import TagPill from "./TagPill";

interface SidebarProps {
  snippets: Snippet[];
  selectedId: string | null;
  searchQuery: string;
  activeTag: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSearchChange: (q: string) => void;
  onTagChange: (tag: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return "1w ago";
  if (diffDays < 28) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 60) return "1mo ago";
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function Sidebar({
  snippets,
  selectedId,
  searchQuery,
  activeTag,
  onSelect,
  onNew,
  onSearchChange,
  onTagChange,
}: SidebarProps) {
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const s of snippets) {
      for (const t of s.tags) tagSet.add(t);
    }
    return ["all", ...Array.from(tagSet).sort()];
  }, [snippets]);

  const filtered = useMemo(
    () => filterSnippets(snippets, searchQuery, activeTag),
    [snippets, searchQuery, activeTag],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__header" data-tauri-drag-region>
        <div className="sidebar__brand" data-tauri-drag-region>
          <span aria-hidden="true">⬡</span>
          <span>flowvault</span>
        </div>
        <button
          type="button"
          className="sidebar__new-btn"
          onClick={onNew}
          aria-label="New snippet"
          title="New snippet"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <div className="sidebar__search">
        <div className="sidebar__search-box">
          <span className="sidebar__search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="sidebar__search-input"
            type="text"
            placeholder="search…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search snippets"
          />
        </div>
      </div>

      <div className="sidebar__tags">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`sidebar__tag-btn${activeTag === tag ? " sidebar__tag-btn--active" : ""}`}
            onClick={() => onTagChange(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <ul className="sidebar__list">
        {filtered.length === 0 ? (
          <li className="sidebar__empty">no results</li>
        ) : (
          filtered.map((snippet) => (
            <li
              key={snippet.id}
              className={`snippet-item${selectedId === snippet.id ? " snippet-item--selected" : ""}`}
              onClick={() => onSelect(snippet.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(snippet.id);
              }}
              aria-selected={selectedId === snippet.id}
            >
              <div className="snippet-item__top">
                <span className="snippet-item__title">{snippet.title}</span>
                <span className="snippet-item__date">
                  {formatDate(snippet.updatedAt)}
                </span>
              </div>
              <div className="snippet-item__tags">
                {snippet.tags.slice(0, 2).map((tag) => (
                  <TagPill key={tag} tag={tag} small />
                ))}
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="sidebar__footer">
        <span>
          {filtered.length} snippet{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
    </aside>
  );
}

export default Sidebar;

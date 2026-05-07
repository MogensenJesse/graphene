// src/components/SnippetForm.tsx
import { useState } from "react";
import type { Snippet } from "../types";
import { LANGUAGES } from "../types";

type Lang = (typeof LANGUAGES)[number];

interface SnippetFormProps {
  initial?: Snippet;
  onSave: (
    fields: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "copies">,
  ) => void;
  onCancel: () => void;
}

function SnippetForm({ initial, onSave, onCancel }: SnippetFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lang, setLang] = useState<Lang>(initial?.lang ?? "JS");
  const [projects, setProjects] = useState(initial?.projects.join(", ") ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const handleSave = () => {
    if (!title.trim()) return;

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const parsedProjects = projects
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    onSave({
      title: title.trim(),
      lang,
      tags: parsedTags,
      projects: parsedProjects,
      code,
      note,
    });
  };

  const isEditing = !!initial;

  return (
    <div className="snippet-form">
      <div className="snippet-form__header" data-tauri-drag-region>
        <h2 className="snippet-form__title">
          {isEditing ? "edit snippet" : "new snippet"}
        </h2>
      </div>

      <div className="snippet-form__body">
        <div className="snippet-form__field">
          <label className="snippet-form__label" htmlFor="sf-title">
            title
          </label>
          <input
            id="sf-title"
            className="snippet-form__input"
            type="text"
            placeholder="e.g. Scroll lock — Lenis v5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="snippet-form__field snippet-form__field--grid">
          <div>
            <label className="snippet-form__label" htmlFor="sf-lang">
              language
            </label>
            <select
              id="sf-lang"
              className="snippet-form__select"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="snippet-form__label" htmlFor="sf-projects">
              project(s)
            </label>
            <input
              id="sf-projects"
              className="snippet-form__input"
              type="text"
              placeholder="Gouwy, AVIA…"
              value={projects}
              onChange={(e) => setProjects(e.target.value)}
            />
          </div>
        </div>

        <div className="snippet-form__field">
          <label className="snippet-form__label" htmlFor="sf-tags">
            tags
          </label>
          <input
            id="sf-tags"
            className="snippet-form__input"
            type="text"
            placeholder="scroll, webflow, gdpr… (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="snippet-form__field">
          <label className="snippet-form__label" htmlFor="sf-code">
            code
          </label>
          <textarea
            id="sf-code"
            className="snippet-form__textarea snippet-form__textarea--code"
            placeholder="paste your snippet here…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="snippet-form__field">
          <label className="snippet-form__label" htmlFor="sf-notes">
            notes
          </label>
          <textarea
            id="sf-notes"
            className="snippet-form__textarea snippet-form__textarea--notes"
            placeholder="version caveats, usage context, gotchas…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="snippet-form__footer">
        <button
          type="button"
          className="snippet-form__btn snippet-form__btn--cancel"
          onClick={onCancel}
        >
          cancel
        </button>
        <button
          type="button"
          className="snippet-form__btn snippet-form__btn--save"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          save snippet
        </button>
      </div>
    </div>
  );
}

export default SnippetForm;

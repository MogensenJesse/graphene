// src/components/settings/AppearancePanel.tsx
import { type ReactNode, useMemo, useState } from "react";
import { fontInstalled } from "../../lib/fontCheck";
import {
  FONT_CHOICES,
  type FontKind,
  type FontPref,
  readFontPref,
  readTextSize,
  setFontPref,
  setTextSize,
  TEXT_SIZES,
} from "../../lib/fontPrefs";
import {
  readThemePref,
  setThemePref,
  THEME_PREFS,
  type ThemePref,
} from "../../lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "../ui/Icon";
import Segmented from "../ui/Segmented";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System", icon: <MonitorIcon size={13} /> },
  { value: "light", label: "Light", icon: <SunIcon size={13} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={13} /> },
];

interface FontFieldProps {
  kind: FontKind;
  title: string;
  hint: string;
  /** Shown in the font itself, so a change is seen at once */
  sample: ReactNode;
  sampleClassName: string;
}

// One font: a few ready choices, or the name of an installed font
function FontField({
  kind,
  title,
  hint,
  sample,
  sampleClassName,
}: FontFieldProps) {
  const [pref, setPref] = useState<FontPref>(() => readFontPref(kind));
  const typed = pref.choice === "custom" ? pref.custom.trim() : "";
  const missing = useMemo(() => typed !== "" && !fontInstalled(typed), [typed]);

  const update = (next: FontPref) => {
    setPref(next);
    setFontPref(kind, next);
  };

  return (
    <section className="settings__field">
      <h3 className="settings__label">{title}</h3>
      <Segmented
        label={title}
        className="settings__segments"
        value={pref.choice}
        options={FONT_CHOICES[kind]}
        onChange={(choice) => update({ ...pref, choice })}
      />
      {pref.choice === "custom" && (
        <>
          <input
            type="text"
            className="settings__input"
            aria-label={`${title}, name of an installed font`}
            placeholder="Name of an installed font"
            value={pref.custom}
            spellCheck={false}
            onChange={(e) =>
              update({ choice: "custom", custom: e.target.value })
            }
          />
          {missing && (
            <p className="settings__error">Not found on this computer.</p>
          )}
        </>
      )}
      <div className={`settings__sample ${sampleClassName}`}>{sample}</div>
      <p className="settings__muted">{hint}</p>
    </section>
  );
}

// Theme, fonts and text size: everything that changes how Graphene looks
function AppearancePanel() {
  const [theme, setTheme] = useState<ThemePref>(readThemePref);
  const [size, setSize] = useState(readTextSize);

  const chooseTheme = (next: ThemePref) => {
    if (!THEME_PREFS.includes(next)) return;
    setTheme(next);
    setThemePref(next);
  };

  const chooseSize = (next: string) => {
    setSize(next);
    setTextSize(next);
  };

  return (
    <>
      <section className="settings__field">
        <h3 className="settings__label">Theme</h3>
        <Segmented
          label="Theme"
          className="settings__segments"
          value={theme}
          options={THEME_OPTIONS}
          onChange={chooseTheme}
        />
        <p className="settings__muted">
          System follows Windows and changes with it.
        </p>
      </section>

      <FontField
        kind="note"
        title="Note font"
        sample="The quick brown fox jumps over the lazy dog. 0123456789"
        sampleClassName="settings__sample--note"
        hint="Used for reading and editing. In the editor the raw Markdown lines only line up in a monospaced font."
      />

      <FontField
        kind="code"
        title="Code font"
        sample="const total = items.reduce((sum, n) => sum + n, 0);"
        sampleClassName="settings__sample--code"
        hint="Used for code blocks and inline code. Also the editor's font while the note font is Default."
      />

      <section className="settings__field">
        <h3 className="settings__label">Text size</h3>
        <Segmented
          label="Text size"
          className="settings__segments"
          value={size}
          options={TEXT_SIZES}
          onChange={chooseSize}
        />
        <p className="settings__muted">
          Changes note text and code. The sidebar, menus and dialogs stay the
          same.
        </p>
      </section>
    </>
  );
}

export default AppearancePanel;

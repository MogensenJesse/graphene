// src/components/settings/AppearancePanel.tsx
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useCodeWrap } from "../../hooks/useCodeWrap";
import { type CodeWrap, setCodeWrap } from "../../lib/codeWrap";
import { fontInstalled } from "../../lib/fontCheck";
import { listFonts } from "../../lib/fontList";
import {
  FONT_CHOICES,
  type FontKind,
  type FontPref,
  fontCss,
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
import Select, { type SelectOption } from "../ui/Select";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System", icon: <MonitorIcon size={13} /> },
  { value: "light", label: "Light", icon: <SunIcon size={13} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={13} /> },
];

const WRAP_OPTIONS: { value: CodeWrap; label: string }[] = [
  { value: "on", label: "Wrap" },
  { value: "off", label: "Scroll" },
];

interface FontFieldProps {
  kind: FontKind;
  title: string;
  hint: string;
  /** Shown in the font itself, so a change is seen at once */
  sample: ReactNode;
  sampleClassName: string;
}

// The fonts installed on this computer, read whenever the Custom choice comes on screen (so a font installed since is
// there). null while it loads, "error" if it could not be read
function useInstalledFonts(wanted: boolean): string[] | "error" | null {
  const [fonts, setFonts] = useState<string[] | "error" | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    listFonts()
      .then((list) => current && setFonts(list))
      .catch((err) => {
        console.error(err);
        if (current) setFonts("error");
      });
    return () => {
      current = false;
    };
  }, [wanted]);
  return fonts;
}

// One font: a few ready choices, or one of the installed fonts from a list (or a name typed into it)
function FontField({
  kind,
  title,
  hint,
  sample,
  sampleClassName,
}: FontFieldProps) {
  const [pref, setPref] = useState<FontPref>(() => readFontPref(kind));
  const custom = pref.choice === "custom";
  const typed = custom ? pref.custom.trim() : "";
  const missing = useMemo(() => typed !== "" && !fontInstalled(typed), [typed]);
  const fonts = useInstalledFonts(custom);

  // Each font in its own typeface, so the list shows what it picks. A saved name that is not on the list (a font that
  // was removed, or the list has not loaded yet) stays on it, first, so the button can show it
  const options = useMemo(() => {
    const installed = Array.isArray(fonts) ? fonts : [];
    const style = (name: string) => ({
      fontFamily:
        fontCss(kind, { choice: "custom", custom: name }) ?? undefined,
    });
    const list: SelectOption[] = installed.map((name) => ({
      value: name,
      label: name,
      style: style(name),
    }));
    if (pref.custom && !installed.includes(pref.custom))
      list.unshift({
        value: pref.custom,
        label: pref.custom,
        style: style(pref.custom),
      });
    return list;
  }, [fonts, kind, pref.custom]);

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
      {custom && (
        <>
          <Select
            label={`${title}, an installed font`}
            className="settings__select"
            value={pref.custom}
            options={options}
            placeholder="Choose a font…"
            emptyText={
              fonts === null
                ? "Loading the fonts…"
                : fonts === "error"
                  ? "The fonts could not be listed. Type a name instead."
                  : "No font has that name"
            }
            searchable
            allowTyped
            onChange={(name) => update({ choice: "custom", custom: name })}
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
  const wrap = useCodeWrap();

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
          System follows the device&apos;s light or dark setting and changes
          with it.
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
        <h3 className="settings__label">Code wrap</h3>
        <Segmented
          label="Code wrap"
          className="settings__segments"
          value={wrap}
          options={WRAP_OPTIONS}
          onChange={setCodeWrap}
        />
        <p className="settings__muted">
          Long lines in code blocks, and in a note that is only code in the
          editor, either continue on the next row or scroll sideways. Alt+Z
          switches it anywhere.
        </p>
      </section>

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

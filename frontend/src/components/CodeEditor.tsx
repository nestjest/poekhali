import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Colors come from CSS tokens so the editor follows light/dark themes.
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-content': { caretColor: 'var(--text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--muted)', borderRight: '1px solid color-mix(in srgb, var(--line) 35%, transparent)' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--code-selection) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--code-selection)', outline: 'none' },
});
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.operatorKeyword], color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--code-number)' },
  { tag: t.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-fn)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--muted)' },
]);

const setMarks = StateEffect.define<{ run: number | null; error: number | null }>();

const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue;
      const out = [];
      const { run, error } = e.value;
      const lines = tr.state.doc.lines;
      if (error && error <= lines) out.push(Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(error).from));
      if (run && run <= lines && run !== error) out.push(Decoration.line({ class: 'cm-run-line' }).range(tr.state.doc.line(run).from));
      deco = Decoration.set(out.sort((a, b) => a.from - b.from));
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  runLine?: number | null;
  errorLine?: number | null;
  onRun?: () => void;
  onCheck?: () => void;
  label: string;
  className?: string;
}

export function CodeEditor({ value, onChange, readOnly, runLine = null, errorLine = null, onRun, onCheck, label, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onRun, onCheck });
  handlers.current = { onChange, onRun, onCheck };

  useEffect(() => {
    const extensions: Extension[] = [
      keymap.of([
        { key: 'Mod-Shift-Enter', run: () => (handlers.current.onCheck?.(), true) },
        { key: 'Mod-Enter', run: () => (handlers.current.onRun?.(), true) },
      ]),
      basicSetup,
      python(),
      theme,
      syntaxHighlighting(highlight),
      marks,
      EditorState.readOnly.of(!!readOnly),
      EditorView.contentAttributes.of({ 'aria-label': label }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
      }),
    ];
    view.current = new EditorView({ parent: host.current!, state: EditorState.create({ doc: value, extensions }) });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, label]);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ effects: setMarks.of({ run: runLine, error: errorLine }) });
    if (runLine && runLine <= v.state.doc.lines) {
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(runLine).from, { y: 'nearest' }) });
    }
  }, [runLine, errorLine, value]);

  return <div className={className ? `editor-box ${className}` : 'editor-box'} ref={host} />;
}

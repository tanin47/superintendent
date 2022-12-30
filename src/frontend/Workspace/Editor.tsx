import CodeMirror from 'codemirror';
import React from "react";
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/sql-hint';
import 'codemirror/addon/hint/anyword-hint';
import 'codemirror/addon/comment/comment';
import 'codemirror/keymap/vim.js';
import './Editor.scss';
import {EditorMode} from '../../types';
import {Sheet} from './types';
import {format} from "sql-formatter";

export interface Ref {
  getValue(): string;
  setValue(newValue: string): void;
  format(): void;
  focus(): void;
}

type Props = {
  initialValue?: string | null,
  mode: EditorMode,
  sheets: Array<Sheet>,
  selectedSheetIndex: number | null,
  visible: boolean
};

function getAutocompleteWord(s: string): string {
  if (s.indexOf('.') >= 0 || s.indexOf('-') >= 0 || s.indexOf(' ') >= 0 || s.match(/^[0-9]/) !== null) {
    return `"${s}"`;
  } else {
    return s;
  }
}

export default React.forwardRef<Ref, Props>(function Editor({
  initialValue,
  mode,
  sheets,
  selectedSheetIndex,
  visible
}: Props, ref): JSX.Element {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const codeMirrorInstance = React.useRef<any>(null);

  React.useEffect(
    () => {
      if (codeMirrorInstance.current) {
        const elem = codeMirrorInstance.current!.getWrapperElement();
        elem.style.display = visible ? 'block' : 'none'
      }
    },
    [visible]
  );

  React.useEffect(
    () => {
      if (selectedSheetIndex === null) { return; }

      const cursor = codeMirrorInstance.current!.getCursor();
      const selections = codeMirrorInstance.current!.listSelections();

      codeMirrorInstance.current!.setValue(sheets[selectedSheetIndex].sql);

      codeMirrorInstance.current!.setCursor(cursor);
      codeMirrorInstance.current!.setSelections(selections);
    },
    [sheets, selectedSheetIndex]
  )

  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      codeMirrorInstance.current!.save();
      return textareaRef.current!.value;
    },
    setValue: (newValue: string) => {
      codeMirrorInstance.current!.setValue(newValue);
    },
    format: () => {
      codeMirrorInstance.current!.setValue(
        format(
          codeMirrorInstance.current!.getValue(),
          {
            language: "sql",
            indent: '  ',
            uppercase: false,
            linesBetweenQueries: 2,
          }
        )
      );
    },
    focus: () => {
      codeMirrorInstance.current!.focus();
    }
  }));

  React.useEffect(() => {
    codeMirrorInstance.current = CodeMirror.fromTextArea(
      textareaRef.current!,
      {
        value: initialValue || '',
        mode: 'text/x-sql',
        indentWithTabs: false,
        smartIndent: true,
        lineNumbers: true,
        matchBrackets: true,
        dragDrop: false,
        keyMap: mode,
        tabSize: 2,
        autofocus: true,
        extraKeys: {
          'Ctrl-Space': 'autocomplete',
          'Cmd-Space': 'autocomplete',
          'Ctrl-/': 'toggleComment',
          'Cmd-/': 'toggleComment',
        }
      }
    );

    let firstCharRecorded = false;

    codeMirrorInstance.current.on('keyup', (cm, event) => {
      if (cm.state.completionActive) {
        firstCharRecorded = false;
        return;
      }
      if (cm.state.vim && !cm.state.vim.insertMode) {
        firstCharRecorded = false;
        return;
      }

      if (
        (event.keyCode >= 97 && event.keyCode <= 122) || // a-z
        (event.keyCode >= 65 && event.keyCode <= 90) || // A-Z
        (event.keyCode >= 48 && event.keyCode <= 57) || // 0-9
        event.keyCode === 95 // _
      ) {
        if (firstCharRecorded) {
          CodeMirror.commands.autocomplete(cm, undefined, {completeSingle: false});
        } else {
          firstCharRecorded = true;
        }
      } else {
        firstCharRecorded = false
      }
    });
  }, [])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return; }
    codeMirrorInstance.current.setOption('keyMap', mode);
  }, [mode]);

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return; }

    const tables = {};
    const allColumns = new Set<string>();

    for (const sheet of sheets) {
      for (const column of sheet.columns) {
        allColumns.add(getAutocompleteWord(column.name));
      }
    }

    for (const sheet of sheets) {
      tables[getAutocompleteWord(sheet.name)] = [];
    }

    if (sheets.length > 0) {
      tables[getAutocompleteWord(sheets[0].name)] = Array.from(allColumns);
    }

    codeMirrorInstance.current.setOption('hintOptions', {
      tables: tables,
      defaultTable: sheets[0] ? getAutocompleteWord(sheets[0].name) : null,
      closeOnUnfocus: true,
    });
  }, [sheets])

  return (
    <div style={{ height: '100%', width: '100%', top: visible ? '0px' : '-100000px', position: 'absolute' }}>
      <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
    </div>
  );
});

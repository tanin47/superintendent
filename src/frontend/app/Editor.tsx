import CodeMirror from 'codemirror';
import React from "react";
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/sql-hint';
import 'codemirror/addon/hint/anyword-hint';
import 'codemirror/keymap/vim.js';
import './Editor.scss';
import {EditorMode, Sheet} from "./types";
import {format} from "sql-formatter";

export interface Ref {
  getValue(): string;
  setValue(newValue: string): void;
  format(): void;
}

type Props = {
  initialValue?: string | null,
  mode: EditorMode,
  sheets: Array<Sheet>
};

export default React.forwardRef<Ref, Props>(function Editor({
  initialValue,
  mode,
  sheets,
}: Props, ref): JSX.Element {
  const textareaRef = React.createRef<HTMLTextAreaElement>();
  const codeMirrorInstance = React.useRef<any>(null);

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
            uppercase: true,
            linesBetweenQueries: 2,
          }
        )
      );
    }
  }));

  React.useEffect(() => {
    codeMirrorInstance.current = CodeMirror.fromTextArea(
      textareaRef.current!,
      {
        value: initialValue || '',
        mode: 'text/x-sql',
        indentWithTabs: true,
        smartIndent: true,
        lineNumbers: true,
        matchBrackets: true,
        keyMap: mode,
        tabSize: 2,
        autofocus: true,
        extraKeys: {'Ctrl-Space': 'autocomplete', 'Cmd-Space': 'autocomplete'}
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
  }, [codeMirrorInstance, mode]);

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return; }

    const tables = {};
    const allColumns = new Set<string>();

    for (const sheet of sheets) {
      for (const column of sheet.columns) {
        allColumns.add(column);
        allColumns.add(`"${column}"`);
      }
    }

    for (const sheet of sheets) {
      tables[sheet.name] = [];
    }

    if (sheets.length > 0) {
      tables[sheets[0].name] = Array.from(allColumns);
    }

    codeMirrorInstance.current.setOption('hintOptions', {
      tables: tables,
      defaultTable: sheets[0]?.name,
      closeOnUnfocus: false,
    })
  }, [codeMirrorInstance, sheets])

  return (
    <>
      <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
    </>
  );
});

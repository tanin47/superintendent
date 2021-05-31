import CodeMirror, {Hints} from 'codemirror';
import React from "react";
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/sql-hint';
import 'codemirror/keymap/vim.js';
import './Editor.scss';
import {Sheet} from "./types";

export interface Ref {
  getValue(): string;
  setValue(newValue: string): void;
}

type Props = {
  initialValue?: string | null,
  sheets: Array<Sheet>
};

export default React.forwardRef<Ref, Props>(function Editor({
  initialValue,
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
        keyMap: 'vim',
        tabSize: 2,
        autofocus: true,
        extraKeys: {'Ctrl-Space': 'autocomplete', 'Cmd-Space': 'autocomplete'}

      }
    );
  }, [])

  React.useEffect(() => {
    if (!codeMirrorInstance.current) { return; }

    const tables = {};

    for (const sheet of sheets) {
      tables[sheet.name] = sheet.columns;
    }

    codeMirrorInstance.current.setOption('hintOptions', {
      tables: tables,
      closeOnUnfocus: false
    })
  }, [codeMirrorInstance, sheets])

  return (
    <>
      <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
    </>
  );
});

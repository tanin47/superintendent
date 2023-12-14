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
import Button from "./Button";
import {altOptionChar, ctrlCmdChar} from "./constants";
import {query} from "../api";
import * as dialog from "./dialog";

export interface Ref {
  getValue(): string;
  setValue(newValue: string): void;
  addText(text: string): void;
  focus(): void;
}

type Props = {
  initialValue?: string | null,
  mode: EditorMode,
  sheets: Array<Sheet>,
  selectedSheetName: string | null,
  onSheetAdded: (sheet: Sheet) => void,
  onMakingNewQuery: () => void
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
  selectedSheetName,
  onSheetAdded,
  onMakingNewQuery,
}: Props, ref): JSX.Element {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const codeMirrorInstance = React.useRef<any>(null);
  const [isQueryLoading, setIsQueryLoading] = React.useState<boolean>(false);
  const [shownSheet, setShownSheet] = React.useState<Sheet | null>(null);
  const [shouldShowDraftNotice, setShouldShowDraftNotice] = React.useState<boolean>(false);

  React.useEffect(
    () => {
      if (selectedSheetName === null) { return; }

      const sheet = sheets.find((s) => s.name === selectedSheetName);

      if (!sheet || shownSheet?.name === sheet.name) { return; }

      codeMirrorInstance.current!.save();

      const cursor = codeMirrorInstance.current!.getCursor();
      const selections = codeMirrorInstance.current!.listSelections();

      if (shownSheet) {
        shownSheet.editorState = {
          cursor,
          selections,
          draft: textareaRef.current!.value.trim(),
        };
      }

      if (sheet?.editorState?.draft && sheet?.editorState?.draft !== sheet.sql) {
        codeMirrorInstance.current!.setValue(sheet?.editorState?.draft);
        setShouldShowDraftNotice(true);
      } else {
        codeMirrorInstance.current!.setValue(sheet.sql);
        setShouldShowDraftNotice(false);
      }

      if (sheet.editorState?.cursor && sheet.editorState?.selections) {
        codeMirrorInstance.current!.setCursor(sheet.editorState.cursor);
        codeMirrorInstance.current!.setSelections(sheet.editorState.selections);
      } else {
        codeMirrorInstance.current!.setCursor(cursor);
        codeMirrorInstance.current!.setSelections(selections);
      }

      codeMirrorInstance.current!.focus();
      setShownSheet(sheet);
    },
    [sheets, selectedSheetName]
  );

  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      codeMirrorInstance.current!.save();
      return textareaRef.current!.value;
    },
    setValue: (newValue: string) => {
      codeMirrorInstance.current!.setValue(newValue);
    },
    addText: (text: string) => {
      codeMirrorInstance.current!.replaceSelection(text);
    },
    focus: () => {
      codeMirrorInstance.current!.focus();
    }
  }));

  const formatSql = React.useCallback(
    () => {
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
    [codeMirrorInstance]
  );

  const revertSql = React.useCallback(
    () => {
      if (!shownSheet) { return; }
      codeMirrorInstance.current!.setValue(shownSheet.sql);
      shownSheet.editorState = {};
      setShouldShowDraftNotice(false);
      codeMirrorInstance.current!.focus();
    },
    [shownSheet]
  );

  const runSql = React.useCallback(
    () => {
      if (isQueryLoading) { return; }
      codeMirrorInstance.current!.save();
      const value = textareaRef.current!.value;

      setIsQueryLoading(true);
      query(
        value,
        selectedSheetName ?? null
      )
        .then((sheet) => {
          onSheetAdded(sheet);
          setShouldShowDraftNotice(false);
        })
        .catch((err) => {
          dialog.showError('Found an error!', err.message);
        })
        .finally(() => {
          setIsQueryLoading(false);
        });
    },
    [sheets, isQueryLoading, onSheetAdded, selectedSheetName]
  );

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

  React.useEffect(
    () => {
      const handler = (event) => {
        if (event.code === 'Enter' && (event.metaKey || event.ctrlKey)) {
          runSql();
          return false;
        }

        if (event.code === 'Enter' && event.altKey) {
          formatSql();
          return false;
        }

        return true;
      };
      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler) ;
      };
    },
    [runSql, formatSql]
  );

  return (
    <>
      <div className="toolbarSection top" style={{borderLeft: '1px solid #666'}}>
        <div className="inner">
          <div className="left">
            <Button
              onClick={() => {runSql();}}
              isLoading={isQueryLoading}
              icon={<i className="fas fa-play"/>}
              testId="run-sql"
            >
              {selectedSheetName !== null ? 'Update SQL' : 'Create SQL'}
              <span className="short-key">
                {ctrlCmdChar()} ⏎
              </span>
            </Button>
            <span className="separator" />
            {selectedSheetName !== null && (
              <>
                <Button
                  onClick={() => onMakingNewQuery()}
                  icon={<i className="fas fa-plus-square"/>}
                  testId="new-sql"
                >
                  New SQL
                  <span className="short-key">
                    {ctrlCmdChar()} N
                  </span>
                </Button>
                <span className="separator" />
              </>
            )}
            <Button
              onClick={() => {formatSql()}}
              icon={<i className="fas fa-align-justify" />}
            >
              Format
              <span className="short-key">
                {altOptionChar()} ⏎
              </span>
            </Button>
          </div>
          <div className="right">
            <Button
              onClick={() => {
                window.shell.openExternal("https://docs.superintendent.app")
              }}
              icon={<i className="fas fa-question-circle"/>}
            >
              Docs
            </Button>
          </div>
        </div>
      </div>
      {shouldShowDraftNotice && (
        <div className="draft-notice">
          This is a draft. Click <a href="#" onClick={() => revertSql()}>here</a> to revert to the original SQL.
        </div>
      )}
      <div
        style={{
          position: 'relative',
          flexGrow: 1000,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#fff'
          }}
        >
          <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
        </div>
      </div>
    </>
  );
});

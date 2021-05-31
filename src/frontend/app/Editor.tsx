import CodeMirror, {Hints} from 'codemirror';
import React from "react";
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/sql-hint';
import './Editor.scss';

export interface Ref {
  getValue(): string;
  setValue(newValue: string): void;
}

type Props = {
  initialValue?: string | null,
};

export default React.forwardRef<Ref, Props>(function Editor({
  initialValue,
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
        tabSize: 2,
        autofocus: true,
        hintOptions: {
          hint: (cm, option): Promise<Hints | null> => {
            return new Promise((accept) => {
              setTimeout(
                () => {
                  // TODO: Make hints work with all columns and tables
                  return accept(null);
                },
                100
              );
            })
          }
        }
      }
    );
  }, [])

  return (
    <>
      <textarea ref={textareaRef} placeholder="Compose a beautiful SQL..." />
    </>
  );
});

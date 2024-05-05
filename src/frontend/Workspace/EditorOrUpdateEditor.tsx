import React from 'react'
import { type ComposableItem } from './types'
import { type ObjectWrapper } from './WorkspaceContext'
import { type RenameDialogInfo } from './RenameDialog'
import Editor, { type EditorRef } from './Editor'
import UpdateEditor from './UpdateEditor'
import './EditorOrUpdateEditor.scss'

export interface EditorOrUpdateEditorRef {
  commitCurrentState: () => void
}

export default React.forwardRef(function EditorOrUpdateEditor ({
  editingItem,
  onRenamingSheet
}: {
  editingItem: ObjectWrapper<ComposableItem> | null
  onRenamingSheet: (info: RenameDialogInfo) => void
}, ref: React.ForwardedRef<EditorOrUpdateEditorRef>): JSX.Element {
  const [isUpdateMode, setIsUpdateMode] = React.useState<boolean>(false)
  const editorRef = React.useRef<EditorRef>(null)

  React.useImperativeHandle(
    ref,
    () => ({
      commitCurrentState: () => { editorRef.current!.commitCurrentState() }
    })
  )

  return (
    <>
      <div className="editor-or-update-editor" style={{ display: !isUpdateMode ? 'flex' : 'none' }}>
        <Editor
          ref={editorRef}
          editingItem={editingItem}
          onRenamingSheet={onRenamingSheet}
          onGoToUpdateMode={() => { setIsUpdateMode(true) }}
          show={!isUpdateMode}
        />
      </div>
      <div className="editor-or-update-editor" style={{ display: isUpdateMode ? 'flex' : 'none' }}>
        <UpdateEditor
          show={isUpdateMode}
          onGoToQueryMode={() => { setIsUpdateMode(false) }}
        />
      </div>
    </>
  )
})

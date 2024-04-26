import React from 'react'
import { useWorkspaceContext } from './WorkspaceContext'
import { type AiResult, askAi } from '../api'
import * as dialog from './dialog'

export interface EditorContext {
  selection: string | null
  currentSql: string | null
}

export default React.forwardRef(function AskAi (
  {
    show,
    onGetContext,
    onSuccess
  }: {
    show: boolean
    onGetContext: () => EditorContext
    onSuccess: (result: AiResult) => Promise<void>
  },
  ref: React.Ref<unknown>
): JSX.Element {
  const workspaceState = useWorkspaceContext()

  const askAiTextboxRef = React.useRef<HTMLInputElement>(null)
  const [command, setCommand] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const focus = React.useCallback(
    () => {
      askAiTextboxRef.current?.focus()
      askAiTextboxRef.current?.select()
    },
    []
  )

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => { focus() }
    }),
    [focus]
  )

  const submit = React.useCallback(
    async () => {
      if (isLoading) { return }

      setIsLoading(true)
      try {
        const context = onGetContext()

        let currentSql = context.currentSql?.trim() ?? null
        if (!currentSql) { currentSql = null }

        let selection = context.selection?.trim() ?? null
        if (!selection) { selection = null }

        const result = await askAi(
          command,
          selection,
          currentSql,
          workspaceState.results.filter((r) => r.base.isComposable()).map((r) => r.base)
        )
        await onSuccess(result)
        setTimeout(() => { focus() }, 1)
      } catch (e) {
        const error = e as any

        dialog.showError('Asking AI failed', error.message as string)
      } finally {
        setIsLoading(false)
      }
    },
    [command, focus, isLoading, onGetContext, onSuccess, workspaceState.results]
  )

  return (
    <div style={{
      fontSize: '12px',
      gap: '0px 5px',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '4px',
      backgroundColor: '#aaa',
      display: show ? 'flex' : 'none'
    }}>
      <span><i className="fas fa-robot"></i></span>
      <span>Ask AI:</span>
      <span style={{ flexGrow: 1000 }}>
        <input
          type="text"
          style={{ width: '100%' }}
          placeholder="What are the interesting insights?"
          ref={askAiTextboxRef}
          value={command}
          onChange={(event) => { setCommand(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void submit()
              event.stopPropagation()
              event.preventDefault()
            }
          }}
          disabled={isLoading}
        />
      </span>
    </div>
  )
})

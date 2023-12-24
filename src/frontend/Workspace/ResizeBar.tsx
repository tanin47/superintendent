import React from 'react'

export default function ResizeBar ({
  currentSize,
  onResizing,
  children
}: {
  currentSize: number
  onResizing: (start: number, dx: number, dy: number) => void
  children: React.ReactElement
}): JSX.Element {
  const [downSize, setDownSize] = React.useState<number>(currentSize)
  const [isResizing, setIsResizing] = React.useState<boolean>(false)
  const [mouseDownX, setMouseDownX] = React.useState<number>(0)
  const [mouseDownY, setMouseDownY] = React.useState<number>(0)

  const moveHandler = React.useCallback(
    (event) => {
      if (!isResizing) {
        return
      }

      onResizing(downSize, event.clientX - mouseDownX, event.clientY - mouseDownY)
    },
    [downSize, isResizing, mouseDownX, mouseDownY]
  )
  const upHandler = React.useCallback(
    (event) => {
      setIsResizing(false)
    },
    []
  )

  const downHandler = React.useCallback(
    (event: MouseEvent) => {
      setMouseDownX(event.clientX)
      setMouseDownY(event.clientY)
      setIsResizing(true)
      setDownSize(currentSize)
    },
    [currentSize]
  )

  React.useEffect(
    () => {
      const preventDragging = (e: Event): boolean => { e.preventDefault(); return false }
      const previousUserSelect = document.body.style.userSelect

      if (isResizing) {
        document.body.style.userSelect = 'none'
        document.addEventListener('dragstart', preventDragging)
        document.addEventListener('mousemove', moveHandler)
        document.addEventListener('mouseup', upHandler)
      }

      return () => {
        if (isResizing) {
          document.body.style.userSelect = previousUserSelect
          document.removeEventListener('dragstart', preventDragging)
          document.removeEventListener('mousemove', moveHandler)
          document.removeEventListener('mouseup', upHandler)
        }
      }
    },
    [isResizing, moveHandler, upHandler]
  )

  const clonedElement = React.useMemo(
    () => {
      return React.cloneElement(
        React.Children.only(children),
        {
          onMouseDown: downHandler
        }
      )
    },
    [downHandler, children]
  )

  return clonedElement
}

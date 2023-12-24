import Tippy, { type TippyProps } from '@tippyjs/react'
import React from 'react'

export default function MaybeTippy (props: TippyProps & { shown: boolean }): JSX.Element {
  const { children, shown, ...tippyProps } = props

  if (shown) {
    return (<Tippy {...tippyProps}>{children}</Tippy>)
  } else {
    return children!
  }
}

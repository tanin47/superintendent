import React from 'react'
import { type Ref } from './AddCsvModal'
import Modal from 'react-modal'

export default function CopyingModal ({
  isOpen,
  cellCount
}: {
  isOpen: boolean
  cellCount: number
}, ref: React.ForwardedRef<Ref>): JSX.Element {
  return (
    <Modal
      isOpen={isOpen}
      className="modal"
      overlayClassName="modal-overlay"
    >
      <span className="spinner" /> Copying {cellCount.toLocaleString('en-US')} {cellCount > 1 ? 'cells' : 'cell'}...
    </Modal>
  )
}

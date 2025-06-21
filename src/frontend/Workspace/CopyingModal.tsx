import React from 'react'
import Modal from 'react-modal'

export default function CopyingModal ({
  isOpen,
  cellCount
}: {
  isOpen: boolean
  cellCount: number
}): JSX.Element {
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

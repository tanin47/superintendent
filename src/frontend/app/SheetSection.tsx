import React, {ReactElement} from 'react';
import {Sheet as SheetType} from "./types";
import Sheet from "./Sheet";

export default function SheetSection({
  sheets,
  selectedSheetIndex,
  onSheetSelected
}: {
  sheets: Array<SheetType>,
  selectedSheetIndex: number,
  onSheetSelected: (selectedSheetIndex: number) => void
}): ReactElement {
  return (
    <>
      {sheets.length > 0 && <Sheet sheet={sheets[Math.min(selectedSheetIndex, sheets.length - 1)]} />}
      <div className="selector">
        {sheets.map((sheet, index) => {
          return (
            <div key={`sheet${index}`} onClick={() => onSheetSelected(index)}>{sheet.name}</div>
          );
        })}
      </div>
    </>
  );
}

import React, {ReactElement} from 'react';
import {PresentationType, Sheet as SheetType} from "./types";
import Sheet from "./Sheet";
import './SheetSection.scss';

let timer: NodeJS.Timeout;

type Tab = {
  sheetIndex: number,
  sheet: SheetType
};

export interface Ref {
  open: (sheetId: string) => void,
  getSelectedTab: () => Tab | null,
}

type Props = {
  sheets: SheetType[],
  editorSelectedSheetIndex: number | null,
  onSheetRenamed: (renamingSheetIndex: number) => void,
  onSelectedSheetUpdated: (sheet: SheetType | null) => void,
  presentationType: PresentationType
};

export default React.forwardRef<Ref, Props>(function SheetSection({
  sheets,
  editorSelectedSheetIndex,
  onSheetRenamed,
  onSelectedSheetUpdated,
  presentationType,
}: Props, ref): ReactElement {

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [shadowSheets, setShadowSheets] = React.useState<SheetType[]>([]);
  const [selectedTabIndex, setSelectedTabIndex] = React.useState<number>(0);
  const [blinkingSelectedTab, setBlinkingSelectedTab] = React.useState<boolean>(false);
  const blinkingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      open: (sheetId) => {
        try {
          for (let index=0;index<tabs.length;index++) {
            if (tabs[index].sheet.name === sheetId) {
              setSelectedTabIndex(index);
              return;
            }
          }

          for (let index=0;index<shadowSheets.length;index++) {
            if (shadowSheets[index].name === sheetId) {
              tabs.push({
                sheetIndex: index,
                sheet: shadowSheets[index]
              })
              setTabs([...tabs])
              setSelectedTabIndex(tabs.length - 1);
            }
          }
        } finally {
          if (blinkingTimeoutRef.current) {
            clearInterval(blinkingTimeoutRef.current);
          }

          setBlinkingSelectedTab(true);
          blinkingTimeoutRef.current = setTimeout(
            () => {
              setBlinkingSelectedTab(false)
            },
            1500
          );
        }
      },
      getSelectedTab: () => {
        return tabs[selectedTabIndex];
      }
    }),
    [tabs, shadowSheets, selectedTabIndex]
  );

  React.useEffect(
    () => {
      const existings = new Set(shadowSheets.map((s) => s.name));
      let newSelectedTabIndex = selectedTabIndex;

      for (let index=0;index<sheets.length;index++) {
        const sheet = sheets[index];
        if (!existings.has(sheet.name)) {
          shadowSheets.push(sheet);
          tabs.push({
            sheetIndex: index,
            sheet
          });
          newSelectedTabIndex = tabs.length - 1;
        }
      }

      const sheetNameSet = new Set(sheets.map((s) => s.name));
      const deletedTabIndices = new Set<number>()

      for (let index=0;index<tabs.length;index++) {
        if (!sheetNameSet.has(tabs[index].sheet.name)) {
          deletedTabIndices.add(index);
        }
      }

      const newTabs = tabs.filter((t, i) => !deletedTabIndices.has(i));
      setTabs(newTabs);
      setSelectedTabIndex(Math.min(Math.max(0, newSelectedTabIndex), newTabs.length - 1));

      const deletedShadowSheetIndices = new Set<number>()

      for (let index=0;index<shadowSheets.length;index++) {
        if (!sheetNameSet.has(shadowSheets[index].name)) {
          deletedShadowSheetIndices.add(index);
        }
      }
      setShadowSheets(shadowSheets.filter((t, i) => !deletedShadowSheetIndices.has(i)));
    },
    [sheets]
  );

  const onSingleClick = React.useCallback(
    (index: number) => {
      setSelectedTabIndex(index)
    },
    []
  );

  const onDoubleClick = React.useCallback(
    (index: number) => {
      onSheetRenamed(index);
    },
    []
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, index: number) => {
      clearTimeout(timer);
      if (event.detail === 1) {
        timer = setTimeout(() => onSingleClick(index), 100);
      } else if (event.detail >= 2) {
        onDoubleClick(index);
      }
    },
    [onDoubleClick]
  );

  const rearrangedCallback = React.useCallback(
    (movedIndex: number, newIndex: number): void => {
      const copied = [...tabs];
      const moved = copied.splice(movedIndex, 1);
      copied.splice(newIndex, 0, moved[0]);
      setTabs(copied);

      const selectedSheetName = tabs[selectedTabIndex].sheet.name;
      for (let i=0;i<copied.length;i++) {
        if (copied[i].sheet.name === selectedSheetName) {
          setSelectedTabIndex(i);
        }
      }
    },
    [tabs, selectedTabIndex]
  );

  React.useEffect(() => {
    const handler = (event) => {
      if (sheets.length === 0) { return; }
      if (event.code === 'KeyJ' && (event.metaKey || event.ctrlKey)) {
        onDoubleClick(selectedTabIndex);
        return false;
      }

      return true;
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler) ;
    };
  }, [onDoubleClick, selectedTabIndex, sheets]);

  React.useEffect(
    () => {
      onSelectedSheetUpdated(0 <= selectedTabIndex && selectedTabIndex < tabs.length ? tabs[selectedTabIndex].sheet : null);
    },
    [tabs, selectedTabIndex]
  )

  return (
    <div id="sheetSection" className={tabs.length === 0 ? 'empty' : ''}>
      {tabs.length > 0 && (
        <Sheet
          sheet={tabs[selectedTabIndex].sheet}
          onSelectedSheetUpdated={onSelectedSheetUpdated}
          presentationType={presentationType}
        />
      )}
      <div
        className="selector"
        onDragOver={(event) => {
          if (draggedIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          if (draggedIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          rearrangedCallback(draggedIndex, tabs.length);
        }}
      >
        {tabs.map((tab, index) => {
          return (
            <div
              key={`sheet${index}`}
              className={selectedTabIndex === index ? 'selected' : ''}
              onClick={(event) => handleClick(event, index)}
              draggable={true}
              onDrag={(event) => {
                setDraggedIndex(index);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (draggedIndex === null) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                if (draggedIndex === null) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();

                if (draggedIndex === index) { return; }
                rearrangedCallback(draggedIndex, index);
              }}
            >
              {tab.sheet.isCsv && (
                <i
                  className="fas fa-file" title="Imported"
                />
              )}
              <span className={`${selectedTabIndex === index && blinkingSelectedTab ? 'blinking' : ''} ${editorSelectedSheetIndex === tab.sheetIndex ? 'editor-selected' : ''}`}>{tab.sheet.name}</span>
              {editorSelectedSheetIndex !== tab.sheetIndex && (
                <i
                  className="fas fa-times"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation(); // don't trigger selecting sheet.

                    const newTabs = tabs.filter((t, i) => index !== i);
                    if (selectedTabIndex >= newTabs.length) {
                      setSelectedTabIndex(Math.max(0, newTabs.length - 1));
                    }
                    setTabs(newTabs);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

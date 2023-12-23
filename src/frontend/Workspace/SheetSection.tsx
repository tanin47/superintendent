import React, {ReactElement} from 'react';
import {PresentationType, Sheet as SheetType} from "./types";
import Sheet from "./Sheet";
import './SheetSection.scss';
import {SortDirection} from "../../types";

let timer: NodeJS.Timeout;

type Tab = {
  sheet: SheetType
};

export interface Ref {
  open: (sheetId: string) => void,
  getSelectedTab: () => Tab | null,
}

type Props = {
  sheets: SheetType[],
  onSelectedSheetUpdated: (sheet: SheetType | null) => void,
  onRenamingSheet: (sheetName: string) => void,
  onSorting: (sheet: SheetType, column: string, direction: SortDirection) => void,
  presentationType: PresentationType
};

export default React.forwardRef<Ref, Props>(function SheetSection({
  sheets,
  onSelectedSheetUpdated,
  onRenamingSheet,
  onSorting,
  presentationType,
}: Props, ref): ReactElement {

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [shadowSheets, setShadowSheets] = React.useState<SheetType[]>([]);
  const [selectedTabIndex, setSelectedTabIndex] = React.useState<number>(0);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  React.useImperativeHandle(
    ref,
    () => ({
      open: (sheetId) => {
        for (let index=0;index<tabs.length;index++) {
          if (tabs[index].sheet.name === sheetId) {
            setSelectedTabIndex(index);
            return;
          }
        }

        for (let index=0;index<shadowSheets.length;index++) {
          if (shadowSheets[index].name === sheetId) {
            tabs.push({
              sheet: shadowSheets[index]
            })
            setTabs([...tabs])
            setSelectedTabIndex(tabs.length - 1);
          }
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
      const existings = new Map(shadowSheets.map((s, index) => [s.name, index]));
      let newSelectedTabIndex = selectedTabIndex;

      // Add a new sheet and replace a sheet
      for (let index=0;index<sheets.length;index++) {
        const sheet = sheets[index];
        const currentShadowSheetIndex = existings.get(sheet.name) ?? existings.get(sheet.previousName || '');

        if (currentShadowSheetIndex !== undefined) {
          const currentSheet = shadowSheets[currentShadowSheetIndex]
          if (currentSheet !== sheet) {
            // The sheet has been replaced upstream. Therefore, we replace the shadow sheet and the corresponding tab.
            shadowSheets.splice(currentShadowSheetIndex, 1, sheet);

            for (let tabIndex=0;tabIndex<tabs.length;tabIndex++) {
              if (sheet.name === tabs[tabIndex].sheet.name) {
                tabs[tabIndex].sheet = sheet;
                break;
              }
            }
          }
        } else {
          shadowSheets.push(sheet);
          tabs.push({
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

  React.useEffect(
    () => {
      onSelectedSheetUpdated(0 <= selectedTabIndex && selectedTabIndex < tabs.length ? tabs[selectedTabIndex].sheet : null);
    },
    [tabs, selectedTabIndex]
  )

  let content: JSX.Element | null = null;

  if (tabs.length > 0) {
    content = (
      <>
        <Sheet
          sheet={tabs[selectedTabIndex].sheet}
          onSelectedSheetUpdated={onSelectedSheetUpdated}
          presentationType={presentationType}
          onSorting={onSorting}
        />
        <div
          className="selector"
          data-testid="sheet-item-list"
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
          <div className="sort-button">
            <i
              className={`fas ${sortDirection === 'asc' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up'}`}
              title="Sort alphabetically"
              onClick={() => {
                const selectedSheetName = tabs[selectedTabIndex].sheet.name;

                tabs.sort((a, b) => {
                  if (a.sheet.isCsv != b.sheet.isCsv) {
                    if (a.sheet.isCsv) { return -1; }
                    else { return 1; }
                  } else {
                    return a.sheet.name.toLowerCase().localeCompare(b.sheet.name.toLowerCase());
                  }
                });

                if (sortDirection === 'desc') {
                  tabs.reverse()
                }

                for (let i=0;i<tabs.length;i++) {
                  if (tabs[i].sheet.name === selectedSheetName) {
                    setSelectedTabIndex(i);
                  }
                }

                setTabs([...tabs]);
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
              }}
            />
          </div>
          {tabs.map((tab, index) => {
            let icon = tab.sheet.isCsv ? (
              <i className="fas fa-file-csv icon"></i>
            ) : (
              <i className="fas fa-caret-square-right icon"></i>
            );

            if (tab.sheet.isLoading) {
              icon = <span className="spinner" />;
            }

            return (
              <div
                key={tab.sheet.name}
                data-testid={`sheet-section-item-${tab.sheet.name}`}
                className={`tab ${selectedTabIndex === index ? 'selected' : ''}`}
                onClick={(event) => {
                  setSelectedTabIndex(index);
                }}
                onDoubleClick={(event) => {
                  onRenamingSheet(tab.sheet.name);
                }}
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
                {tab.sheet.isLoading && (
                  <div className="overlay" style={{cursor: 'pointer'}}/>
                )}
                {icon}
                <span>{tab.sheet.name}</span>
                <i
                  className="fas fa-times"
                  onClick={(event) => {
                    event.stopPropagation(); // don't trigger selecting sheet.

                    const newTabs = tabs.filter((t, i) => index !== i);
                    if (selectedTabIndex >= newTabs.length) {
                      setSelectedTabIndex(Math.max(0, newTabs.length - 1));
                    }
                    setTabs(newTabs);
                  }}
                />
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div id="sheetSection" className={tabs.length === 0 ? 'empty' : ''}>
      {content}
    </div>
  );
});

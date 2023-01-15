import {XYPosition} from "@reactflow/core/dist/esm/types";

export type EditorMode = 'default' | 'vim';

export type Format = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'colon' | 'tilde' | 'super';

export const ExportDelimiters = ['comma', 'tab', 'pipe', 'semicolon', 'colon', 'tilde'] as const;
export type ExportDelimiter = typeof ExportDelimiters[number];

export const EditorModeChannel = 'editor-mode-changed';
export const ExportWorkflowChannel = 'export-workflow';
export const ImportWorkflowChannel = 'import-workflow';

export type CopySelection = {
  columns: Array<string>,
  startRow: number,
  endRow: number,
  includeRowNumbers: boolean,
  includeColumnNames: boolean,
};

export type WorkflowNode = {
  name: string,
  dependsOn: string[],
  sql: string,
  isCsv: boolean,
  position: XYPosition
}

export type ExportedWorkflow = {
  nodes: WorkflowNode[],
}

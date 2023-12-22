export type EditorMode = 'default' | 'vim';

export type Format = 'comma' | 'tab' | 'pipe' | 'semicolon' | 'colon' | 'tilde' | 'super';

export const ExportDelimiters = ['comma', 'tab', 'pipe', 'semicolon', 'colon', 'tilde'] as const;
export type ExportDelimiter = typeof ExportDelimiters[number];
export const ExportWorkflowChannel = 'export-workflow';
export const ImportWorkflowChannel = 'import-workflow';

export const EditorModeChannel = 'editor-mode-changed';

export type SortDirection = 'asc' | 'desc' | 'none';
export type Sort = {name: string, direction: SortDirection};

export type CopySelection = {
  columns: Array<string>,
  startRow: number,
  endRow: number,
  includeRowNumbers: boolean,
  includeColumnNames: boolean,
};

export type WorkflowNode = {
  name: string,
  sql: string,
  isCsv: boolean,
  dependsOn: string[],
}

export type ExportedWorkflow = {
  nodes: WorkflowNode[],
}

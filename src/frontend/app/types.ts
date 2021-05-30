export type Sheet = {
  name: string,
  columns: Array<string>,
  rows: Array<{[key:string]: any}>,
};

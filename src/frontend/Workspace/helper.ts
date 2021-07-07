
export function formatTotal(total: number): string {
  const unit = total === 1 ? 'row' : 'rows';
  return `${total.toLocaleString('en-US')} ${unit}`;
}

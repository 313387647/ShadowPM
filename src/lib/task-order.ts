/** Project control-item order is explicit. Status and filters never mutate it. */
export function hasExactTaskOrder(existingIds: string[], orderedIds: string[]) {
  return existingIds.length === orderedIds.length
    && new Set(orderedIds).size === orderedIds.length
    && orderedIds.every((id) => existingIds.includes(id));
}

export function moveTaskInList<T extends { id: string }>(items: T[], taskId: string, targetId: string) {
  const fromIndex = items.findIndex((item) => item.id === taskId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return items;

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(targetIndex, 0, moved);
  return nextItems;
}

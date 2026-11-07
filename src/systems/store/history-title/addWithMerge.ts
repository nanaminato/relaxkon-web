import {ChatHistoryTitle} from "../../../models";

export function addWithMerge(
  origin: ChatHistoryTitle[],
  incoming: ChatHistoryTitle[]
): ChatHistoryTitle[] {
  // Both lists are scoped to the active account and its local guest history.
  const byId = new Map<number, ChatHistoryTitle>();
  for (const item of [...origin, ...incoming]) {
    if (item.userId != null || byId.get(item.dataId)?.userId == null) byId.set(item.dataId, item);
  }
  return [...byId.values()].sort((a, b) => b.dataId - a.dataId);
}

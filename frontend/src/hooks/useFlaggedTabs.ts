import { useMemo } from 'react';
import { useEventsContext } from '../contexts/EventsContext';

/**
 * Returns the set of tab IDs that have unread flagged notifications.
 * Use this to highlight tabs in sidebar dots, tab bar, etc.
 */
export function useFlaggedTabs(): Set<string> {
  const { notifications, readIds } = useEventsContext();
  return useMemo(
    () => new Set(
      notifications.filter(n => n.tab_id && n.flag && !readIds.has(n.id)).map(n => n.tab_id!)
    ),
    [notifications, readIds],
  );
}

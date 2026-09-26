import { useSyncExternalStore } from 'react';
import type { App } from './app';

/** Re-render the calling component whenever the app emits an event. */
export function useAppVersion(app: App): number {
  return useSyncExternalStore(app.subscribe, app.getVersion);
}

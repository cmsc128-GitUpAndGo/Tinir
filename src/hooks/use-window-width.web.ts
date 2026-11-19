import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';

const subscribe = () => () => {};

/**
 * The window width, safe for server rendering. The server has no window and renders at width 0, so the first
 * client render reports 0 as well and hydrates the same markup; the real width follows straight after.
 * Reading the live width during hydration made a desktop browser disagree with the server's compact layout.
 */
export function useWindowWidth() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const { width } = useWindowDimensions();
  return hydrated ? width : 0;
}

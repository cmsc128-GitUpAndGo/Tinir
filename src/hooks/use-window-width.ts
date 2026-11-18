import { useWindowDimensions } from 'react-native';

/** The window width. Native has no server render, so this is the live value. */
export function useWindowWidth() {
  return useWindowDimensions().width;
}

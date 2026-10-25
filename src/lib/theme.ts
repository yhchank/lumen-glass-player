export interface AppPalette {
  accentA: string;
  accentB: string;
  glow: string;
  ambient: string;
  dark: string;
}

/**
 * The application's fixed identity palette. It intentionally does not react to
 * album artwork, so the chrome stays recognisable from track to track.
 */
export const BRAND_PALETTE: AppPalette = {
  accentA: '#79e9da',
  accentB: '#a495ff',
  glow: '#2bb9a9',
  ambient: '#0c3b3a',
  dark: '#071716',
};

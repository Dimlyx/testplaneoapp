import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useInterfaceSettings, defaultInterfaceSettings } from '@/hooks/useAppSettings';

// Helper function to convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function CustomColorApplier({ children }: { children: React.ReactNode }) {
  const { data: settings } = useInterfaceSettings();

  useEffect(() => {
    const interfaceSettings = settings || defaultInterfaceSettings;
    const primaryHSL = hexToHSL(interfaceSettings.primaryColor);
    const accentHSL = hexToHSL(interfaceSettings.accentColor);
    const sidebarHSL = hexToHSL(interfaceSettings.sidebarColor);

    const root = document.documentElement;
    root.style.setProperty('--primary', `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);
    root.style.setProperty('--sidebar-background', `${sidebarHSL.h} ${sidebarHSL.s}% ${sidebarHSL.l}%`);
    root.style.setProperty('--sidebar-accent', `${accentHSL.h} ${accentHSL.s}% ${Math.min(accentHSL.l + 10, 100)}%`);
    root.style.setProperty('--sidebar-primary', `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`);

    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--sidebar-background');
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--sidebar-primary');
    };
  }, [settings]);

  return <>{children}</>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" storageKey="planeo-theme">
      <CustomColorApplier>{children}</CustomColorApplier>
    </NextThemesProvider>
  );
}

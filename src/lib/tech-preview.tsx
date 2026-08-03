import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'planeo_tech_preview';

export interface TechPreviewTarget {
  id: string;
  name: string;
}

/** Lecture synchrone hors React (hooks de données) */
export function getTechPreviewTarget(): TechPreviewTarget | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string') return parsed as TechPreviewTarget;
    return null;
  } catch {
    return null;
  }
}

export function isTechPreviewActive(): boolean {
  return getTechPreviewTarget() !== null;
}

interface TechPreviewContextValue {
  isTechPreview: boolean;
  previewTech: TechPreviewTarget | null;
  enableTechPreview: (tech: TechPreviewTarget) => void;
  disableTechPreview: () => void;
}

const TechPreviewContext = createContext<TechPreviewContextValue>({
  isTechPreview: false,
  previewTech: null,
  enableTechPreview: () => {},
  disableTechPreview: () => {},
});

export function TechPreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewTech, setPreviewTech] = useState<TechPreviewTarget | null>(() => getTechPreviewTarget());

  useEffect(() => {
    const handler = () => setPreviewTech(getTechPreviewTarget());
    window.addEventListener('planeo-tech-preview', handler);
    return () => window.removeEventListener('planeo-tech-preview', handler);
  }, []);

  const enableTechPreview = useCallback((tech: TechPreviewTarget) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tech));
    } catch {
      /* ignore */
    }
    setPreviewTech(tech);
    window.dispatchEvent(new Event('planeo-tech-preview'));
  }, []);

  const disableTechPreview = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPreviewTech(null);
    window.dispatchEvent(new Event('planeo-tech-preview'));
  }, []);

  return (
    <TechPreviewContext.Provider
      value={{ isTechPreview: previewTech !== null, previewTech, enableTechPreview, disableTechPreview }}
    >
      {children}
    </TechPreviewContext.Provider>
  );
}

export function useTechPreview() {
  return useContext(TechPreviewContext);
}

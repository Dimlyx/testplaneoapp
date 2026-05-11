import { Loader2, FileText } from "lucide-react";

interface PdfGenerationOverlayProps {
  open: boolean;
  message?: string;
}

/**
 * Overlay plein écran bloquant pendant la génération d'un rapport PDF.
 * Empêche l'utilisateur de cliquer ailleurs et signale visuellement
 * que les photos sont en cours de chargement avant le téléchargement.
 */
export function PdfGenerationOverlay({
  open,
  message = "Génération du rapport en cours...",
}: PdfGenerationOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-8 py-6 shadow-lg max-w-sm mx-4 text-center">
        <div className="relative">
          <FileText className="h-10 w-10 text-primary" />
          <Loader2 className="h-5 w-5 absolute -bottom-1 -right-1 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            Chargement des photos, merci de patienter...
          </p>
        </div>
      </div>
    </div>
  );
}

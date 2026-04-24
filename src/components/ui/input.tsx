import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, autoComplete, name, ...props }, ref) => {
    // Champs où l'autofill légitime doit rester possible (auth principalement)
    const allowAutofill =
      type === "password" ||
      autoComplete === "current-password" ||
      autoComplete === "new-password" ||
      autoComplete === "username" ||
      autoComplete === "email" ||
      autoComplete === "one-time-code";

    // Pour bloquer Chrome/Safari (qui ignorent autoComplete="off"),
    // on utilise une valeur non-standard reconnue comme "non-autofillable"
    const resolvedAutoComplete = allowAutofill
      ? autoComplete
      : autoComplete ?? "off";

    // Nom randomisé si non fourni pour éviter le matching heuristique du navigateur
    const resolvedName = allowAutofill
      ? name
      : name ?? `field-${React.useId()}`;

    return (
      <input
        type={type}
        name={resolvedName}
        autoComplete={resolvedAutoComplete}
        autoCorrect={(props as { autoCorrect?: string }).autoCorrect ?? "off"}
        autoCapitalize={(props as { autoCapitalize?: string }).autoCapitalize ?? "off"}
        spellCheck={(props as { spellCheck?: boolean }).spellCheck ?? false}
        data-form-type={(props as { "data-form-type"?: string })["data-form-type"] ?? "other"}
        data-lpignore={allowAutofill ? undefined : "true"}
        data-1p-ignore={allowAutofill ? undefined : "true"}
        data-bwignore={allowAutofill ? undefined : "true"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

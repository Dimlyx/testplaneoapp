/**
 * Base URL utilisée pour générer les liens publics extranet (partagés aux clients).
 * Toujours utiliser le domaine de production, jamais window.location.origin
 * qui pointerait sur le preview Lovable ou un autre domaine.
 */
export const EXTRANET_BASE_URL = "https://app.planeo.tech";

export const buildExtranetUrl = (publicToken: string): string =>
  `${EXTRANET_BASE_URL}/intervention/${publicToken}`;

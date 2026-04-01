/**
 * Opens the address in the user's preferred maps application.
 * - iOS: Apple Maps (which offers to open in other apps)
 * - Android: Google Maps intent (triggers app chooser)
 * - Desktop/fallback: Google Maps in new tab
 */
export function openAddressInMaps(address: string) {
  const encoded = encodeURIComponent(address);
  const userAgent = navigator.userAgent || "";

  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);

  let url: string;

  if (isIOS) {
    // Apple Maps — iOS will offer to open in Google Maps/Waze if installed
    url = `https://maps.apple.com/?q=${encoded}`;
  } else if (isAndroid) {
    // Android intent — triggers the app chooser (Google Maps, Waze, etc.)
    url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  } else {
    // Desktop fallback
    url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

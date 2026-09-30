// START_MODULE_CONTRACT
// PURPOSE: The one-letter person avatar the social screens share (макет, экраны 24-29): a MAX gradient disc with the initial of the name.
// SCOPE: Colour choice and markup only; sizes come from the caller, the skin from ./../ui/theme.css. Photos of people do not exist in this product, so the disc is the avatar, not a fallback.
// DEPENDS: ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - personLetter - "Анна Кравцова" -> "А" for the avatar disc
// - personGradient - stable 0..4 gradient index of a person id, so the same face keeps its colour across screens
// - PersonAvatar - gradient disc with the initial; size in px, decorative for assistive tech
// END_MODULE_MAP

/** The design puts one letter on the disc, not two: a 28px face in a stack has room for exactly one. */
export function personLetter(name: string): string {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

/** Colour by id, not by position: a friend keeps the same face in the feed, on the card and in the route. */
export function personGradient(id: string): number {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum += id.charCodeAt(index);
  return sum % 5;
}

export function PersonAvatar({ id, name, size = 44, className }: { id: string; name: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={className ? `app-person-face app-person-face--g${personGradient(id)} ${className}` : `app-person-face app-person-face--g${personGradient(id)}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.39) }}>
      {personLetter(name)}
    </span>
  );
}

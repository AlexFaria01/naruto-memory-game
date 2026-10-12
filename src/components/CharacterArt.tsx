import { useEffect, useState, type CSSProperties } from "react";
import type { Character } from "../game/roster";

/**
 * Renders a character portrait over a tinted wash so official artwork with
 * transparent margins still sits inside the card as a finished surface.
 * If the remote image is unavailable offline, it falls back to an abstract
 * village seal — never a stand-in drawing of the character.
 */
export function CharacterArt({ character, eager = false }: { character: Character; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [character.image]);

  if (failed) {
    return (
      <span className="art-fallback" style={{ "--tint": character.tint } as CSSProperties} aria-hidden="true">
        <span className="art-fallback-ring" />
        <span className="art-fallback-name">{character.name}</span>
      </span>
    );
  }

  return (
    <span className="art-frame" style={{ "--tint": character.tint } as CSSProperties}>
      <img
        src={character.image}
        alt=""
        draggable={false}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        className={`art-image ${loaded ? "is-loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** Warm the browser cache for the whole roster so flips never pop in blank. */
export function preloadRoster(characters: Character[]) {
  if (typeof window === "undefined") return [];
  return characters.map((character) => {
    const asset = new Image();
    asset.decoding = "async";
    asset.src = character.image;
    return asset;
  });
}

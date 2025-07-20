export interface AnimeOptions {
  delay: number;
  duration: number;
  distance: number;
  easing: string; // one of the supported animeJS easings: https://animejs.com/documentation/#pennerFunctions
}

export type TriggerPlacement =
  | "top-bottom"
  | "center-bottom"
  | "bottom-bottom"
  | "top-center"
  | "center-center"
  | "bottom-center"
  | "top-top"
  | "bottom-top"
  | "center-top";

export interface AOSDefaultOptions extends AnimeOptions {
  offset: number;
  once: boolean;
  mirror: boolean;
  disable: boolean;
  anchorPlacement: TriggerPlacement;
  startEvent: string;
  animatedClassName: string;
  initClassName: string;
  disableMutationObserver: boolean;
  throttleDelay: number;
  debounceDelay: number;
}

// Define a type for anime.js animation instance
export interface AnimeInstance {
  play: () => void;
  pause: () => void;
  restart: () => void;
  reverse: () => void;
  seek: (time: number) => void;
  reversed: boolean;
  completed: boolean;
}

export interface AOSElement {
  node: HTMLElement;
  animation?: AnimeInstance; // Replace 'any' with a more specific type
  animated?: boolean;
  position?: {
    in?: number;
    out?: number | false;
  };
  options?: {
    once?: boolean;
    mirror?: boolean;
    animatedClassNames?: string[];
    trigger?: string;
  };
}

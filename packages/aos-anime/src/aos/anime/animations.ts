import anime from "animejs/lib/anime.es.js";

import { type AnimeOptions } from "../helpers/aosTypes";

export const getAnimation = (
  element: HTMLElement,
  animationName: string,
  defaults: AnimeOptions,
) => {
  const tempDelay = element.dataset.aosDelay;
  const delay = tempDelay ? parseFloat(tempDelay) * 1000 : defaults.delay * 1000;

  const tempDistance = element.dataset.aosDistance;
  const distance = tempDistance ? parseFloat(tempDistance) : defaults.distance;

  const tempDuration = element.dataset.aosDuration;
  const duration = tempDuration ? parseFloat(tempDuration) * 1000 : defaults.duration * 1000;

  const onStartFunction = () => {
    element.classList.add("aos-animate");
  };

  let animation;

  if (animationName.includes("fade")) {
    // fade animations
    switch (animationName) {
      case "fade-in":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-up":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateY: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-down":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateY: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-left":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-right":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-up-right":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [-1 * distance, 0],
          translateY: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-up-left":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [distance, 0],
          translateY: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-down-right":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [-1 * distance, 0],
          translateY: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "fade-down-left":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          translateX: [distance, 0],
          translateY: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      default:
        // default is fade-in
        animation = anime({
          targets: element,
          opacity: [0, 1],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
    }
  } else if (animationName.includes("zoom")) {
    // zoom animations
    switch (animationName) {
      case "zoom-in":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-in-up":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          translateY: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-in-down":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          translateY: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-in-left":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          translateX: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-in-right":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          translateX: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-out":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [1.2, 1],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-out-up":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [1.2, 1],
          translateY: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-out-down":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [1.2, 1],
          translateY: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-out-left":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [1.2, 1],
          translateX: [distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "zoom-out-right":
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [1.2, 1],
          translateX: [-1 * distance, 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      default:
        // default is zoom-in
        animation = anime({
          targets: element,
          opacity: [0, 1],
          scale: [0.6, 1],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
    }
  } else if (animationName.includes("slide")) {
    // slide animations
    switch (animationName) {
      case "slide-up":
        animation = anime({
          targets: element,
          translateY: ["100%", 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "slide-down":
        animation = anime({
          targets: element,
          translateY: ["-100%", 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "slide-left":
        animation = anime({
          targets: element,
          translateX: ["100%", 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "slide-right":
        animation = anime({
          targets: element,
          translateX: ["-100%", 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      default:
        // default is slide-up
        animation = anime({
          targets: element,
          translateY: ["100%", 0],
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
    }
  } else if (animationName.includes("flip")) {
    // flip animations
    switch (animationName) {
      case "flip-up":
        animation = anime({
          targets: element,
          rotateX: ["100deg", 0],
          perspective: "2500px",
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "flip-down":
        animation = anime({
          targets: element,
          rotateX: ["-100deg", 0],
          perspective: "2500px",
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "flip-left":
        animation = anime({
          targets: element,
          rotateY: ["-100deg", 0],
          perspective: "2500px",
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      case "flip-right":
        animation = anime({
          targets: element,
          rotateY: ["100deg", 0],
          perspective: "2500px",
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
      default:
        // default is flip-up
        animation = anime({
          targets: element,
          translateY: ["100%", 0],
          perspective: "2500px",
          duration: duration,
          delay: delay,
          easing: defaults.easing,
          begin: onStartFunction,
          autoplay: false,
        });
        break;
    }
  } else {
    // overall default is fade-in
    animation = anime({
      targets: element,
      opacity: [0, 1],
      duration: duration,
      delay: delay,
      easing: defaults.easing,
      begin: onStartFunction,
      autoplay: false,
    });
  }

  return animation;
};

export default getAnimation;

/* Clearing variables */

// Scroll animations
import { getAnimation } from "../anime/animations.js";
import { type AOSDefaultOptions, type AOSElement } from "./aosTypes.js";
import getInlineOption from "./getInlineOption.js";
import { getPositionIn, getPositionOut } from "./offsetCalculator.js";

const prepare = function (aosElements: AOSElement[], options: AOSDefaultOptions): AOSElement[] {
  aosElements.forEach((el) => {
    const animationName = el.node.getAttribute("data-aos") as string;
    const mirror = getInlineOption(el.node, "mirror", options.mirror) as boolean;
    const once = getInlineOption(el.node, "once", options.once) as boolean;
    const trigger = getInlineOption(el.node, "trigger") as string | undefined;

    const animatedClassNames = [options.animatedClassName].filter(
      (className) => typeof className === "string",
    );

    if (options.initClassName) {
      el.node.classList.add(options.initClassName);
    }

    el.position = {
      in: getPositionIn(el.node, options.offset, options.anchorPlacement),
      out: mirror && getPositionOut(el.node, options.offset),
    };

    el.animation = getAnimation(el.node, animationName, options);

    el.options = {
      once,
      mirror,
      animatedClassNames,
      trigger,
    };
  });

  return aosElements;
};

export default prepare;

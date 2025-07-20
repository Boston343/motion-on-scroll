/**
 * Generate initial array with elements as objects
 * This array will be extended later with elements attributes values
 * like 'position', 'animation', 'options' etc.
 */
import { type AOSElement } from "./aosTypes";

export default (): AOSElement[] => {
  const elements = document.querySelectorAll("[data-aos]");
  return Array.prototype.map.call(elements, (node) => ({ node }));
};

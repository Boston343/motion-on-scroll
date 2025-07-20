/**
 * Get inline option with a fallback.
 *
 * @param  {Node} el [Dom element]
 * @param  {String} key [Option key]
 * @param  {String} fallback [Default (fallback) value]
 * @return {Mixed} [Option set with inline attribute or fallback value if not set]
 */

export default (
  el: Element,
  key: string,
  fallback?: string | number | boolean,
): string | number | boolean => {
  const attr = el.getAttribute("data-aos-" + key);

  fallback = fallback || "";

  if (typeof attr !== "undefined") {
    if (attr === "true") {
      return true;
    } else if (attr === "false") {
      return false;
    }
  }

  return attr || fallback;
};

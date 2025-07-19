# Motion On Scroll (MOS)

[![NPM version](https://img.shields.io/npm/v/motion-on-scroll.svg?style=flat)](https://npmjs.org/package/motion-on-scroll) [![NPM downloads](https://img.shields.io/npm/dm/motion-on-scroll.svg?style=flat)](https://npmjs.org/package/motion-on-scroll) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Twitter Follow](https://img.shields.io/twitter/follow/webreaper.svg?style=social)](https://twitter.com/webreaper)

Effortless, AOS-compatible scroll animations powered by [Motion](https://motion.dev).

Framework-agnostic, MOS lets you add scroll-triggered animations with nothing but `data-mos` attributes. Under the hood it uses Motion’s powerful `inView` + `animate` APIs, giving you:

- 27 preset effects out of the box
- Support for custom keyframes, easings, and fully bespoke timelines
- AOS-compatible features for painless migration
- First-class TypeScript types

> 📚 **Full docs → [motion-on-scroll.pages.dev](https://motion-on-scroll.pages.dev)**

---

## Quick start

```bash
npm i motion-on-scroll
```

```html
<!-- Styles -->
<link href="https://cdn.jsdelivr.net/npm/motion-on-scroll@latest/dist/mos.css" rel="stylesheet" />

<!-- Script & init -->
<script type="module">
  import { MOS } from "motion-on-scroll";
  MOS.init();
</script>

<!-- Element to animate -->
<div data-mos="fade-up">Hello world</div>
```

**Migrating from AOS?** Check the guide → <https://motion-on-scroll.pages.dev/getting-started/migrate-from-aos>

---

## Basic usage

All you have to do is to add `data-mos` attribute to html element, like so:

```html
<div data-mos="animation_name"></div>
```

Script will trigger "animation_name" animation on this element, if you scroll to it.

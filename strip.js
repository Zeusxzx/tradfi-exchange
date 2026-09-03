'use strict';
/* Comment stripping for anything served to a browser.
   The source in this repo is commented heavily on purpose -- the reasoning is
   worth keeping. None of it belongs in View Source. This runs once at boot and
   the stripped copy is what goes over the wire.

   It is a character scanner, not a regex: `//` inside a string, a `/*` inside
   a template literal and a division sign next to a regex literal all have to
   survive, and a regex-based stripper silently corrupts all three. */

function stripJs(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // what the previous significant token was, to tell `/` (divide) from `/` (regex)
  let prev = '';
  while (i < n) {
    const c = src[i], d = src[i + 1];

    if (c === '/' && d === '/') {                       // line comment
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {                       // block comment
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      out += ' ';                                       // keep tokens apart
      continue;
    }
    if (c === '"' || c === "'") {                       // string
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      prev = q;
      continue;
    }
    if (c === '`') {                                    // template literal
      out += c; i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { depth++; out += '${'; i += 2; continue; }
        if (src[i] === '}' && depth > 0) { depth--; out += '}'; i++; continue; }
        out += src[i];
        if (src[i] === '`' && depth === 0) { i++; break; }
        i++;
      }
      prev = '`';
      continue;
    }
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^<>]|^$|return|typeof|case|in|of|new|delete|void|do|else|yield|await/.test(prev)) {
      out += c; i++;                                    // regex literal
      let cls = false;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '[') cls = true;
        else if (src[i] === ']') cls = false;
        out += src[i];
        if (src[i] === '/' && !cls) { i++; break; }
        i++;
      }
      while (i < n && /[a-z]/.test(src[i])) { out += src[i]; i++; }
      prev = '/';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = /[A-Za-z0-9_$]/.test(c) ? (/[A-Za-z0-9_$]/.test(prev) ? prev + c : c) : c;
    i++;
  }
  return collapse(out);
}

function stripCss(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i]; out += src[i]; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    out += src[i]; i++;
  }
  return collapse(out);
}

function stripHtml(src) {
  // leave conditional comments alone; there are none, but be exact anyway
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    if (src.startsWith('<!--', i) && !src.startsWith('<!--[', i)) {
      const end = src.indexOf('-->', i);
      i = end === -1 ? n : end + 3;
      continue;
    }
    out += src[i]; i++;
  }
  return collapse(out);
}

/** Blank runs left behind by removed comments are themselves a tell. */
function collapse(s) {
  return s.split('\n').map((l) => (l.trim() === '' ? '' : l.replace(/\s+$/, '')))
    .join('\n').replace(/\n{2,}/g, '\n').replace(/^\n+/, '');
}

module.exports = { stripJs, stripCss, stripHtml };

/*
 * Adapted from cross-spawn 7.0.6 (lib/util/escape.js)
 * https://github.com/moxystudio/node-cross-spawn
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const META_CHARS_PATTERN = /([()\][%!^"`<>&|;, *?])/g;
const BACKSLASHES_BEFORE_QUOTE_PATTERN = /(?=(\\+?)?)\1"/g;
const TRAILING_BACKSLASHES_PATTERN = /(?=(\\+?)?)\1$/;

export function escapeMetaCharacters(value: string): string {
  return value.replace(META_CHARS_PATTERN, '^$1');
}

export function escapeArgument(
  arg: string,
  doubleEscapeMetaChars: boolean
): string {
  const quotesEscaped = arg.replace(
    BACKSLASHES_BEFORE_QUOTE_PATTERN,
    '$1$1\\"'
  );
  const trailingEscaped = quotesEscaped.replace(
    TRAILING_BACKSLASHES_PATTERN,
    '$1$1'
  );
  const escaped = escapeMetaCharacters(`"${trailingEscaped}"`);

  return doubleEscapeMetaChars ? escapeMetaCharacters(escaped) : escaped;
}

/**
 * Ensures CHROME_BIN is set for Karma (karma-chrome-launcher).
 *
 * When CHROME_BIN is already set, it is left unchanged (even if invalid).
 * When unset, resolution order is: CHROME_PATH, common OS install locations,
 * then Puppeteer's bundled Chromium via {@link https://pptr.dev/ puppeteer}.
 *
 * In CI or sandboxes where Puppeteer's Chromium download fails or segfaults,
 * install system Chrome/Chromium and set CHROME_BIN to that executable.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function isExecutableFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }
    const st = fs.statSync(filePath);
    return st.isFile();
  } catch (e) {
    return false;
  }
}

function systemChromeCandidates() {
  const list = [];
  if (process.env.CHROME_PATH) {
    list.push(process.env.CHROME_PATH);
  }
  list.push(
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  );
  if (process.platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    list.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  }
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES;
    const pf86 = process.env['PROGRAMFILES(X86)'];
    if (pf) {
      list.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    if (pf86) {
      list.push(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  }
  return list;
}

function resolveChromeBin() {
  for (const c of systemChromeCandidates()) {
    if (isExecutableFile(c)) {
      return c;
    }
  }
  return require('puppeteer').executablePath();
}

if (!process.env.CHROME_BIN) {
  process.env.CHROME_BIN = resolveChromeBin();
}

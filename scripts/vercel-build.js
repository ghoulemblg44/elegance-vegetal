'use strict';

/**
 * Copy the static site into /public for Vercel:
 *   frontend/*  -> public/*
 *   admin/*     -> public/admin/*
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
};

const wipe = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

wipe(publicDir);
copyDir(path.join(root, 'frontend'), publicDir);
copyDir(path.join(root, 'admin'), path.join(publicDir, 'admin'));

console.log('Vercel static build ready → public/ (frontend + /admin)');

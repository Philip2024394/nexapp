// src/app/nex-native/settings/profile/edit/_social-icons.tsx
//
// Inline SVG social icons for the profile edit page.
// Owner directive 2026-11-04 · "plain icons no image but high quality".
// Simple, mono-color (currentColor) glyphs so they inherit the row's
// text colour and stay crisp at any size.

import type { ReactElement } from "react";

type IconProps = { readonly size?: number };

export function InstagramIcon({ size = 20 }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ size = 20 }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.321 5.562a5.124 5.124 0 0 1-3.045-1.028 5.123 5.123 0 0 1-2.044-3.534h-3.138v13.65a2.78 2.78 0 1 1-2.78-2.78c.267 0 .524.04.766.112V8.773a5.927 5.927 0 0 0-.766-.05 5.918 5.918 0 1 0 5.918 5.918V8.3a8.254 8.254 0 0 0 5.089 1.736V6.898a5.11 5.11 0 0 1 0-1.336z" />
    </svg>
  );
}

export function FacebookIcon({ size = 20 }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

export function XIcon({ size = 20 }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function YouTubeIcon({ size = 20 }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M23.498 6.186a2.994 2.994 0 0 0-2.108-2.12C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.39.566A2.994 2.994 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.994 2.994 0 0 0 2.108 2.12C4.48 20.5 12 20.5 12 20.5s7.52 0 9.39-.566a2.994 2.994 0 0 0 2.108-2.12C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z" />
    </svg>
  );
}

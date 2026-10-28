// src/lib/nex-native/nex-keyboard/index.ts
//
// Owner-authorised 2026-10-24 · Phase 0 · public surface for the
// shared NEX keyboard primitives. App code imports from this barrel ·
// internal helpers stay module-scoped.

export { NexInput, type NexInputProps } from "./nex-input";
export { NexTextarea, type NexTextareaProps } from "./nex-textarea";
export {
  isNexKeypadSupported,
  setNexKeypadPreference,
  NEX_KEYPAD_MOBILE_BREAKPOINT_PX,
  NEX_KEYPAD_PREFERENCE_STORAGE_KEY,
  type NexKeypadPreference,
  type IsNexKeypadSupportedOptions,
} from "./is-nex-keypad-supported";

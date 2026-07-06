import { hid_usage_from_page_and_id } from "../hid-usages";

const HID_KEYBOARD_PAGE = 7;
const HID_CONSUMER_PAGE = 12;

const kbd = (id: number) => hid_usage_from_page_and_id(HID_KEYBOARD_PAGE, id);
const consumer = (id: number) =>
  hid_usage_from_page_and_id(HID_CONSUMER_PAGE, id);

// Maps W3C UI Events KeyboardEvent.code values to the HID usage(s) a ZMK
// keyboard would send to produce that code on the host. `.code` identifies the
// physical scancode independent of the host keyboard layout, which is exactly
// what we want for switch testing; `.key` is layout-dependent and would
// mis-attribute keys on remapped host layouts, so there is no `.key` fallback.
// Codes the browser never delivers (or that the OS swallows, like most
// consumer-page media keys) simply can't be tested from the host side.
//
// Some codes can be produced by more than one usage (e.g. volume keys exist on
// both the keyboard and consumer pages), hence the array values.
//
// Sources: W3C UIEvents-code spec cross-checked against USB HID Usage Tables
// 1.5 chapter 10 (keyboard page 0x07) and chapter 15 (consumer page 0x0C).
export const KEY_EVENT_CODE_TO_HID_USAGES: Record<string, number[]> = {
  // Alphabetic
  KeyA: [kbd(0x04)],
  KeyB: [kbd(0x05)],
  KeyC: [kbd(0x06)],
  KeyD: [kbd(0x07)],
  KeyE: [kbd(0x08)],
  KeyF: [kbd(0x09)],
  KeyG: [kbd(0x0a)],
  KeyH: [kbd(0x0b)],
  KeyI: [kbd(0x0c)],
  KeyJ: [kbd(0x0d)],
  KeyK: [kbd(0x0e)],
  KeyL: [kbd(0x0f)],
  KeyM: [kbd(0x10)],
  KeyN: [kbd(0x11)],
  KeyO: [kbd(0x12)],
  KeyP: [kbd(0x13)],
  KeyQ: [kbd(0x14)],
  KeyR: [kbd(0x15)],
  KeyS: [kbd(0x16)],
  KeyT: [kbd(0x17)],
  KeyU: [kbd(0x18)],
  KeyV: [kbd(0x19)],
  KeyW: [kbd(0x1a)],
  KeyX: [kbd(0x1b)],
  KeyY: [kbd(0x1c)],
  KeyZ: [kbd(0x1d)],

  // Number row
  Digit1: [kbd(0x1e)],
  Digit2: [kbd(0x1f)],
  Digit3: [kbd(0x20)],
  Digit4: [kbd(0x21)],
  Digit5: [kbd(0x22)],
  Digit6: [kbd(0x23)],
  Digit7: [kbd(0x24)],
  Digit8: [kbd(0x25)],
  Digit9: [kbd(0x26)],
  Digit0: [kbd(0x27)],

  // Control & whitespace
  Enter: [kbd(0x28)],
  Escape: [kbd(0x29)],
  Backspace: [kbd(0x2a)],
  Tab: [kbd(0x2b)],
  Space: [kbd(0x2c)],

  // Punctuation
  Minus: [kbd(0x2d)],
  Equal: [kbd(0x2e)],
  BracketLeft: [kbd(0x2f)],
  BracketRight: [kbd(0x30)],
  // 0x31 (Backslash) and 0x32 (Non-US #) both surface as code "Backslash"
  Backslash: [kbd(0x31), kbd(0x32)],
  Semicolon: [kbd(0x33)],
  Quote: [kbd(0x34)],
  Backquote: [kbd(0x35)],
  Comma: [kbd(0x36)],
  Period: [kbd(0x37)],
  Slash: [kbd(0x38)],
  CapsLock: [kbd(0x39)],

  // Function row
  F1: [kbd(0x3a)],
  F2: [kbd(0x3b)],
  F3: [kbd(0x3c)],
  F4: [kbd(0x3d)],
  F5: [kbd(0x3e)],
  F6: [kbd(0x3f)],
  F7: [kbd(0x40)],
  F8: [kbd(0x41)],
  F9: [kbd(0x42)],
  F10: [kbd(0x43)],
  F11: [kbd(0x44)],
  F12: [kbd(0x45)],

  // Navigation / editing
  PrintScreen: [kbd(0x46)],
  ScrollLock: [kbd(0x47)],
  Pause: [kbd(0x48)],
  Insert: [kbd(0x49)],
  Home: [kbd(0x4a)],
  PageUp: [kbd(0x4b)],
  Delete: [kbd(0x4c)],
  End: [kbd(0x4d)],
  PageDown: [kbd(0x4e)],
  ArrowRight: [kbd(0x4f)],
  ArrowLeft: [kbd(0x50)],
  ArrowDown: [kbd(0x51)],
  ArrowUp: [kbd(0x52)],

  // Numpad
  NumLock: [kbd(0x53)],
  NumpadDivide: [kbd(0x54)],
  NumpadMultiply: [kbd(0x55)],
  NumpadSubtract: [kbd(0x56)],
  NumpadAdd: [kbd(0x57)],
  NumpadEnter: [kbd(0x58)],
  Numpad1: [kbd(0x59)],
  Numpad2: [kbd(0x5a)],
  Numpad3: [kbd(0x5b)],
  Numpad4: [kbd(0x5c)],
  Numpad5: [kbd(0x5d)],
  Numpad6: [kbd(0x5e)],
  Numpad7: [kbd(0x5f)],
  Numpad8: [kbd(0x60)],
  Numpad9: [kbd(0x61)],
  Numpad0: [kbd(0x62)],
  NumpadDecimal: [kbd(0x63)],
  NumpadEqual: [kbd(0x67)],
  NumpadComma: [kbd(0x85)],

  // International & misc
  IntlBackslash: [kbd(0x64)],
  ContextMenu: [kbd(0x65)],
  Power: [kbd(0x66)],
  F13: [kbd(0x68)],
  F14: [kbd(0x69)],
  F15: [kbd(0x6a)],
  F16: [kbd(0x6b)],
  F17: [kbd(0x6c)],
  F18: [kbd(0x6d)],
  F19: [kbd(0x6e)],
  F20: [kbd(0x6f)],
  F21: [kbd(0x70)],
  F22: [kbd(0x71)],
  F23: [kbd(0x72)],
  F24: [kbd(0x73)],
  Open: [kbd(0x74)],
  Help: [kbd(0x75)],
  Select: [kbd(0x77)],
  Again: [kbd(0x79)],
  Undo: [kbd(0x7a)],
  Cut: [kbd(0x7b)],
  Copy: [kbd(0x7c)],
  Paste: [kbd(0x7d)],
  Find: [kbd(0x7e)],
  IntlRo: [kbd(0x87)],
  KanaMode: [kbd(0x88)],
  IntlYen: [kbd(0x89)],
  Convert: [kbd(0x8a)],
  NonConvert: [kbd(0x8b)],
  Lang1: [kbd(0x90)],
  Lang2: [kbd(0x91)],
  Lang3: [kbd(0x92)],
  Lang4: [kbd(0x93)],

  // Modifiers (left/right distinguished by the physical code)
  ControlLeft: [kbd(0xe0)],
  ShiftLeft: [kbd(0xe1)],
  AltLeft: [kbd(0xe2)],
  MetaLeft: [kbd(0xe3)],
  ControlRight: [kbd(0xe4)],
  ShiftRight: [kbd(0xe5)],
  AltRight: [kbd(0xe6)],
  MetaRight: [kbd(0xe7)],

  // Media / consumer page — best effort: browsers only deliver a subset of
  // these, and the OS frequently swallows them before the page sees anything.
  // Volume keys also exist on the keyboard page, so both usages are listed.
  AudioVolumeMute: [consumer(0xe2), kbd(0x7f)],
  AudioVolumeUp: [consumer(0xe9), kbd(0x80)],
  AudioVolumeDown: [consumer(0xea), kbd(0x81)],
  MediaPlayPause: [consumer(0xcd)],
  MediaStop: [consumer(0xb7)],
  MediaTrackNext: [consumer(0xb5)],
  MediaTrackPrevious: [consumer(0xb6)],
  Eject: [consumer(0xb8)],
  BrowserSearch: [consumer(0x221)],
  BrowserHome: [consumer(0x223)],
  BrowserBack: [consumer(0x224)],
  BrowserForward: [consumer(0x225)],
  BrowserStop: [consumer(0x226)],
  BrowserRefresh: [consumer(0x227)],
  BrowserFavorites: [consumer(0x22a)],
  LaunchMail: [consumer(0x18a)],
  MediaSelect: [consumer(0x183)],
  LaunchApp2: [consumer(0x192)],
  LaunchApp1: [consumer(0x194)],
};

// Every usage some browser key event can be attributed to. Keymap bindings
// whose usages are outside this set can never light up from host key events.
export const HOST_DETECTABLE_USAGES: Set<number> = new Set(
  Object.values(KEY_EVENT_CODE_TO_HID_USAGES).flat()
);

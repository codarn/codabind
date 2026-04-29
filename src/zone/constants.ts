export const UINT16_MAX = 65_535;
export const UINT32_MAX = 4_294_967_295;

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TXT_CHARSTRING_BYTES = 255;

export const COLUMN_WIDTHS = {
  name: 24,
  ttl: 8,
  class: 4,
  type: 8,
} as const;

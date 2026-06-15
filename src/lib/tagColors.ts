// タグの色パレット定義。タグ名ごとに色を割り当てる（全画面で共通の見た目）。
import type { CSSProperties } from 'react';

export interface TagColor {
  key: string;
  label: string;
  bg: string;
  text: string;
}

/**
 * タグ用カラーパレット（12色）。
 * パステル背景＋濃色文字で、ライト/ダークどちらの背景でも読みやすい配色。
 */
export const TAG_PALETTE: TagColor[] = [
  { key: 'red', label: 'レッド', bg: '#f5dcdc', text: '#af0000' },
  { key: 'orange', label: 'オレンジ', bg: '#ffe6cf', text: '#8f4500' },
  { key: 'yellow', label: 'イエロー', bg: '#f7f8c6', text: '#c49600' },
  { key: 'lime', label: 'ライム', bg: '#d7f1cd', text: '#2c7402' },
  { key: 'green', label: 'グリーン', bg: 'rgb(200, 255, 217)', text: '#006817' },
  { key: 'emerald', label: 'エメラルド', bg: '#c2ffeb', text: '#0b6e4d' },
  { key: 'teal', label: 'ティール', bg: '#c0f0f7', text: '#11677c' },
  { key: 'blue', label: 'ブルー', bg: '#cce8ff', text: '#0659b8' },
  { key: 'indigo', label: 'インディゴ', bg: '#dcdeff', text: '#403dca' },
  { key: 'purple', label: 'パープル', bg: '#f3deff', text: '#8f32c5' },
  { key: 'magenta', label: 'マゼンタ', bg: '#ffdafc', text: '#ca3cbe' },
  { key: 'pink', label: 'ピンク', bg: '#ffdbe9', text: '#be1858' },
];

const BY_KEY: Record<string, TagColor> = Object.fromEntries(
  TAG_PALETTE.map((c) => [c.key, c]),
);

/** 新規タグのデフォルト色。 */
export const DEFAULT_TAG_COLOR = 'blue';

/**
 * 色キーからチップ用のインラインスタイルを返す。
 * 未指定・不明キーの場合は空（CSS の .chip 既定色にフォールバック）。
 */
export function getTagColorStyle(key?: string): CSSProperties {
  if (!key) return {};
  const color = BY_KEY[key];
  if (!color) return {};
  return { background: color.bg, color: color.text };
}

/**
 * 色スウォッチ（色見本）用の背景色。
 * bg を text 方向へ少し寄せた、やや濃い同系色（見分けやすさ向上）。
 */
export function getSwatchBackground(color: TagColor): string {
  return `color-mix(in srgb, ${color.bg} 70%, ${color.text})`;
}

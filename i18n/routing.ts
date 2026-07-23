export const locales = ['ko', 'en', 'ja', 'zh', 'hi', 'es', 'fr', 'ar', 'id', 'vi', 'pt'] as const;
// 실제 서비스에서는 15개 언어를 이 배열에 모두 추가하면 됩니다.
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

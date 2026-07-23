export type CategoryId = 'food' | 'culture';

export const CATEGORIES: {
  id: CategoryId;
  live: boolean;
  name: Record<string, string>;
  topArticles: Record<string, string[]>;
}[] = [
  {
    id: 'food',
    live: true,
    name: { ko: '한국 음식', en: 'Korean Food', ja: '韓国料理', zh: '韩国料理', hi: 'कोरियाई भोजन' },
    topArticles: {
      ko: ['김치, 발효가 만든 한식의 뿌리', '비빔밥, 그릇 안의 균형', '불고기, 달고 짠맛의 균형'],
      en: ['Kimchi: The Fermented Root of Korean Food', 'Bibimbap: Balance in a Single Bowl', 'Bulgogi: Sweet Meets Savory'],
      ja: ['キムチ — 発酵が生んだ韓国料理の根', 'ビビンバ — 器の中のバランス', 'プルコギ — 甘辛のバランス'],
      zh: ['泡菜——发酵造就的韩食之根', '拌饭——碗中的平衡', '烤肉——甜咸的平衡'],
      hi: ['किमची: कोरियाई भोजन की किण्वित जड़', 'बिबिम्बाप: एक कटोरी में संतुलन', 'बुलगोगी: मीठे और नमकीन का संतुलन'],
    },
  },
  {
    id: 'culture',
    live: false,
    name: { ko: '전통문화', en: 'Traditional Culture', ja: '伝統文化', zh: '传统文化', hi: 'पारंपरिक संस्कृति' },
    topArticles: { ko: [], en: [], ja: [], zh: [], hi: [] },
  },
];

const fs = require('fs');
const path = require('path');
const deepl = require('deepl-node');

const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });

const translator = new deepl.Translator(env.DEEPL_API_KEY);

const KO_DESC =
  '떡볶이 포장마차에서 피어오르는 매콤한 김, 천 년의 세월을 견뎌온 첨성대의 고요한 그림자, 해 질 무렵 한강을 물들이는 노을까지 — 한국은 스쳐 지나가듯 보면 모르고 지나칠 이야기들로 가득한 나라입니다. 할머니의 손맛이 담긴 김치 한 조각에는 대를 이어온 시간이, 좁은 골목 한옥의 기와 아래에는 오래전 사람들의 숨결이 남아 있습니다. 저희는 이 작은 이야기들을 모으고 당신의 언어로 옮겨, 사진 몇 장이 아니라 살아 있는 한국을 보여드리고 싶습니다. 이 페이지를 넘기고 나면, 어느새 다음 여행지는 한국이 되어 있을 거예요.';

const LANGS = [
  { file: 'en', deepl: 'en-US' },
  { file: 'ja', deepl: 'ja' },
  { file: 'zh', deepl: 'zh' },
  { file: 'hi', deepl: 'hi' },
  { file: 'es', deepl: 'es' },
  { file: 'fr', deepl: 'fr' },
  { file: 'ar', deepl: 'ar' },
  { file: 'id', deepl: 'id' },
  { file: 'vi', deepl: 'vi' },
  { file: 'pt', deepl: 'pt-BR' },
];

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.log(`  재시도 ${i + 1}/${attempts}: ${err.message}`);
      await wait(1000 * 2 ** i);
    }
  }
  throw lastErr;
}

function updateDesc(locale, desc) {
  const file = path.join(__dirname, '..', 'messages', `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.home.desc = desc;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`  ${locale} 저장 완료`);
}

async function main() {
  updateDesc('ko', KO_DESC);

  for (const { file, deepl: deeplCode } of LANGS) {
    console.log(`=== ${file} ===`);
    const result = await withRetry(() => translator.translateText(KO_DESC, 'ko', deeplCode));
    updateDesc(file, result.text);
    await wait(300);
  }

  console.log('\n모두 완료');
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});

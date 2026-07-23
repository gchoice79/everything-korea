# Everything Korea

## 로컬 실행 방법

1. Node.js 18 이상 설치 확인
2. `.env.local.example`을 복사해 `.env.local` 파일을 만들고, Supabase 프로젝트의 URL/anon key를 채워넣기:
   ```
   NEXT_PUBLIC_SUPABASE_URL=본인 프로젝트 URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=본인 anon public key
   ```
3. 이 폴더에서:
   ```
   npm install
   npm run dev
   ```
4. http://localhost:3000 접속

## 진행 상황
- ✅ Next.js 프로젝트 뼈대
- ✅ 다국어 라우팅 (next-intl, 브라우저 언어 자동 감지)
- ✅ 홈페이지 카테고리 카드 + 인기글 3개 (Supabase 실 데이터 연동)
- ⬜ 카테고리 목차 페이지, 글 상세 페이지
- ⬜ 관리자 페이지 (/admin)
- ⬜ AI 파이프라인

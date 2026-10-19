# 모아 — 용돈 기록장

용돈 수입과 지출을 기록하고 월별 합계와 소비 흐름을 확인하는 반응형 웹 앱입니다. React와 Vite로 만들었으며, Supabase Auth와 Postgres를 연결하면 계정별 기록이 저장됩니다. Supabase 환경 변수가 없으면 로컬 미리보기 모드로 동작합니다.

## 로컬 실행

1. Node.js를 설치하고 이 폴더에서 `npm install`을 실행합니다.
2. `.env.example`을 복사해 `.env.local`을 만들고 Supabase 프로젝트 URL과 publishable key(또는 anon key)를 입력합니다.
3. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
4. `npm run dev`를 실행하고 터미널에 표시된 주소를 엽니다.

환경 변수 이름은 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`입니다. 브라우저 앱에는 Supabase publishable/anon key만 사용하세요. `service_role` 또는 secret key를 `VITE_` 환경 변수에 넣으면 안 됩니다. 데이터 접근은 로그인 사용자별 RLS 정책으로 제한됩니다.

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel에서 저장소를 새 프로젝트로 가져옵니다. Framework Preset은 Vite, Build Command는 `npm run build`, Output Directory는 `dist`를 사용합니다.
3. Project Settings → Environment Variables에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 Preview와 Production 환경에 설정하고 재배포합니다.
4. Supabase Authentication → URL Configuration의 Site URL을 배포 도메인으로 지정합니다. 회원가입 이메일 확인을 사용하는 경우 Redirect URLs에도 해당 도메인을 추가합니다.

Supabase 프로젝트 생성과 SQL 실행은 한 번 필요합니다. 현재는 계정별 거래내역 조회, 추가, 삭제가 구현되어 있습니다.

# 모아 — 가입 없이 쓰는 용돈 기록장

접속하면 곧바로 수입·지출과 월 예산을 기록하는 한국어 웹 앱입니다. React + Vite, Supabase Auth/Postgres를 사용하며 기존 Vercel `test-c`에 배포됩니다.

**앱:** https://test-c-eight.vercel.app

## 사용 방식

- 회원가입·로그인·비밀번호 입력 화면이 없습니다.
- 기존 Supabase 세션이 있으면 그대로 재사용해 기존 기록을 유지합니다.
- 처음 접속하면 익명 세션을 자동으로 만들고, 브라우저가 해당 세션을 보관합니다.
- 같은 브라우저에서 새로고침하거나 다시 열면 같은 기록이 이어집니다.
- 서로 다른 브라우저·기기의 기록은 분리됩니다. 브라우저 데이터를 지우거나 익명 세션을 잃으면 해당 기록에 다시 접근할 수 없습니다.
- 실제 내역·예산·반복 설정은 Supabase에 저장되며, `auth.uid() = user_id`인 소유자만 조회·수정할 수 있습니다.

## 기능

- 날짜·금액·카테고리·메모를 포함한 수입·지출 추가·수정·삭제
- 월별 수입·지출·전체 잔액, 날짜 구간별 지출 그래프, 항목별 통계
- 월별 예산, 남은 예산과 초과 금액
- 매달 반복되는 수입·지출 등록과 반복 종료
- 모바일 화면, 검색과 필터

반복 내역은 접속·새로고침·화면 복귀 시 한국 시간으로 오늘까지 도래한 항목을 생성합니다. 29~31일이 없는 달에는 말일에 반영합니다. 고유 제약으로 중복을 막고, 소프트 삭제한 내역은 다시 생성하지 않습니다. 반복을 종료해도 기존 내역은 유지합니다.

## 개발·배포

```sh
npm ci
cp .env.example .env.local
# Supabase URL과 publishable key 설정
npm run dev
```

환경 변수는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`입니다. 후자의 이름은 기존 앱과 호환을 위해 유지하며 값으로 publishable key를 사용할 수 있습니다. service_role/secret key는 클라이언트 환경 변수에 넣지 않습니다.

Supabase Authentication → Sign In / Providers에서 **Allow anonymous sign-ins**를 켜야 합니다. 현재 연결된 프로젝트에는 적용했습니다. 이메일 확인이나 기존 사용자 설정은 변경하지 않았습니다. 별도의 이메일 발송 설정 없이 동작합니다.

새 DB는 `schema.sql`, 기존 모아 transactions 테이블만 있는 DB는 `supabase/upgrade.sql`을 한 번 실행합니다. 현재 DB에는 이미 적용되어 있으므로 다시 실행하지 않습니다. 세 테이블의 RLS와 SECURITY INVOKER 반복 RPC는 그대로 유지합니다. 익명 사용자는 authenticated 역할을 사용하므로 익명 접근 관련 advisory가 표시되며, 이는 자신의 행에만 접근하는 이 앱의 의도된 동작입니다. https://supabase.com/docs/guides/auth/auth-anonymous#access-control

Vercel: Framework Vite / Install `npm ci` / Build `npm run build` / Output `dist`. GitHub main에 반영하면 기존 test-c 프로젝트가 자동 배포합니다. 팀 ID를 명시한 조회에서 오류가 발생한 경우 확인된 소유 계정의 기본 범위에서 프로젝트를 조회하면 정상 작동했습니다.

환경 변수가 없는 로컬 실행은 기존 브라우저 저장 모드로 자동 시작하며, Supabase 연결 오류를 브라우저 저장으로 조용히 대체하지 않습니다. 기존 체험 공간의 로컬 데이터는 지우거나 다른 사용자에게 합치지 않습니다.

## 검증

`npm run check`로 날짜·월말·통계·반복·금액 계산과 자동 세션의 재사용·동시 접속·재시도·탭 간 잠금 테스트를 실행합니다. 실제 Supabase 익명 사용자 2개로 기록·예산 저장, 반복 RPC 호출, 다른 사용자 데이터 차단을 검증했습니다. `tests/rls.sql`은 별도의 임시 사용자 트랜잭션으로 DB 소유자 격리를 검증하고 롤백합니다.

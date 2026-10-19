# 모아 — 용돈 기록장

여러 사용자가 가입해 각자 수입·지출과 월 예산을 관리하는 한국어 웹 앱입니다. React + Vite, Supabase Auth/Postgres를 사용하며 Vercel에서 배포할 수 있습니다.

## 구현된 기능

- 이메일·비밀번호 회원가입/로그인, 비밀번호 재설정
- 날짜·금액·카테고리·메모를 포함한 수입·지출 추가, 수정, 삭제
- 월별 수입·지출, 전체 잔액, 날짜 구간별 지출 그래프, 항목별 지출 통계
- 월별 예산, 남은 예산과 초과 금액
- 월 1회 반복되는 수입·지출 등록과 반복 종료
- 모바일 화면, 내역 검색, 수입·지출 및 카테고리 필터
- 계정 데이터와 분리된 브라우저 체험 공간

반복 내역은 로그인·새로고침·화면 복귀 시, 한국 시간으로 오늘까지 도래한 항목을 소급 생성합니다. 닫혀 있는 앱에서 백그라운드로 실행되는 작업은 없습니다. 29~31일이 없는 달에는 말일에 반영합니다. 데이터베이스 고유 제약으로 동시 접속과 재실행 시 중복을 막습니다. 삭제한 기록은 소프트 삭제해 자동 재생성을 막고, 반복 종료 시 이미 기록된 내역은 유지합니다.

## 로컬 실행

```sh
npm ci
cp .env.example .env.local
# .env.local의 Supabase URL과 publishable key를 설정
npm run dev
```

필요한 환경 변수는 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`입니다. 후자의 이름은 기존 앱과 호환을 위해 유지했으며, 값에는 `sb_publishable_`로 시작하는 publishable key를 권장합니다. 브라우저에 노출되는 설정이므로 service_role/secret key를 사용하지 마세요. `.env.local`은 Git에서 제외됩니다.

## 데이터베이스 설치

- 새 프로젝트: SQL Editor에서 루트 `schema.sql`을 한 번 실행합니다.
- 기존 모아의 transactions 테이블만 있는 프로젝트: `supabase/upgrade.sql`만 한 번 실행합니다.
- 현재 연결한 Supabase 프로젝트에는 업그레이드가 이미 적용됐습니다. 같은 업그레이드를 다시 실행하지 마세요.

세 테이블 모두 RLS가 활성화되어 있고 `auth.uid() = user_id`로 계정별 읽기·쓰기를 제한합니다. 클라이언트에는 SELECT/INSERT/UPDATE만 허용하고 TRUNCATE와 영구 DELETE 권한을 주지 않습니다. 반복 RPC는 SECURITY INVOKER로 실행됩니다.

## Vercel 배포

1. 이 GitHub 저장소를 Vercel에 Import 합니다.
2. Framework: Vite / Install: `npm ci` / Build: `npm run build` / Output: `dist`.
3. Vercel Environment Variables에 위 두 변수를 Production·Preview·Development에 설정하고 배포합니다.
4. Supabase Authentication → URL Configuration에서 Site URL과 Redirect URLs에 실제 배포 URL을 등록합니다. 배포 URL은 아직 확정되지 않았습니다.
5. 회원가입 확인과 비밀번호 재설정 메일을 일반 사용자에게 보내려면 Supabase의 custom SMTP 설정을 확인합니다. 기본 메일 발송 서비스는 팀 구성원 주소로 제한됩니다. https://supabase.com/docs/guides/auth/auth-smtp

이 작업에서는 Vercel의 기존 test-c 조회가 404/403, 새 프로젝트 생성이 403으로 거절돼 Vercel 배포를 완료하지 못했습니다. GitHub와 Supabase 작업은 별도로 진행됐으며, Vercel 배포 성공으로 간주하지 않습니다.

## 검증

```sh
npm run check
```

날짜 경계, 윤년·월말, 월별 통계, 반복 중복 방지, 삭제 항목 유지, 금액 검증을 테스트합니다. `tests/rls.sql`은 실제 Supabase에서 별도 트랜잭션과 임시 사용자로 소유자 격리·반복 생성·쓰기 권한을 검증하며 마지막에 전부 롤백합니다. 현재 DB에서 통과했습니다.

프로덕션 빌드는 통과했습니다. Vercel 연결이 차단되어 실제 배포 환경의 브라우저 동작과 가입 이메일 전달은 미검증입니다. Supabase 보안 점검에서 유출 비밀번호 보호가 비활성화된 점이 확인됐습니다. 설정 설명: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

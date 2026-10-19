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
4. Supabase Authentication → URL Configuration에서 Site URL과 Redirect URLs에 실제 배포 URL을 등록합니다. 검증된 배포 주소는 `https://test-c-eight.vercel.app`입니다. 이 도메인의 인증 리디렉션 허용 설정은 별도로 확인하세요.
5. 회원가입 확인과 비밀번호 재설정 메일을 일반 사용자에게 보내려면 Supabase의 custom SMTP 설정을 확인합니다. 기본 메일 발송 서비스는 팀 구성원 주소로 제한됩니다. https://supabase.com/docs/guides/auth/auth-smtp

현재 기존 Vercel `test-c` 프로젝트에 GitHub main 브랜치가 연결되어 자동 배포됩니다. 프로덕션 주소: https://test-c-eight.vercel.app . 구현 커밋 `babf24b`의 READY 상태, 공개 주소의 HTTP 200, 브라우저 로그인 화면과 콘솔 오류 없음을 확인했습니다. 팀 ID를 명시한 API 요청은 403/404가 발생했지만, 동일한 소유 계정과 프로젝트임을 확인한 뒤 기본 계정 범위로 조회하면 정상 작동했습니다. 이 오류를 실제 배포 실패로 안내했던 이전 기록을 정정합니다.

## 검증

```sh
npm run check
```

날짜 경계, 윤년·월말, 월별 통계, 반복 중복 방지, 삭제 항목 유지, 금액 검증을 테스트합니다. `tests/rls.sql`은 실제 Supabase에서 별도 트랜잭션과 임시 사용자로 소유자 격리·반복 생성·쓰기 권한을 검증하며 마지막에 전부 롤백합니다. 현재 DB에서 통과했습니다.

프로덕션 빌드는 통과했습니다. 배포 환경에서 로그인 화면 표시, JS 파일 로드, Supabase URL과 예산·반복 내역 코드 포함, 브라우저 콘솔 오류 없음을 확인했습니다. 실제 회원가입 이메일 전달과 로그인 후 전체 사용자 흐름은 미검증입니다. Supabase 보안 점검에서 유출 비밀번호 보호가 비활성화된 점이 확인됐습니다. 설정 설명: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

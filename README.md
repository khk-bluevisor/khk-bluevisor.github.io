# Static Web Sample README

## 1) 프로젝트 개요
이 디렉터리는 App Link / Universal Link / Deferred Deep Link 기술검증을 위한 정적 웹 소스입니다.

핵심 목표는 다음과 같습니다.

1. 엔트리 페이지에서 테스트 파라미터(`text`, `number`)를 손쉽게 선택
2. iOS Universal Link 전환 특성을 고려해, 엔트리와 링크 대상 페이지를 도메인 분리
3. iOS 사용자에 대해서만 웹 수집 데이터셋을 Firestore에 저장
4. Android 사용자에 대해서는 Play Store 리디렉션 + Install Referrer 전달

---

## 2) 호스팅/도메인 전략

### 엔트리 페이지
- `https://khk-bluevisor.github.io/app-ddl-test/`
- GitHub Pages에서 제공

### 링크 대상 페이지 (앱 링크/유니버셜 링크 대상)
- `https://khk-bluevisor-github-io.vercel.app/app-ddl-test/link/{red|green|blue}/`
- Vercel에서 제공

### 도메인 분리 이유
iOS Safari는 같은 도메인 내 네비게이션에서 Universal Link 앱 전환 대신 웹 전환을 유지하는 경우가 있습니다.
이 프로젝트는 이를 피하기 위해 아래 흐름을 사용합니다.

1. 사용자가 GitHub Pages 엔트리 페이지 접속
2. `RED/GREEN/BLUE` 링크 클릭
3. 절대 URL로 Vercel 도메인의 `/app-ddl-test/link/*` 페이지 이동
4. OS/브라우저별 정책에 따라 앱 전환 또는 리디렉션/표시 처리

---

## 3) 디렉터리 구조

```text
app-ddl-link-static-page__samples/
├─ .well-known/
│  ├─ apple-app-site-association
│  └─ assetlinks.json
├─ _headers
├─ _config.yml
├─ index.html
├─ install-referrer-sample/
│  └─ index.html
└─ app-ddl-test/
   ├─ index.html
   └─ link/
      ├─ red/index.html
      ├─ green/index.html
      ├─ blue/index.html
      └─ common/web-to-ios-firestore.js
```

### 주요 파일 설명
- `app-ddl-test/index.html`
  - 테스트 엔트리 페이지
  - `number` 선택 드롭다운 + 큰 숫자 미리보기
  - HTTPS 링크/Intent 링크/설치 QR 링크 생성
  - 웹-앱 교집합 데이터셋 수집 및 화면 표시(JSON 포함)
- `app-ddl-test/link/red|green|blue/index.html`
  - 색상별 링크 처리 페이지
  - 플랫폼 분기(iOS/Android/기타) 실행
  - iOS일 때만 사용자 유추 데이터셋 수집 및 Firestore 저장
  - iOS일 때 사람이 읽기 쉬운 데이터 UI + 대형 `text/number` 패널 표시
- `app-ddl-test/link/common/web-to-ios-firestore.js`
  - Firebase Web SDK 초기화
  - iOS/Android 플랫폼 판별
  - 파라미터 정규화/수집 신호 생성/Firestore 저장
  - 화면 표시용 사람 친화형 데이터 변환
- `.well-known/apple-app-site-association`
  - iOS Universal Link 허용 경로 선언 (`/app-ddl-test/link/*`)
- `.well-known/assetlinks.json`
  - Android App Link 검증용 패키지/서명 지문 선언
- `_headers`
  - 헤더 설정 예시 파일(호스팅 플랫폼 설정에 맞게 반영 필요)
- `install-referrer-sample/index.html`
  - Play Store `referrer` 테스트 링크 생성 도구

---

## 4) `/app-ddl-test/` 엔트리 페이지 기능

### 4.1 링크 파라미터 제어
- `number` 선택(1~10)
- 선택 즉시 아래 요소 갱신
  - HTTPS 링크
  - Intent 링크
  - Play 설치 링크(QR 포함)
  - 표시 파라미터 문자열

### 4.2 가시성 보강 UI
- 드롭다운은 작게 유지
- 별도 대형 미리보기 영역(`선택된 number`)에 현재 숫자 표시

### 4.3 교집합 데이터셋 표시
- iOS 앱과 비교 가능한 항목 중심으로 브라우저 데이터 수집
- 요약 테이블 + 원본 JSON 표시
- 수집 재시도/JSON 복사 제공

---

## 5) `/app-ddl-test/link/*` 페이지 동작 정책

플랫폼별 동작은 다음과 같습니다.

| 플랫폼 | 자동 리디렉션 | 사용자 유추 데이터 수집/전송 | 화면 표시 |
|---|---|---|---|
| iOS 브라우저 | 하지 않음 | 수행함(Firestore 저장) | 사람 친화형 항목 + 대형 패널 표시 |
| Android 브라우저 | Play Store로 즉시 리디렉션 | 수행하지 않음 | 리디렉션 안내 문구만 표시 |
| 기타 브라우저 | 하지 않음 | 수행하지 않음 | 비대상 안내 문구만 표시 |

중요: **iOS 이외 플랫폼에서는 Firestore 저장을 수행하지 않습니다.**

---

## 6) Firestore 저장 구조 (웹 측)

### 컬렉션
- `web-to-ios`

### 문서 생성 시점
- iOS 사용자가 `app-ddl-test/link/red|green|blue` 페이지 접근 시

### 주요 필드
- `eventType`: `ios_web_to_app_match_candidate`
- `createdAtClientIso`
- `createdAtServer` (serverTimestamp)
- `sourcePage`
  - `href`, `host`, `path`, `linkColor`
- `businessParams`
  - `text`, `number`, `referrerRaw`, `queryParams`
- `matchSignals`
  - `publicIp`
  - `comparableSignals`
  - `comparableSignalHash`

### 참고
- Firestore 설정은 `web-to-ios-firestore.js`에 Firebase Web SDK(v10.14.1)로 구성되어 있습니다.

---

## 7) 사용자 유추용 수집 신호(웹)

대표 항목:

- 공인 IP/Geo: `ip`, `country`, `region`, `city`, `timezone`, `asn`, `organization`
- 로케일/언어: `timezone`, `utcOffsetMinutes`, `locale`, `language`, `languages`
- 디바이스/화면: `platform`, `maxTouchPoints`, `hardwareConcurrency`, `deviceMemoryGb`
- 화면 정보: `screenWidth`, `screenHeight`, `viewportWidth`, `viewportHeight`, `devicePixelRatio`
- 네트워크: `online`, `connection.type`, `connection.effectiveType`, `downlinkMbps`, `rttMs`, `saveData`
- 해시 힌트: `comparableSignalHash` (SHA-256)

주의:
- `comparableSignalHash`는 고유 식별자 보장이 아니라 비교 힌트입니다.

---

## 8) 파라미터/링크 규칙

### 비즈니스 파라미터
- `text`: `red | green | blue`
- `number`: `1..10` (범위 외 값은 보정)

### Android 설치 리퍼러 전달
- `referrerRaw = text={color}&number={n}`
- Play URL 예시:
  - `https://play.google.com/store/apps/details?id=dev.sample.appddlink&referrer=text%3Dred%26number%3D3`

---

## 9) 링크 검증 파일(.well-known)

### iOS
- 파일: `.well-known/apple-app-site-association`
- 허용 경로: `/app-ddl-test/link/*`
- 대상 앱 ID: `DQALHSS7F2.kr.bluevisor.dev.app-ddl-test`

### Android
- 파일: `.well-known/assetlinks.json`
- 패키지: `dev.sample.appddlink`
- SHA-256 서명 지문 복수 등록

---

## 10) 배포 시 체크리스트

1. GitHub Pages에 `app-ddl-link-static-page__samples` 배포
2. Vercel에도 동일 소스 배포
3. `.well-known` 파일이 두 호스팅에서 접근 가능한지 확인
4. AASA(`apple-app-site-association`) 응답의 `Content-Type: application/json` 확인
5. Firebase 프로젝트/Firestore Rules 확인

---

## 11) 테스트 시나리오

### iOS 유니버셜 링크 + 웹 수집
1. `https://khk-bluevisor.github.io/app-ddl-test/` 접속
2. 색상 링크 클릭 → Vercel `/link/*` 이동
3. iOS 페이지에서 Firestore 저장 성공/docId 확인
4. 저장된 데이터셋과 표시 항목 확인

### Android 앱링크/리퍼러
1. 동일 엔트리 페이지에서 링크 클릭
2. Android 브라우저에서 Play Store 자동 이동 확인
3. 설치 후 앱에서 Install Referrer 값 확인

### 기타 브라우저
1. `/app-ddl-test/link/*` 직접 접속
2. 자동 리디렉션 없음 확인
3. Firestore 저장이 수행되지 않음을 확인

---

## 12) 운영 시 주의사항

1. Firestore를 웹에서 직접 호출하므로 Rules/쿼터/악성 요청 방어를 반드시 설계해야 합니다.
2. IP Geo API(`ipify`, `ipapi`) 실패 시 일부 필드가 비어 있을 수 있습니다.
3. 플랫폼 판별은 UA 기반이므로 100% 완벽 판별을 보장하지 않습니다.
4. 개인정보/법적 요구사항(수집 고지, 보관 정책, 접근 통제)은 운영 환경에서 별도 준수해야 합니다.

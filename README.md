# Static Web Sample README

## 1) 프로젝트 개요
이 프로젝트는 App Link / Universal Link / Deferred Deep Link 기술검증을 위한 정적 웹 샘플입니다.

주요 목적은 다음과 같습니다.
1. 테스트용 비즈니스 파라미터(`text`, `number`)를 웹에서 쉽게 생성
2. iOS Universal Link 전환 특성을 고려해 엔트리 페이지와 링크 대상 페이지를 도메인 분리
3. iOS 브라우저 방문 시 웹 수집 데이터셋을 Firestore에 저장
4. Android 브라우저 방문 시 Play Store 설치 페이지로 리디렉션하면서 Install Referrer 전달

## 2) 호스팅/도메인 전략
엔트리 페이지와 링크 페이지를 다음처럼 분리해 운영합니다.

1. 엔트리: `https://khk-bluevisor.github.io/app-ddl-test/`
2. 링크 대상: `https://khk-bluevisor-github-io.vercel.app/app-ddl-test/link/{red|green|blue}/`

도메인 분리 이유:
- iOS Safari는 같은 도메인 내 이동에서 Universal Link 대신 웹 전환을 유지하는 경우가 있습니다.
- 이를 피하기 위해 엔트리(GitHub Pages)에서 링크 대상(Vercel)으로 절대 URL 이동 방식을 사용합니다.

## 3) 디렉터리 구조
```text
app-ddl-link-static-page__samples/
├─ .well-known/
│  ├─ apple-app-site-association
│  └─ assetlinks.json
├─ _headers
├─ vercel.json
├─ app-ddl-test/
│  ├─ index.html
│  └─ link/
│     ├─ red/index.html
│     ├─ green/index.html
│     ├─ blue/index.html
│     └─ common/web-to-ios-firestore.js
└─ install-referrer-sample/
   └─ index.html
```

## 4) 페이지별 역할
1. `app-ddl-test/index.html`
- 테스트 엔트리 페이지
- `text`, `number` 기반 링크 생성
- 선택된 number를 큰 숫자로 별도 표시
- 브라우저 수집 데이터(개발자 확인용) 표시

2. `app-ddl-test/link/red|green|blue/index.html`
- 색상별 링크 처리 페이지
- 플랫폼별 동작 분기
- iOS 방문 시에만 Firestore 저장 실행
- iOS 방문 시 사람이 읽기 쉬운 데이터 항목 및 대형 `text/number` 패널 표시

3. `app-ddl-test/link/common/web-to-ios-firestore.js`
- Firebase Web SDK 초기화
- 플랫폼 판별(iOS/Android)
- 비즈니스 파라미터 정규화
- 사용자 유추용 신호 수집
- Firestore 저장 및 화면 표시용 데이터 변환

## 5) 플랫폼별 동작 정책 (`/app-ddl-test/link/*`)
1. iOS 브라우저
- 자동 리디렉션 없음
- 사용자 유추 데이터셋 수집 및 Firestore 저장 수행
- 저장 결과 + 데이터 항목 + 시각 패널 표시

2. Android 브라우저
- Play Store로 즉시 리디렉션
- Firestore 저장 수행하지 않음

3. 기타 브라우저
- 자동 리디렉션 없음
- Firestore 저장 수행하지 않음

## 6) Firestore 저장 구조 (웹)
컬렉션:
- `web-to-ios`

문서 생성 시점:
- iOS 브라우저로 `/app-ddl-test/link/{red|green|blue}` 진입 시

주요 필드:
1. `eventType` = `ios_web_to_app_match_candidate`
2. `createdAtClientIso`
3. `createdAtServer` (serverTimestamp)
4. `sourcePage`
- `href`, `host`, `path`, `linkColor`
5. `businessParams`
- `text`, `number`, `referrerRaw`, `queryParams`
6. `matchSignals`
- `publicIp`
- `comparableSignals`

## 7) 현재 웹 수집 신호 (사람이 읽기 쉬운 명칭 포함)
### 7.1 `matchSignals.publicIp` 필드 사전
| 키 경로 | 사람이 읽기 쉬운 명칭 | 의미 |
|---|---|---|
| `matchSignals.publicIp.ip` | 공인 IP 주소 | 외부에서 보이는 현재 공인 IP |
| `matchSignals.publicIp.country` | 접속 국가 | IP Geo 기준 국가명 |
| `matchSignals.publicIp.region` | 접속 지역 | IP Geo 기준 지역/주/도 |
| `matchSignals.publicIp.city` | 접속 도시 | IP Geo 기준 도시/구 |
| `matchSignals.publicIp.timezone` | IP 기반 시간대 | IP Geo 기준 시간대 문자열 |
| `matchSignals.publicIp.asn` | ASN 번호 | 통신망 자율시스템 번호 |
| `matchSignals.publicIp.organization` | 통신사/조직 | IP 대역 운영 조직명 |
| `matchSignals.publicIp.sources` | IP 조회 출처 목록 | IP/Geo 조회에 사용된 외부 API 목록 |
| `matchSignals.publicIp.errors` | IP 조회 오류 목록 | IP/Geo 조회 실패 메시지 목록 |

### 7.2 `matchSignals.comparableSignals` 필드 사전
| 키 경로 | 사람이 읽기 쉬운 명칭 | 의미 |
|---|---|---|
| `matchSignals.comparableSignals.timezone` | 브라우저 시간대 | 브라우저가 보고한 시간대(`Asia/Seoul` 등) |
| `matchSignals.comparableSignals.calendar` | 달력 체계 | 브라우저 locale 옵션의 달력 체계(`gregory` 등) |
| `matchSignals.comparableSignals.numberingSystem` | 숫자 표기 체계 | locale 숫자 표기 시스템(`latn` 등) |
| `matchSignals.comparableSignals.utcOffsetMinutes` | UTC 오프셋(분) | 브라우저 기준 로컬 시간의 UTC 분 오프셋 |
| `matchSignals.comparableSignals.language` | 기본 언어 | 브라우저 기본 언어 코드 |
| `matchSignals.comparableSignals.languages` | 선호 언어 목록 | 브라우저 우선순위 언어 배열 |
| `matchSignals.comparableSignals.platform` | 플랫폼 문자열 | 브라우저가 보고한 디바이스/플랫폼 식별 문자열 |
| `matchSignals.comparableSignals.maxTouchPoints` | 최대 터치 포인트 | 터치 입력 동시 인식 포인트 수 |
| `matchSignals.comparableSignals.deviceMemoryGb` | 추정 메모리(GB) | 브라우저가 노출하는 장치 메모리 추정치 |
| `matchSignals.comparableSignals.screenWidth` | 화면 너비(px) | 물리 화면 너비 |
| `matchSignals.comparableSignals.screenHeight` | 화면 높이(px) | 물리 화면 높이 |
| `matchSignals.comparableSignals.viewportWidth` | 뷰포트 너비(px) | 현재 웹페이지 렌더링 영역 너비 |
| `matchSignals.comparableSignals.devicePixelRatio` | DPR(화면 배율) | CSS 픽셀 대비 디바이스 픽셀 비율 |
| `matchSignals.comparableSignals.colorDepth` | 색 깊이(bit) | 화면 색상 깊이 |
| `matchSignals.comparableSignals.connection.type` | 네트워크 인터페이스 유형 | wifi/cellular 등 연결 유형 |
| `matchSignals.comparableSignals.connection.effectiveType` | 체감 네트워크 품질 | 2g/3g/4g 계열 품질 힌트 |
| `matchSignals.comparableSignals.connection.downlinkMbps` | 예상 다운로드 속도 | 브라우저가 노출하는 대역폭 추정치 |
| `matchSignals.comparableSignals.connection.rttMs` | 예상 RTT(ms) | 브라우저가 노출하는 지연시간 추정치 |
| `matchSignals.comparableSignals.connection.saveData` | 데이터 절약 모드 | 사용자 데이터 절약 설정 여부 |

참고:
- 브라우저별 지원 차이로 일부 필드는 `null`일 수 있습니다.
- 값이 있어도 브라우저/OS 정책에 따라 정확도가 낮을 수 있습니다.

### 제거된 항목
현재 링크 페이지 저장 신호에서는 아래 항목을 사용하지 않습니다.
- `locale`
- `hardwareConcurrency`
- `viewportHeight`
- `online`
- `comparableSignalHash`

## 8) 링크/파라미터 규칙
비즈니스 파라미터:
1. `text`: `red | green | blue`
2. `number`: `1..10` (범위 벗어나면 보정)

Android Install Referrer 전달 포맷:
- `text={color}&number={n}`

예시:
- `https://play.google.com/store/apps/details?id=dev.sample.appddlink&referrer=text%3Dblue%26number%3D9`

## 9) `.well-known` 및 헤더 구성
1. `/.well-known/apple-app-site-association`
- iOS Universal Link 허용 경로: `/app-ddl-test/link/*`

2. `/.well-known/assetlinks.json`
- Android App Link 검증용 패키지/서명 지문 선언

3. `vercel.json`
- `/.well-known/apple-app-site-association` 응답의 `Content-Type: application/json` 강제
- 캐시 헤더 지정

4. `_headers`
- 기존 호스팅(Netlify) 대응용 파일로 유지

## 10) 테스트 시나리오
1. iOS
- GitHub Pages 엔트리 접속
- 색상 링크 클릭 → Vercel `/link/*` 이동
- Firestore 저장 성공(docId) 및 화면 데이터 확인

2. Android
- 동일 링크 클릭
- Play Store 리디렉션 및 referrer 전달 확인
- 설치 후 앱에서 Install Referrer 파라미터 확인

3. 기타 브라우저
- `/link/*` 직접 접속
- 리디렉션/저장 미수행 정책 확인

## 11) 운영 시 주의사항
1. 웹에서 Firestore에 직접 쓰므로 Rules/쿼터/오남용 방어 정책이 필요합니다.
2. IP API(`api64.ipify.org`, `ipapi.co`) 실패 시 일부 필드는 비어 있을 수 있습니다.
3. UA 기반 플랫폼 판별은 완전하지 않으므로 운영 정책에서 보완이 필요합니다.
4. 실제 서비스 적용 시 개인정보 고지/보관/접근통제를 별도로 설계해야 합니다.

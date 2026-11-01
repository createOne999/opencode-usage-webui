# OpenCode 사용량 대시보드

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

브라우저에서 토큰 사용량, 모델별 비용, 도구 실행 성능, 요청별 세션 컨텍스트를 한눈에 살펴볼 수 있는 **OpenCode V2**용 로컬 웹 대시보드 플러그인입니다.

OpenCode Mini 또는 전체 TUI에서 언제든 **`/usage-dashboard`** 명령을 실행해 대시보드를 열 수 있습니다. 별도의 데이터베이스나 상시 실행 데몬 없이 OpenCode 플러그인 프로세스 안에서 가볍게 동작합니다.

## 주요 기능

- **개요 (`/stats`):** 전체 토큰, 기록된 USD 비용, 세션 수, 모델 Steps, 날짜별 활동량, 토큰 구성 비율 및 일별 토큰 추이를 확인합니다.
- **모델 (`/models`):** 공급자·모델·variant별 토큰 사용량과 비용 그래프 및 표를 제공하며, 토큰·비용·Steps·이름순 정렬을 지원합니다.
- **도구 (`/tools`):** 도구별 호출 횟수, 성공·실패·미완료 상태 비율, 실행시간 중앙값(`P50`)을 비교합니다.
- **세션 / 요청 (`/sessions`):** 세션 제목 검색, 상·하위 세션 탐색, 요청별 토큰·비용 타임라인 확인, 선택한 Step 시점의 저장 이력과 응답 조회를 지원합니다.

## 빠른 시작

`opencode.json`에 플러그인을 추가합니다:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

이후 OpenCode에서 **`/usage-dashboard`**를 실행하면 기본 브라우저에서 대시보드가 열립니다. 브라우저에서 직접 <http://127.0.0.1:7331/stats>(또는 `http://localhost:7331/stats`, `http://[::1]:7331/stats`)로 접속할 수도 있습니다.

### 포트 변경하기

기본 포트는 `7331`입니다. 여러 프로젝트에서 동시에 실행하거나 다른 포트를 사용하고 싶다면 `options.port`를 지정하세요(`0`으로 설정하면 사용 가능한 포트를 자동으로 선택합니다):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## 대시보드 활용 팁

- **기간 및 프로젝트 필터:** 기본값은 브라우저 시간대 기준 ‘이번 달’과 ‘현재 프로젝트’입니다(종료일 포함). 언제든 **전체 프로젝트**나 다른 프로젝트를 선택해 조회할 수 있습니다.
- **다국어 지원 및 링크 공유:** 상단 언어 선택기에서 원하는 언어로 전환할 수 있습니다. 선택한 언어(`?lang=...`), 기간, 프로젝트 필터, 선택한 요청 위치가 URL에 그대로 유지되므로 북마크나 새로고침 시에도 동일한 화면을 이어서 볼 수 있습니다.
- **일별 토큰 상세 조회:** 개요 화면에서 **일별 토큰 불러오기**를 누르면 선택한 기간의 날짜별 입력·출력·추론·캐시 읽기/쓰기 토큰 추이를 그래프와 표로 확인할 수 있습니다.
- **요청 시점의 컨텍스트 살펴보기:**
  1. **세션 / 요청** 메뉴에서 세션을 선택합니다(관련 서브에이전트 세션은 **하위 세션** 배지나 상세 목록에서 바로 이동할 수 있습니다).
  2. 요청 타임라인 그래프의 점이나 표의 요청 시각을 클릭합니다.
  3. **요청 직전 저장 이력**(사용자 메시지, 이전 응답, 도구 결과, 스킬, 압축 요약)과 **선택한 요청의 응답**을 나란히 확인합니다.
  4. 긴 세션에서는 **이전 이력 100개 더 보기**를 눌러 앞선 대화 기록을 추가로 불러올 수 있습니다.

### 지표 참고 사항

- **토큰 단위:** 화면에는 읽기 쉽도록 `K`·`M`·`B`·`T` 단위(소수점 최대 두 자리)로 축약 표시하며, 정렬과 합산에는 원본 수치를 사용합니다. 전체 토큰은 `입력 + 출력 + 추론 + 캐시 읽기 + 캐시 쓰기`의 합계입니다.
- **비용 표시:** 공급자 보고 금액 및 모델 카탈로그 단가를 바탕으로 계산된 USD 참고치를 표시합니다.
- **저장 이력 기반 컨텍스트:** 요청 상세 화면은 세션에 저장된 메시지 이력과 완료된 컨텍스트 압축(compaction) 경계를 기준으로 해당 Step 직전의 맥락을 보기 쉽게 재구성해 보여줍니다.

## 로컬 실행 및 개인정보 보호

- **로컬 루프백 전용:** `127.0.0.1` 및 `::1` 루프백 주소에만 바인딩하고 동일 출처 요청만 허용하여 내 PC 안에서만 안전하게 접근할 수 있습니다.
- **외부 전송 및 별도 저장 없음:** 실행 중인 로컬 OpenCode V2 공유 서비스에서 읽기 전용 API로 필요한 데이터만 조회합니다. 외부 CDN, 텔레메트리, 별도 DB 저장을 사용하지 않으며, 플러그인을 제거하려면 `opencode.json`에서 항목만 지우면 됩니다.

## 소스에서 실행 및 개발

OpenCode **2.2.0**, Bun **1.4.2** 환경을 기준으로 작성되었습니다. 저장소 루트에서 다음 명령으로 실행할 수 있습니다:

```powershell
bun run setup
opencode mini
# OpenCode 안에서: /usage-dashboard
```

원격 서버, WSL, 헤드리스 환경 등 브라우저를 자동으로 열기 어려운 환경에서는 터미널에서 접속 주소와 준비 상태를 바로 확인할 수 있습니다:

```powershell
bun run status
```

### 빌드 및 테스트

```powershell
bun run build
bun run typecheck
bun run test
```

## 라이선스

MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.

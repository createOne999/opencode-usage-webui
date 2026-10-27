# OpenCode 사용량 게시판

OpenCode V2 서버 플러그인이 **같은 프로세스에서** 제공하는 React + Bun 웹 UI입니다. 별도 DB, 수집기, 상시 실행 데몬 없이 공개 API만 읽습니다.

- **사용량 게시판:** <http://127.0.0.1:7331/stats> — `session.stats()`

## 실행

OpenCode **2.2.0**, Bun **1.4.2** 환경을 기준으로 구현했습니다. 저장소 루트에서:

```powershell
bun install --cwd usage-dashboard
bun run --cwd usage-dashboard build
opencode mini
```

루트 `opencode.json`이 `./usage-dashboard` 디렉터리를 플러그인으로 불러옵니다. 전역 설정은 변경하지 않습니다. 설정은 자동 반영되므로 이미 실행 중인 OpenCode에서는 서비스 재시작이 필요하지 않습니다. 반영되지 않으면 `/reload`를 사용하거나 프로젝트 루트에서 Mini를 다시 실행하세요.

프런트엔드 수정 후 `build`를 다시 실행하면 다음 브라우저 새로고침부터 적용됩니다. 플러그인 서버 코드 수정 후에는 `/reload`로 플러그인을 다시 불러오세요. 플러그인 해제·재로딩 시 리스너를 닫습니다.

7331 포트가 이미 사용 중이면 플러그인 옵션만 변경합니다:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "./usage-dashboard", "options": { "port": 7332 } }
  ]
}
```

## 사용량

- 기간·프로젝트 필터: 기본값은 이번 달, 현재 프로젝트입니다. 선택한 종료일을 포함하며 브라우저의 시간대를 사용합니다.
- 세션·하위 세션·프롬프트·모델 Steps·활동일·최장 연속 활동일.
- 공급자·모델·variant별 입력·출력·추론·캐시 읽기/쓰기·전체 토큰·USD 비용. 토큰·비용·Steps·이름순 정렬.
- 도구별 호출·성공·실패·미완료 횟수 및 실행시간 P50(ms), 날짜별 Steps.
- 전체 토큰은 다섯 토큰 분류의 합입니다. 입력은 비캐시 입력, 출력은 추론을 제외한 가시 출력입니다.
- 비용은 공급자 보고액과 카탈로그 추정액이 섞일 수 있으며 API에 출처 구분이 없습니다. 단가 미등록으로 0이 될 수도 있어 실제 청구액 또는 무료 사용으로 단정하지 않습니다.
- 현재 API에서 compaction은 전체 합계에만 포함되므로 모델별 행 합계와 다를 수 있습니다. Title 사용량은 제외됩니다. Steps는 HTTP 요청 수가 아닙니다.

## 연결·보안·제약

- 공식 `Service.discover()`로 **이미 실행 중인 로컬 공유 서비스**를 찾습니다. 서비스를 시작·중지·교체하지 않습니다. `--standalone` 및 원격 `--server` 연결은 이 버전의 대상이 아닙니다.
- 브라우저는 Bun의 제한된 조회 API에만 접근합니다. OpenCode 인증 헤더·비밀번호는 서버 메모리에만 있고 브라우저에 전달하거나 파일에 저장하지 않습니다.
- `127.0.0.1`에만 바인딩하고 Host/Origin/Fetch Metadata 및 커스텀 요청 헤더를 검증합니다. CORS를 열지 않으며 모든 쓰기 요청을 거부합니다. 로컬 OS 사용자 간 격리나 외부 공개 서비스용 로그인 기능은 제공하지 않습니다.
- React/CSS는 로컬 빌드 결과로 제공하며 CDN·외부 폰트·텔레메트리를 사용하지 않습니다. 대화 본문이나 공급자 응답을 수집하지 않습니다.
- 사용량 API는 experimental입니다. DB를 직접 읽거나 OpenCode 내부 구현을 import하지 않습니다.
- 한 프로젝트에서 한 인스턴스를 사용하는 최소 구성입니다. 다른 프로젝트에서도 동시에 플러그인을 활성화하려면 포트를 다르게 지정하세요.
- 자동 폴링 대신 조회/새로고침 시에만 API를 호출합니다. 데이터가 없거나 연결에 실패하면 화면에서 안내합니다.
- 제거하려면 루트 `opencode.json`에서 이 플러그인 항목을 지우세요. 이 플러그인이 저장한 사용량 데이터는 없습니다.

## 디자인

- Tailwind CSS v4와 shadcn/ui(Radix 기반), Lucide React를 사용한 단일 다크 화면입니다. 사이드바 없이 필터·요약 카드·모델/도구 표에 집중합니다.
- `web/components/ui/`는 shadcn/ui 소스입니다. `components.json`으로 필요한 컴포넌트만 추가하며, 날짜와 프로젝트 선택은 네이티브 입력 동작을 유지합니다.
- `build.ts`가 Bun의 Tailwind 플러그인으로 HTML·JS·CSS를 빌드합니다. CSS는 별도 로컬 파일로 제공하여 기존 CSP를 유지합니다.
- 전환은 짧은 CSS 효과만 사용하며 `prefers-reduced-motion`을 존중합니다. Motion·React Aria·reactbits·차트 라이브러리는 추가하지 않습니다.

## 검증

```powershell
bun run --cwd usage-dashboard build
bun run --cwd usage-dashboard typecheck
bun run --cwd usage-dashboard test
```

테스트는 가상 API 응답을 사용하며 실제 계정이나 세션을 수정하지 않습니다. API 필터·보안 경계·오류 처리·리스너 정리, 토큰 합산·페이지 렌더링을 검증합니다. 한도 기능은 제거했으며 `/limits`와 `/api/limits`는 404를 반환합니다.

디자인 변경은 Chromium에서 390/768/1440px, 날짜·프로젝트 필터, 비용 정렬, 새로고침, 표의 키보드 가로 스크롤, 동작 줄이기를 확인했습니다. 별도 가상 API 서버와 브라우저 응답 대체로 로딩·빈 기록·조회/프로젝트 오류의 재시도 복구·긴 모델명을 검증했으며 CSP 위반은 없었습니다.

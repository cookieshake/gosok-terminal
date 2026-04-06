# Testing Strategy Design

gosok-terminal 시나리오 기반 테스트 전략.

## 원칙

- spec/scenarios의 43개 시나리오가 테스트의 원본
- UI로 검증 가능하면 Playwright, 아니면 Go 통합 테스트
- Playwright가 Go 백엔드를 관통 검증 (UI 클릭 → API → DB → 응답 → UI 확인)
- Then 절의 UI 상태 확인 = 백엔드 정상 동작의 간접 검증

## 구조

```
tests/
  integration/              # Go 통합 테스트 (CLI + UI 없는 시나리오)
    helpers_test.go         # DSL 헬퍼 (TestEnv, HTTP, CLI, WS)
    projects_test.go        # SC.CLI.1 프로젝트 관리
    tabs_test.go            # SC.CLI.2 탭 관리, SC.TAB.6 환경변수 주입
    messaging_test.go       # SC.CLI.3 탭 간 통신, SC.MSG.4 wait, SC.MSG.5 cleanup
    settings_test.go        # SC.CLI.4 설정
    api_test.go             # SC.API.1~3 응답 포맷, CORS, health
    websocket_test.go       # SC.WS.3 keepalive

  e2e/                      # Playwright E2E (Web UI 시나리오)
    helpers/
      test-env.ts           # 서버 기동, API 클라이언트
    projects.spec.ts        # SC.PROJ.1~2
    tabs.spec.ts            # SC.TAB.1~5, SC.TAB.7
    terminal.spec.ts        # SC.TERM.1~4
    websocket.spec.ts       # SC.WS.1~2, SC.WS.4~6
    messaging.spec.ts       # SC.MSG.1~3
    notifications.spec.ts   # SC.NOTIF.1
    settings.spec.ts        # SC.SET.1~2
    filesystem.spec.ts      # SC.FS.1~4
    spa-routing.spec.ts     # SC.API.4
    playwright.config.ts
```

## 시나리오 매핑

### Playwright (Web UI 시나리오, ~30개)

| 시나리오 | 테스트 파일 | Go 코드 경로 |
|----------|------------|-------------|
| SC.PROJ.1 프로젝트 CRUD [Web UI] | projects.spec.ts | api/projects.go → store |
| SC.PROJ.2 프로젝트 리오더 [Web UI] | projects.spec.ts | api/projects.go → store.ReorderProjects |
| SC.TAB.1 탭 CRUD [Web UI] | tabs.spec.ts | api/tabs.go → store |
| SC.TAB.2 탭 라이프사이클 [Web UI] | tabs.spec.ts | api/tabs.go → tab/service.go → pty/ |
| SC.TAB.3 탭 리오더 [Web UI] | tabs.spec.ts | api/tabs.go → store.ReorderTabs |
| SC.TAB.4 탭 Write [Web UI] | tabs.spec.ts | ws/handler.go → pty stdin |
| SC.TAB.5 탭 Screen [Web UI] | tabs.spec.ts | xterm.js 버퍼 확인 |
| SC.TAB.7 동적 타이틀 [Web UI] | tabs.spec.ts | ws/handler.go → OSC title → UI |
| SC.TERM.1 세션 라이프사이클 | terminal.spec.ts | tab/service.go → pty/manager.go |
| SC.TERM.2 스크롤백/리플레이 | terminal.spec.ts | pty/ringbuffer.go |
| SC.TERM.3 출력 복구/멀티뷰어 | terminal.spec.ts | pty/session.go → subscriber |
| SC.TERM.4 터미널 리사이즈 | terminal.spec.ts | ws/handler.go → pty.Setsize |
| SC.WS.1 터미널 연결 | websocket.spec.ts | ws/handler.go |
| SC.WS.2 터미널 이벤트 | websocket.spec.ts | ws/handler.go → exit event |
| SC.WS.4 재연결 스크롤백 | websocket.spec.ts | pty/ringbuffer.go → BytesSince |
| SC.WS.5 실시간 이벤트 | websocket.spec.ts | events/hub.go |
| SC.WS.6 데모 터미널 | websocket.spec.ts | ws/demo.go |
| SC.MSG.1 메시지 전송 | messaging.spec.ts | api/messages.go → store → events/hub |
| SC.MSG.2 Inbox/Feed 조회 | messaging.spec.ts | api/messages.go → store.GetInbox/GetFeed |
| SC.MSG.3 읽음 표시 | messaging.spec.ts | api/messages.go → store.UpdateReadMarker |
| SC.NOTIF.1 알림 전송 | notifications.spec.ts | api/notifications.go → events/hub |
| SC.SET.1 Settings CRUD [Web UI] | settings.spec.ts | api/settings.go → store |
| SC.SET.2 기본값 [Web UI] | settings.spec.ts | store → DefaultSettings |
| SC.FS.1 디렉터리 탐색 | filesystem.spec.ts | api/files.go → os.ReadDir |
| SC.FS.2 파일 목록 | filesystem.spec.ts | api/files.go → os.ReadDir |
| SC.FS.3 파일 읽기/쓰기 | filesystem.spec.ts | api/files.go → os.ReadFile/WriteFile |
| SC.FS.4 Git Changes | filesystem.spec.ts | api/diff.go → exec git |
| SC.API.4 SPA 라우팅 | spa-routing.spec.ts | server/server.go → frontend FS |

### Go 통합 테스트 (~10개)

| 시나리오 | 테스트 파일 | 이유 |
|----------|------------|------|
| SC.CLI.1 프로젝트 관리 | projects_test.go | CLI 바이너리 테스트 |
| SC.CLI.2 탭 관리 | tabs_test.go | CLI 바이너리 테스트 |
| SC.CLI.3 탭 간 통신 | messaging_test.go | CLI 바이너리 테스트 |
| SC.CLI.4 알림/설정 | settings_test.go | CLI 바이너리 테스트 |
| SC.TAB.6 환경변수 주입 | tabs_test.go | 셸 내부 $GOSOK_* 변수 검증 |
| SC.MSG.4 메시지 대기 | messaging_test.go | gosok wait (blocking CLI) |
| SC.MSG.5 메시지 정리 | messaging_test.go | 서버 내부 cron |
| SC.API.1 응답 포맷 | api_test.go | HTTP 응답 구조 검증 |
| SC.API.2 CORS | api_test.go | HTTP 헤더 검증 |
| SC.API.3 Health Check | api_test.go | HTTP 엔드포인트 |
| SC.WS.3 Keepalive | websocket_test.go | WebSocket 프로토콜 타이밍 |

## Go DSL 헬퍼

3개의 핵심 동사: `HTTP`, `CLI`, `WS`.

### TestEnv

```go
env := NewTestEnv(t)
// 임시 SQLite DB + httptest.Server + 자동 cleanup
// TestMain에서 gosok 바이너리 한 번 빌드, CLI 테스트에서 재사용

env.BaseURL()   // "http://127.0.0.1:xxxxx"
```

### HTTP — REST API 호출

```go
res := env.HTTP("GET", "/api/v1/projects")
res := env.HTTP("POST", "/api/v1/projects", `{"name":"test","path":"/tmp"}`)
res := env.HTTP("PUT", "/api/v1/projects/"+id, `{"name":"renamed"}`)
res := env.HTTP("DELETE", "/api/v1/projects/"+id)

res.Status     // HTTP 상태 코드
res.ID         // 생성된 리소스 id (shortcut)
res.Get("name") // JSON 필드 접근
res.Array()    // JSON 배열 응답
res.Raw()      // *http.Response 원본
```

### CLI — gosok 바이너리 실행

```go
out := env.CLI("gosok ps")
out := env.CLI("gosok send %s hello", tabBID)
out := env.CLI("gosok setting get font_size")

out.Stdout     // 표준 출력
out.Stderr     // 표준 에러
out.ExitCode   // 종료 코드
out.JSON()     // stdout JSON 파싱
```

내부적으로 `exec.Command`로 실제 바이너리 실행. `GOSOK_API_URL` 환경변수로 테스트 서버 주소 주입.

### WS — WebSocket 연결

```go
term := env.WS("/api/ws/sessions/%s/terminal", sessionID)
term.Send([]byte("echo hello\n"))
term.SendJSON(map[string]any{"type": "resize", "cols": 120, "rows": 40})
term.Read(5 * time.Second)
term.WaitFor("hello", 5*time.Second)
term.WaitForClose(5 * time.Second)
term.Close()
```

### 에러 테스트

```go
// 헬퍼 내부에서 require로 실패 처리 (error 반환 없음)
// 실패를 기대하는 테스트는 상태 코드 직접 확인
res := env.HTTP("DELETE", "/api/v1/projects/nonexistent")
assert.Equal(t, 404, res.Status)

out := env.CLI("gosok send")
assert.NotEqual(t, 0, out.ExitCode)
```

### 시나리오 예시

```go
func TestSC_CLI_3_SendDirectMessage(t *testing.T) {
    env := NewTestEnv(t)

    // Given
    project := env.HTTP("POST", "/api/v1/projects", `{"name":"test","path":"/tmp"}`)
    tabA := env.HTTP("POST", "/api/v1/projects/"+project.ID+"/tabs", `{"name":"tab-a"}`)
    tabB := env.HTTP("POST", "/api/v1/projects/"+project.ID+"/tabs", `{"name":"tab-b"}`)

    // When
    env.CLI("gosok send %s hello", tabB.ID)

    // Then
    inbox := env.HTTP("GET", "/api/v1/messages/inbox/"+tabB.ID)
    require.Len(t, inbox.Array(), 1)
    assert.Equal(t, "hello", inbox.Array()[0].Get("body"))
}
```

## Playwright DSL 헬퍼

3개의 핵심 동사: `api`, `ui`, `ui.terminal`.

### setupTestEnv

```typescript
const env = await setupTestEnv(page);
// playwright.config.ts의 webServer로 gosok 서버 자동 기동
// 각 테스트마다 깨끗한 DB
```

### api — 테스트 데이터 셋업 (Given 절)

```typescript
const project = await api.post("/api/v1/projects", { name: "test", path: "/tmp" });
const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a" });
await api.post(`/api/v1/tabs/${tab.id}/start`);
```

Given을 전부 UI로 하면 느리고 깨지기 쉬우므로, 셋업은 `api`로, 검증은 `ui`로.

### ui — 브라우저 조작 (When/Then 절)

```typescript
await ui.click("새 프로젝트 버튼");
await ui.fill("프로젝트 이름", "my-project");
await ui.see("my-project");
await ui.notSee("deleted-project");
await ui.seeIn(".sidebar", "my-project");
await ui.waitForText("hello");
```

내부적으로 `data-testid`와 텍스트 기반 셀렉터를 조합.

### ui.terminal — xterm.js 전용

```typescript
await ui.terminal.waitForText("$", 10000);
await ui.terminal.type("echo hello\n");
await ui.terminal.resize(120, 40);
```

xterm.js 캔버스 안의 텍스트는 DOM에 없으므로 별도 처리.

### 시나리오 예시

```typescript
test("SC.PROJ.1 - 프로젝트 생성 [Web UI]", async ({ page }) => {
    const env = await setupTestEnv(page);

    // When
    await ui.click("새 프로젝트 버튼");
    await ui.fill("프로젝트 이름", "my-project");
    await ui.fill("경로", "/tmp/test");
    await ui.click("생성");

    // Then: Go api/projects.go → store.CreateProject 관통 검증
    await ui.see("my-project");
});

test("SC.TAB.2 - 탭 시작 [Web UI]", async ({ page }) => {
    const env = await setupTestEnv(page);

    // Given (API로 빠르게 셋업)
    const project = await api.post("/api/v1/projects", { name: "test", path: "/tmp" });
    await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "shell-tab" });
    await page.reload();

    // When
    await ui.click("shell-tab");
    await ui.click("시작");

    // Then: Go tab/service.go → pty/manager.go 관통 검증
    await ui.terminal.waitForText("$", 10000);
});
```

## 실행

```makefile
test-e2e:
    make build
    cd tests/e2e && npx playwright test

test-integration:
    go test ./tests/integration/...

test-all: test-integration test-e2e
```

Playwright는 `playwright.config.ts`의 webServer 설정으로 gosok 바이너리를 자동 기동/종료:

```typescript
export default defineConfig({
    webServer: {
        command: "../../bin/gosok",
        port: 18435,
        env: { GOSOK_DB_PATH: "/tmp/gosok-test.db" },
        reuseExistingServer: false,
    },
});
```

Go 통합 테스트는 `TestMain`에서 gosok 바이너리 한 번 빌드, CLI 테스트에서 재사용.

## 의존성 추가

### Go
- `github.com/stretchr/testify` — assert/require

### TypeScript (tests/e2e/)
- `@playwright/test` — E2E 테스트 프레임워크

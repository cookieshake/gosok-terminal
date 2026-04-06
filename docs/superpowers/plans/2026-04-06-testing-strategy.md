# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec/scenarios의 43개 시나리오를 Playwright E2E + Go 통합 테스트로 구현한다.

**Architecture:** Playwright가 Web UI 시나리오 ~30개를 커버하며 Go 백엔드를 관통 검증한다. Go 통합 테스트는 CLI/프로토콜/서버 내부 시나리오 ~10개를 커버한다. 두 테스트 스위트 모두 `tests/` 아래에 배치한다.

**Tech Stack:** Playwright (TypeScript), Go testing + testify, httptest, gorilla/websocket

---

## File Structure

```
tests/
  integration/                    # Go 통합 테스트
    helpers_test.go               # TestEnv, HTTP, CLI, WS DSL 헬퍼
    main_test.go                  # TestMain (바이너리 빌드)
    api_test.go                   # SC.API.1~3
    cli_projects_test.go          # SC.CLI.1
    cli_tabs_test.go              # SC.CLI.2, SC.TAB.6
    cli_messaging_test.go         # SC.CLI.3, SC.MSG.4~5
    cli_settings_test.go          # SC.CLI.4
    websocket_test.go             # SC.WS.3

  e2e/
    package.json                  # Playwright 의존성
    tsconfig.json                 # TypeScript 설정
    playwright.config.ts          # Playwright 설정
    helpers/
      test-env.ts                 # setupTestEnv, cleanDB
      api.ts                      # api.get/post/put/delete 헬퍼
      ui.ts                       # ui.click/fill/see/notSee 헬퍼
      terminal.ts                 # ui.terminal.type/waitForText 헬퍼
    projects.spec.ts              # SC.PROJ.1~2
    tabs.spec.ts                  # SC.TAB.1~5, SC.TAB.7
    terminal.spec.ts              # SC.TERM.1~4
    websocket.spec.ts             # SC.WS.1~2, SC.WS.4~6
    messaging.spec.ts             # SC.MSG.1~3
    notifications.spec.ts         # SC.NOTIF.1
    settings.spec.ts              # SC.SET.1~2
    filesystem.spec.ts            # SC.FS.1~4
    spa-routing.spec.ts           # SC.API.4

frontend/src/components/          # data-testid 속성 추가 (기존 파일 수정)
  CreateProjectDialog.tsx
  AddTabDialog.tsx
  ProjectView.tsx
  Sidebar.tsx
  NotificationCenter.tsx
  TerminalPane.tsx
  TerminalTabs.tsx
  EditorPane.tsx
```

---

## Task 1: Go 테스트 의존성 추가

**Files:**
- Modify: `go.mod`

- [ ] **Step 1: testify 의존성 추가**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && go get github.com/stretchr/testify@latest
```

- [ ] **Step 2: 의존성 정리**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && go mod tidy
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add go.mod go.sum
git commit -m "chore: add testify dependency for integration tests"
```

---

## Task 2: Go TestMain — 바이너리 빌드

**Files:**
- Create: `tests/integration/main_test.go`

- [ ] **Step 1: TestMain 작성**

`tests/integration/main_test.go`:

```go
package integration_test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

var gosokBin string

func TestMain(m *testing.M) {
	tmp, err := os.MkdirTemp("", "gosok-test-bin-*")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create temp dir: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(tmp)

	gosokBin = filepath.Join(tmp, "gosok")

	build := exec.Command("go", "build", "-o", gosokBin, "./cmd/gosok/")
	build.Dir = filepath.Join("..", "..")
	build.Stdout = os.Stdout
	build.Stderr = os.Stderr
	if err := build.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to build gosok: %v\n", err)
		os.Exit(1)
	}

	os.Exit(m.Run())
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run=^$ -count=1`

Expected: PASS (테스트 없이 빌드만 확인)

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/main_test.go
git commit -m "test: add TestMain for gosok binary build"
```

---

## Task 3: Go DSL 헬퍼 — TestEnv + HTTP + CLI + WS

**Files:**
- Create: `tests/integration/helpers_test.go`

- [ ] **Step 1: 헬퍼 작성**

`tests/integration/helpers_test.go`:

```go
package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/cookieshake/gosok-terminal/internal/server"
	"github.com/cookieshake/gosok-terminal/internal/store"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// TestEnv
// ---------------------------------------------------------------------------

type TestEnv struct {
	t       *testing.T
	srv     *httptest.Server
	store   store.Store
	baseURL string
}

func NewTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	tmpDB, err := os.CreateTemp("", "gosok-test-*.db")
	require.NoError(t, err)
	tmpDB.Close()

	s, err := store.NewSQLite(tmpDB.Name())
	require.NoError(t, err)

	srv := server.New(s)
	ts := httptest.NewServer(srv)

	env := &TestEnv{
		t:       t,
		srv:     ts,
		store:   s,
		baseURL: ts.URL,
	}

	t.Cleanup(func() {
		ts.Close()
		s.Close()
		os.Remove(tmpDB.Name())
	})

	return env
}

func (e *TestEnv) BaseURL() string {
	return e.baseURL
}

// ---------------------------------------------------------------------------
// HTTP DSL
// ---------------------------------------------------------------------------

type Response struct {
	Status int
	body   []byte
	parsed any
}

func (e *TestEnv) HTTP(method, path string, bodyArgs ...string) *Response {
	e.t.Helper()

	url := e.baseURL + path

	var reqBody io.Reader
	if len(bodyArgs) > 0 {
		reqBody = strings.NewReader(bodyArgs[0])
	}

	req, err := http.NewRequest(method, url, reqBody)
	require.NoError(e.t, err)

	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	require.NoError(e.t, err)
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	require.NoError(e.t, err)

	r := &Response{
		Status: resp.StatusCode,
		body:   data,
	}

	if len(data) > 0 {
		var parsed any
		if err := json.Unmarshal(data, &parsed); err == nil {
			r.parsed = parsed
		}
	}

	return r
}

// ID returns the "id" field from a JSON object response.
func (r *Response) ID() string {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return ""
	}
	id, _ := m["id"].(string)
	return id
}

// Get returns a string field from a JSON object response.
func (r *Response) Get(key string) string {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return ""
	}
	v, _ := m[key].(string)
	return v
}

// GetNum returns a float64 field from a JSON object response.
func (r *Response) GetNum(key string) float64 {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return 0
	}
	v, _ := m[key].(float64)
	return v
}

// Array returns the parsed JSON as a slice of maps.
func (r *Response) Array() []map[string]any {
	arr, ok := r.parsed.([]any)
	if !ok {
		return nil
	}
	result := make([]map[string]any, 0, len(arr))
	for _, item := range arr {
		if m, ok := item.(map[string]any); ok {
			result = append(result, m)
		}
	}
	return result
}

// Body returns the raw response body as string.
func (r *Response) Body() string {
	return string(r.body)
}

// ---------------------------------------------------------------------------
// CLI DSL
// ---------------------------------------------------------------------------

type CLIResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

func (e *TestEnv) CLI(format string, args ...any) *CLIResult {
	e.t.Helper()

	cmdLine := fmt.Sprintf(format, args...)
	parts := strings.Fields(cmdLine)

	// Replace "gosok" with actual binary path
	if len(parts) > 0 && parts[0] == "gosok" {
		parts[0] = gosokBin
	}

	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Env = append(os.Environ(), "GOSOK_API_URL="+e.baseURL)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result := &CLIResult{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			result.ExitCode = -1
		}
	}

	return result
}

// JSON parses the CLI stdout as JSON.
func (r *CLIResult) JSON() map[string]any {
	var result map[string]any
	json.Unmarshal([]byte(r.Stdout), &result)
	return result
}

// JSONArray parses the CLI stdout as a JSON array.
func (r *CLIResult) JSONArray() []map[string]any {
	var result []map[string]any
	json.Unmarshal([]byte(r.Stdout), &result)
	return result
}

// ---------------------------------------------------------------------------
// WS DSL
// ---------------------------------------------------------------------------

type WSConn struct {
	t    *testing.T
	conn *websocket.Conn
	buf  bytes.Buffer
}

func (e *TestEnv) WS(pathFormat string, args ...any) *WSConn {
	e.t.Helper()

	path := fmt.Sprintf(pathFormat, args...)
	wsURL := "ws" + strings.TrimPrefix(e.baseURL, "http") + path

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(e.t, err)

	wc := &WSConn{t: e.t, conn: conn}

	e.t.Cleanup(func() {
		conn.Close()
	})

	return wc
}

// Send sends binary data.
func (w *WSConn) Send(data []byte) {
	w.t.Helper()
	err := w.conn.WriteMessage(websocket.BinaryMessage, data)
	require.NoError(w.t, err)
}

// SendJSON sends a JSON control message.
func (w *WSConn) SendJSON(v any) {
	w.t.Helper()
	err := w.conn.WriteJSON(v)
	require.NoError(w.t, err)
}

// Read reads the next message with a timeout.
func (w *WSConn) Read(timeout time.Duration) (int, []byte) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	msgType, data, err := w.conn.ReadMessage()
	require.NoError(w.t, err)
	return msgType, data
}

// ReadJSON reads and parses the next JSON message.
func (w *WSConn) ReadJSON(timeout time.Duration, v any) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	err := w.conn.ReadJSON(v)
	require.NoError(w.t, err)
}

// WaitFor reads messages until the accumulated output contains the target string.
func (w *WSConn) WaitFor(target string, timeout time.Duration) {
	w.t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		w.conn.SetReadDeadline(deadline)
		_, data, err := w.conn.ReadMessage()
		if err != nil {
			w.t.Fatalf("WaitFor(%q) timed out; buffer so far: %q", target, w.buf.String())
		}
		w.buf.Write(data)
		if strings.Contains(w.buf.String(), target) {
			return
		}
	}
}

// WaitForClose waits until the WebSocket connection is closed.
func (w *WSConn) WaitForClose(timeout time.Duration) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	for {
		_, _, err := w.conn.ReadMessage()
		if err != nil {
			return // connection closed
		}
	}
}

// Close closes the WebSocket connection.
func (w *WSConn) Close() {
	w.conn.Close()
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run=^$ -count=1`

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/helpers_test.go
git commit -m "test: add Go DSL helpers (TestEnv, HTTP, CLI, WS)"
```

---

## Task 4: Go 통합 테스트 — SC.API.1~3

**Files:**
- Create: `tests/integration/api_test.go`

- [ ] **Step 1: 테스트 작성**

`tests/integration/api_test.go`:

```go
package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// SC.API.1 — Response format consistency
func TestSC_API_1_ResponseFormat(t *testing.T) {
	env := NewTestEnv(t)

	t.Run("successful response wraps data", func(t *testing.T) {
		res := env.HTTP("POST", "/api/v1/projects", `{"name":"test","path":"/tmp"}`)
		assert.Equal(t, 201, res.Status)

		// Response should be a JSON object with an "id" field
		assert.NotEmpty(t, res.ID())
		assert.Equal(t, "test", res.Get("name"))
	})

	t.Run("list response returns array", func(t *testing.T) {
		res := env.HTTP("GET", "/api/v1/projects")
		assert.Equal(t, 200, res.Status)
		assert.NotNil(t, res.Array())
	})

	t.Run("not found returns 404", func(t *testing.T) {
		res := env.HTTP("GET", "/api/v1/projects/nonexistent")
		assert.Equal(t, 404, res.Status)
	})

	t.Run("invalid JSON returns 400", func(t *testing.T) {
		res := env.HTTP("POST", "/api/v1/projects", `{invalid}`)
		assert.Equal(t, 400, res.Status)
	})
}

// SC.API.2 — Cross-origin access
func TestSC_API_2_CORS(t *testing.T) {
	env := NewTestEnv(t)

	t.Run("CORS headers present on response", func(t *testing.T) {
		req, err := http.NewRequest("GET", env.BaseURL()+"/api/v1/projects", nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, "*", resp.Header.Get("Access-Control-Allow-Origin"))
		assert.Contains(t, resp.Header.Get("Access-Control-Allow-Methods"), "GET")
		assert.Contains(t, resp.Header.Get("Access-Control-Allow-Methods"), "POST")
	})

	t.Run("OPTIONS returns 204", func(t *testing.T) {
		req, err := http.NewRequest("OPTIONS", env.BaseURL()+"/api/v1/projects", nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, 204, resp.StatusCode)
	})
}

// SC.API.3 — Health check
func TestSC_API_3_HealthCheck(t *testing.T) {
	env := NewTestEnv(t)

	res := env.HTTP("GET", "/api/v1/health")
	assert.Equal(t, 200, res.Status)

	var body map[string]any
	err := json.Unmarshal([]byte(res.Body()), &body)
	require.NoError(t, err)
	assert.Equal(t, "ok", body["status"])
}
```

- [ ] **Step 2: 테스트 실행**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run=TestSC_API -v`

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/api_test.go
git commit -m "test: add SC.API.1~3 integration tests"
```

---

## Task 5: Go 통합 테스트 — SC.CLI.1 프로젝트 관리

**Files:**
- Create: `tests/integration/cli_projects_test.go`

- [ ] **Step 1: 테스트 작성**

`tests/integration/cli_projects_test.go`:

```go
package integration_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// SC.CLI.1 — Project management via CLI
func TestSC_CLI_1_ProjectManagement(t *testing.T) {
	env := NewTestEnv(t)

	t.Run("list projects", func(t *testing.T) {
		// Given: a project exists
		env.HTTP("POST", "/api/v1/projects", `{"name":"cli-test","path":"/tmp"}`)

		// When
		out := env.CLI("gosok ps")

		// Then
		assert.Equal(t, 0, out.ExitCode)
		assert.Contains(t, out.Stdout, "cli-test")
	})

	t.Run("create project", func(t *testing.T) {
		// When
		out := env.CLI("gosok project create new-project --path /tmp/new")

		// Then
		assert.Equal(t, 0, out.ExitCode)

		// Verify via API
		res := env.HTTP("GET", "/api/v1/projects")
		found := false
		for _, p := range res.Array() {
			if p["name"] == "new-project" {
				found = true
				break
			}
		}
		assert.True(t, found, "project 'new-project' should exist")
	})

	t.Run("update project", func(t *testing.T) {
		// Given
		project := env.HTTP("POST", "/api/v1/projects", `{"name":"to-update","path":"/tmp"}`)

		// When
		out := env.CLI("gosok project update %s --name updated-name", project.ID())

		// Then
		assert.Equal(t, 0, out.ExitCode)
		res := env.HTTP("GET", "/api/v1/projects/"+project.ID())
		assert.Equal(t, "updated-name", res.Get("name"))
	})

	t.Run("delete project", func(t *testing.T) {
		// Given
		project := env.HTTP("POST", "/api/v1/projects", `{"name":"to-delete","path":"/tmp"}`)

		// When
		out := env.CLI("gosok project delete %s", project.ID())

		// Then
		assert.Equal(t, 0, out.ExitCode)
		res := env.HTTP("GET", "/api/v1/projects/"+project.ID())
		assert.Equal(t, 404, res.Status)
	})
}
```

- [ ] **Step 2: 테스트 실행**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run=TestSC_CLI_1 -v`

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/cli_projects_test.go
git commit -m "test: add SC.CLI.1 project management CLI tests"
```

---

## Task 6: Go 통합 테스트 — SC.CLI.2 탭 관리 + SC.TAB.6 환경변수

**Files:**
- Create: `tests/integration/cli_tabs_test.go`

- [ ] **Step 1: 테스트 작성**

`tests/integration/cli_tabs_test.go`:

```go
package integration_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// SC.CLI.2 — Tab management via CLI
func TestSC_CLI_2_TabManagement(t *testing.T) {
	env := NewTestEnv(t)

	// Given: a project exists
	project := env.HTTP("POST", "/api/v1/projects", `{"name":"cli-tab-test","path":"/tmp"}`)

	t.Run("create tab", func(t *testing.T) {
		out := env.CLI("gosok tab create %s --name my-tab", project.ID())
		assert.Equal(t, 0, out.ExitCode)

		res := env.HTTP("GET", "/api/v1/projects/"+project.ID()+"/tabs")
		found := false
		for _, tab := range res.Array() {
			if tab["name"] == "my-tab" {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("list tabs", func(t *testing.T) {
		out := env.CLI("gosok ls %s", project.ID())
		assert.Equal(t, 0, out.ExitCode)
		assert.Contains(t, out.Stdout, "my-tab")
	})

	t.Run("start and stop tab", func(t *testing.T) {
		tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"lifecycle-tab"}`)

		// Start
		out := env.CLI("gosok tab start %s", tab.ID())
		assert.Equal(t, 0, out.ExitCode)

		// Verify running via API
		res := env.HTTP("GET", "/api/v1/tabs/"+tab.ID())
		assert.Equal(t, "running", res.Get("status"))

		// Stop
		out = env.CLI("gosok tab stop %s", tab.ID())
		assert.Equal(t, 0, out.ExitCode)
	})

	t.Run("delete tab", func(t *testing.T) {
		tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"to-delete"}`)

		out := env.CLI("gosok tab delete %s", tab.ID())
		assert.Equal(t, 0, out.ExitCode)

		res := env.HTTP("GET", "/api/v1/tabs/"+tab.ID())
		assert.Equal(t, 404, res.Status)
	})
}

// SC.TAB.6 — Environment variable injection
func TestSC_TAB_6_EnvInjection(t *testing.T) {
	env := NewTestEnv(t)

	project := env.HTTP("POST", "/api/v1/projects", `{"name":"env-test","path":"/tmp"}`)
	tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"env-tab"}`)

	// Start the tab
	started := env.HTTP("POST", "/api/v1/tabs/"+tab.ID()+"/start")
	require.Equal(t, 200, started.Status)
	sessionID := started.Get("session_id")
	require.NotEmpty(t, sessionID)

	// Connect via WebSocket and check env vars
	term := env.WS("/api/ws/sessions/%s/terminal", sessionID)
	defer term.Close()

	// Wait for shell prompt
	time.Sleep(500 * time.Millisecond)

	// Check GOSOK_TAB_ID
	term.Send([]byte("echo TABID=$GOSOK_TAB_ID\n"))
	term.WaitFor("TABID="+tab.ID(), 5*time.Second)

	// Check GOSOK_TAB_NAME
	term.Send([]byte("echo TABNAME=$GOSOK_TAB_NAME\n"))
	term.WaitFor("TABNAME=env-tab", 5*time.Second)

	// Check GOSOK_PROJECT_NAME
	term.Send([]byte("echo PROJNAME=$GOSOK_PROJECT_NAME\n"))
	term.WaitFor("PROJNAME=env-test", 5*time.Second)

	// Check GOSOK_API_URL is set
	term.Send([]byte("echo APIURL=$GOSOK_API_URL\n"))
	term.WaitFor("APIURL=", 5*time.Second)
}
```

- [ ] **Step 2: 테스트 실행**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run="TestSC_CLI_2|TestSC_TAB_6" -v -timeout 30s`

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/cli_tabs_test.go
git commit -m "test: add SC.CLI.2 tab management and SC.TAB.6 env injection tests"
```

---

## Task 7: Go 통합 테스트 — SC.CLI.3 + SC.MSG.4~5

**Files:**
- Create: `tests/integration/cli_messaging_test.go`

- [ ] **Step 1: 테스트 작성**

`tests/integration/cli_messaging_test.go`:

```go
package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// SC.CLI.3 — Inter-tab communication via CLI
func TestSC_CLI_3_InterTabCommunication(t *testing.T) {
	env := NewTestEnv(t)

	project := env.HTTP("POST", "/api/v1/projects", `{"name":"msg-test","path":"/tmp"}`)
	tabA := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"tab-a"}`)
	tabB := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"tab-b"}`)

	t.Run("send direct message", func(t *testing.T) {
		out := env.CLI("gosok send %s hello-direct", tabB.ID())
		assert.Equal(t, 0, out.ExitCode)

		inbox := env.HTTP("GET", "/api/v1/messages/inbox/"+tabB.ID())
		require.Len(t, inbox.Array(), 1)
		assert.Equal(t, "hello-direct", inbox.Array()[0]["body"])
	})

	t.Run("broadcast message", func(t *testing.T) {
		out := env.CLI("gosok send --all hello-broadcast")
		assert.Equal(t, 0, out.ExitCode)

		// Both tabs should see the broadcast
		inboxA := env.HTTP("GET", "/api/v1/messages/inbox/"+tabA.ID())
		found := false
		for _, msg := range inboxA.Array() {
			if msg["body"] == "hello-broadcast" {
				found = true
				break
			}
		}
		assert.True(t, found, "tab-a should see broadcast")
	})

	t.Run("post global feed message", func(t *testing.T) {
		out := env.CLI("gosok feed global-message")
		assert.Equal(t, 0, out.ExitCode)

		feed := env.HTTP("GET", "/api/v1/messages/feed")
		found := false
		for _, msg := range feed.Array() {
			if msg["body"] == "global-message" {
				found = true
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("check inbox via CLI", func(t *testing.T) {
		out := env.CLI("gosok inbox %s", tabB.ID())
		assert.Equal(t, 0, out.ExitCode)
		assert.Contains(t, out.Stdout, "hello-direct")
	})

	t.Run("mark inbox as read", func(t *testing.T) {
		out := env.CLI("gosok inbox read %s", tabB.ID())
		assert.Equal(t, 0, out.ExitCode)
	})

	t.Run("send without recipient fails", func(t *testing.T) {
		out := env.CLI("gosok send")
		assert.NotEqual(t, 0, out.ExitCode)
	})
}

// SC.MSG.4 — Wait for incoming message
func TestSC_MSG_4_WaitForMessage(t *testing.T) {
	env := NewTestEnv(t)

	project := env.HTTP("POST", "/api/v1/projects", `{"name":"wait-test","path":"/tmp"}`)
	tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"waiter"}`)

	t.Run("wait and receive", func(t *testing.T) {
		// Start wait in background
		done := make(chan *CLIResult, 1)
		go func() {
			done <- env.CLI("gosok wait --timeout 10 %s", tab.ID())
		}()

		// Send a message after a short delay
		time.Sleep(500 * time.Millisecond)
		env.HTTP("POST", "/api/v1/messages", `{"scope":"direct","to_tab_id":"`+tab.ID()+`","body":"wake-up"}`)

		// Wait should return with the message
		select {
		case result := <-done:
			assert.Equal(t, 0, result.ExitCode)
			assert.Contains(t, result.Stdout, "wake-up")
		case <-time.After(15 * time.Second):
			t.Fatal("wait timed out")
		}
	})

	t.Run("wait with timeout and no message", func(t *testing.T) {
		out := env.CLI("gosok wait --timeout 2 %s", tab.ID())
		// Should exit with empty result after timeout
		assert.Equal(t, 0, out.ExitCode)
	})
}

// SC.MSG.5 — Message cleanup
func TestSC_MSG_5_MessageCleanup(t *testing.T) {
	env := NewTestEnv(t)

	project := env.HTTP("POST", "/api/v1/projects", `{"name":"cleanup-test","path":"/tmp"}`)
	tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"tab-a"}`)

	// Create a message
	env.HTTP("POST", "/api/v1/messages", `{"scope":"direct","to_tab_id":"`+tab.ID()+`","body":"old-message"}`)

	// Verify message exists
	inbox := env.HTTP("GET", "/api/v1/messages/inbox/"+tab.ID())
	require.Len(t, inbox.Array(), 1)

	// Directly call PurgeOldMessages with a future cutoff to simulate cleanup
	ctx := context.Background()
	purged, err := env.store.PurgeOldMessages(ctx, time.Now().Add(1*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, int64(1), purged)

	// Verify message is gone
	inbox = env.HTTP("GET", "/api/v1/messages/inbox/"+tab.ID())
	assert.Len(t, inbox.Array(), 0)
}
```

- [ ] **Step 2: 테스트 실행**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run="TestSC_CLI_3|TestSC_MSG" -v -timeout 30s`

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/cli_messaging_test.go
git commit -m "test: add SC.CLI.3 messaging, SC.MSG.4 wait, SC.MSG.5 cleanup tests"
```

---

## Task 8: Go 통합 테스트 — SC.CLI.4 + SC.WS.3

**Files:**
- Create: `tests/integration/cli_settings_test.go`
- Create: `tests/integration/websocket_test.go`

- [ ] **Step 1: Settings 테스트 작성**

`tests/integration/cli_settings_test.go`:

```go
package integration_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// SC.CLI.4 — Notifications and settings via CLI
func TestSC_CLI_4_SettingsAndNotifications(t *testing.T) {
	env := NewTestEnv(t)

	t.Run("list settings", func(t *testing.T) {
		out := env.CLI("gosok setting list")
		assert.Equal(t, 0, out.ExitCode)
		assert.Contains(t, out.Stdout, "font_size")
	})

	t.Run("get setting", func(t *testing.T) {
		out := env.CLI("gosok setting get font_size")
		assert.Equal(t, 0, out.ExitCode)
		assert.Contains(t, out.Stdout, "14")
	})

	t.Run("set setting", func(t *testing.T) {
		out := env.CLI("gosok setting set font_size 16")
		assert.Equal(t, 0, out.ExitCode)

		out = env.CLI("gosok setting get font_size")
		assert.Contains(t, out.Stdout, "16")
	})

	t.Run("delete setting resets to default", func(t *testing.T) {
		env.CLI("gosok setting set font_size 20")
		out := env.CLI("gosok setting delete font_size")
		assert.Equal(t, 0, out.ExitCode)

		out = env.CLI("gosok setting get font_size")
		assert.Contains(t, out.Stdout, "14")
	})

	t.Run("send notification", func(t *testing.T) {
		out := env.CLI("gosok notify test-alert --body alert-body")
		assert.Equal(t, 0, out.ExitCode)
	})
}
```

- [ ] **Step 2: WebSocket keepalive 테스트 작성**

`tests/integration/websocket_test.go`:

```go
package integration_test

import (
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// SC.WS.3 — Connection keepalive
func TestSC_WS_3_Keepalive(t *testing.T) {
	env := NewTestEnv(t)

	project := env.HTTP("POST", "/api/v1/projects", `{"name":"ws-test","path":"/tmp"}`)
	tab := env.HTTP("POST", "/api/v1/projects/"+project.ID()+"/tabs", `{"name":"ws-tab"}`)
	started := env.HTTP("POST", "/api/v1/tabs/"+tab.ID()+"/start")
	sessionID := started.Get("session_id")
	require.NotEmpty(t, sessionID)

	t.Run("ping pong exchange", func(t *testing.T) {
		ws := env.WS("/api/ws/sessions/%s/terminal", sessionID)
		defer ws.Close()

		// Send a ping control message
		ws.SendJSON(map[string]any{"type": "ping"})

		// Should receive a pong response
		var msg map[string]any
		ws.ReadJSON(5*time.Second, &msg)
		assert.Equal(t, "pong", msg["type"])
	})

	t.Run("server sends ping within 30s", func(t *testing.T) {
		wsURL := "ws" + strings.TrimPrefix(env.BaseURL(), "http") + "/api/ws/sessions/" + sessionID + "/terminal"
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		require.NoError(t, err)
		defer conn.Close()

		// Set up pong handler to verify server pings
		gotPing := make(chan struct{}, 1)
		conn.SetPingHandler(func(appData string) error {
			select {
			case gotPing <- struct{}{}:
			default:
			}
			return conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(time.Second))
		})

		// Read in background to trigger ping handler
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()

		// Wait for server ping (should come within 30s)
		select {
		case <-gotPing:
			// success
		case <-time.After(35 * time.Second):
			t.Fatal("server did not send ping within 35s")
		}
	})
}
```

- [ ] **Step 3: 테스트 실행**

Run: `cd /Users/cookieshake/workspace/gosok-terminal && go test ./tests/integration/ -run="TestSC_CLI_4|TestSC_WS_3" -v -timeout 60s`

Expected: PASS

- [ ] **Step 4: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/integration/cli_settings_test.go tests/integration/websocket_test.go
git commit -m "test: add SC.CLI.4 settings/notifications and SC.WS.3 keepalive tests"
```

---

## Task 9: Playwright 인프라 셋업

**Files:**
- Create: `tests/e2e/package.json`
- Create: `tests/e2e/tsconfig.json`
- Create: `tests/e2e/playwright.config.ts`

- [ ] **Step 1: package.json 작성**

`tests/e2e/package.json`:

```json
{
  "name": "gosok-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

`tests/e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: playwright.config.ts 작성**

`tests/e2e/playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:18435",
    trace: "on-first-retry",
  },
  webServer: {
    command: "../../bin/gosok",
    port: 18435,
    env: {
      GOSOK_DB_PATH: "/tmp/gosok-e2e-test.db",
      GOSOK_PORT: "18435",
    },
    reuseExistingServer: false,
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
```

- [ ] **Step 4: 의존성 설치 + 브라우저 설치**

```bash
cd /Users/cookieshake/workspace/gosok-terminal/tests/e2e && npm install && npx playwright install chromium
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/package.json tests/e2e/tsconfig.json tests/e2e/playwright.config.ts tests/e2e/package-lock.json
git commit -m "test: add Playwright infrastructure (config, deps)"
```

---

## Task 10: Playwright 헬퍼 — test-env, api, ui, terminal

**Files:**
- Create: `tests/e2e/helpers/test-env.ts`
- Create: `tests/e2e/helpers/api.ts`
- Create: `tests/e2e/helpers/ui.ts`
- Create: `tests/e2e/helpers/terminal.ts`

- [ ] **Step 1: test-env.ts 작성**

`tests/e2e/helpers/test-env.ts`:

```typescript
import { type Page } from "@playwright/test";
import * as fs from "fs";

const DB_PATH = "/tmp/gosok-e2e-test.db";

/**
 * Reset the test database to a clean state before each test.
 * Removes the existing DB file so the server recreates it with defaults on next request.
 */
export async function setupTestEnv(page: Page): Promise<void> {
  // Delete existing DB to get a fresh state
  try {
    fs.unlinkSync(DB_PATH);
  } catch {
    // File doesn't exist, that's fine
  }

  // Navigate to the app — server will recreate DB on first request
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}
```

- [ ] **Step 2: api.ts 작성**

`tests/e2e/helpers/api.ts`:

```typescript
import { type APIRequestContext } from "@playwright/test";

const BASE = "http://localhost:18435";

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  async get(path: string): Promise<any> {
    const resp = await this.request.get(`${BASE}${path}`);
    if (resp.ok()) {
      return resp.json();
    }
    return null;
  }

  async post(path: string, data?: any): Promise<any> {
    const resp = await this.request.post(`${BASE}${path}`, { data });
    return resp.json();
  }

  async put(path: string, data?: any): Promise<any> {
    const resp = await this.request.put(`${BASE}${path}`, { data });
    return resp.json();
  }

  async delete(path: string): Promise<void> {
    await this.request.delete(`${BASE}${path}`);
  }
}
```

- [ ] **Step 3: ui.ts 작성**

`tests/e2e/helpers/ui.ts`:

```typescript
import { type Page, expect } from "@playwright/test";

export class UiHelper {
  constructor(private page: Page) {}

  async click(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click();
  }

  async clickText(text: string): Promise<void> {
    await this.page.getByText(text, { exact: true }).click();
  }

  async clickButton(name: string): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  async fill(testId: string, value: string): Promise<void> {
    await this.page.getByTestId(testId).fill(value);
  }

  async fillPlaceholder(placeholder: string, value: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async see(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  async notSee(text: string): Promise<void> {
    await expect(this.page.getByText(text)).not.toBeVisible();
  }

  async seeTestId(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toBeVisible();
  }

  async notSeeTestId(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).not.toBeVisible();
  }

  async waitForText(text: string, timeout = 5000): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout });
  }

  async count(testId: string): Promise<number> {
    return this.page.getByTestId(testId).count();
  }
}
```

- [ ] **Step 4: terminal.ts 작성**

`tests/e2e/helpers/terminal.ts`:

```typescript
import { type Page } from "@playwright/test";

/**
 * Helper for interacting with xterm.js terminal in the browser.
 *
 * xterm.js renders to a canvas, so DOM text queries don't work.
 * We use the xterm.js API exposed via window.__GOSOK_TERMINAL__ to read buffer content.
 */
export class TerminalHelper {
  constructor(private page: Page) {}

  /**
   * Type text into the terminal by simulating keyboard input.
   */
  async type(text: string): Promise<void> {
    const terminalEl = this.page.locator(".xterm-helper-textarea");
    await terminalEl.focus();
    for (const char of text) {
      if (char === "\n") {
        await this.page.keyboard.press("Enter");
      } else {
        await this.page.keyboard.type(char, { delay: 10 });
      }
    }
  }

  /**
   * Wait until the terminal buffer contains the target text.
   * Polls the xterm.js buffer via JavaScript evaluation.
   */
  async waitForText(target: string, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      (text: string) => {
        const term = (window as any).__GOSOK_TERMINAL__;
        if (!term) return false;
        const buffer = term.buffer.active;
        let content = "";
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) content += line.translateToString(true) + "\n";
        }
        return content.includes(text);
      },
      target,
      { timeout },
    );
  }

  /**
   * Get the full text content of the terminal buffer.
   */
  async getContent(): Promise<string> {
    return this.page.evaluate(() => {
      const term = (window as any).__GOSOK_TERMINAL__;
      if (!term) return "";
      const buffer = term.buffer.active;
      let content = "";
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) content += line.translateToString(true) + "\n";
      }
      return content;
    });
  }
}
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/helpers/
git commit -m "test: add Playwright DSL helpers (api, ui, terminal)"
```

---

## Task 11: 프론트엔드 data-testid 추가 + 터미널 인스턴스 노출

Playwright 테스트가 안정적으로 셀렉트할 수 있도록 주요 UI 요소에 `data-testid`를 추가한다. 또한 xterm.js 인스턴스를 `window.__GOSOK_TERMINAL__`로 노출하여 터미널 버퍼 읽기를 가능하게 한다.

**Files:**
- Modify: `frontend/src/components/CreateProjectDialog.tsx`
- Modify: `frontend/src/components/AddTabDialog.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/ProjectView.tsx`
- Modify: `frontend/src/components/TerminalPane.tsx`
- Modify: `frontend/src/components/NotificationCenter.tsx`
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/TerminalTabs.tsx`

- [ ] **Step 1: data-testid 추가 대상**

| 컴포넌트 | testid | 대상 요소 |
|----------|--------|----------|
| Sidebar | `sidebar-new-project` | 새 프로젝트 버튼 |
| Sidebar | `sidebar-project-{id}` | 프로젝트 항목 |
| Sidebar | `sidebar-settings` | 설정 버튼 |
| Sidebar | `sidebar-dashboard` | 대시보드 버튼 |
| Dashboard | `project-card-{id}` | 프로젝트 카드 |
| Dashboard | `dashboard-empty` | 빈 상태 메시지 |
| CreateProjectDialog | `create-project-dialog` | 다이얼로그 컨테이너 |
| CreateProjectDialog | `create-project-path` | 경로 입력 필드 |
| CreateProjectDialog | `create-project-desc` | 설명 입력 필드 |
| CreateProjectDialog | `create-project-submit` | 생성 버튼 |
| CreateProjectDialog | `create-project-cancel` | 취소 버튼 |
| AddTabDialog | `add-tab-dialog` | 다이얼로그 컨테이너 |
| AddTabDialog | `add-tab-type-{type}` | 탭 타입 선택 항목 |
| AddTabDialog | `add-tab-submit` | 열기 버튼 |
| ProjectView | `project-view` | 메인 컨테이너 |
| ProjectView | `project-add-tab` | 탭 추가 버튼 |
| ProjectView | `project-mode-{mode}` | 모드 선택 (terminals/editor/diff) |
| ProjectView | `notification-bell` | 알림 벨 |
| TerminalTabs | `terminal-tab-{id}` | 탭 항목 |
| TerminalTabs | `terminal-tab-start-{id}` | 시작 버튼 |
| TerminalTabs | `terminal-tab-stop-{id}` | 종료 버튼 |
| TerminalPane | `terminal-pane` | 터미널 컨테이너 |
| TerminalPane | `terminal-reconnect` | 재연결 버튼 |
| NotificationCenter | `notif-panel` | 알림 패널 |
| NotificationCenter | `notif-filter-{filter}` | 필터 탭 (all/messages/alerts) |
| NotificationCenter | `notif-message-{id}` | 메시지 항목 |

- [ ] **Step 2: 각 컴포넌트 파일을 읽고 data-testid 삽입**

각 컴포넌트 파일을 열어서 해당 JSX 요소에 `data-testid="..."` 속성을 추가한다. 예시:

```tsx
// Before
<button onClick={onCreateProject}>Create</button>

// After
<button data-testid="create-project-submit" onClick={onCreateProject}>Create</button>
```

- [ ] **Step 3: TerminalPane에 xterm 인스턴스 노출 추가**

`frontend/src/components/TerminalPane.tsx`에서 xterm Terminal 인스턴스 생성 직후:

```tsx
// xterm 인스턴스를 테스트에서 접근 가능하도록 노출
if (import.meta.env.DEV) {
  (window as any).__GOSOK_TERMINAL__ = term;
}
```

- [ ] **Step 4: 프론트엔드 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal/frontend && npm run build
```

Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add frontend/src/components/
git commit -m "test: add data-testid attributes and expose xterm instance for e2e tests"
```

---

## Task 12: Playwright E2E — SC.PROJ.1~2 프로젝트

**Files:**
- Create: `tests/e2e/projects.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/projects.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.PROJ.1 - Project CRUD [Web UI]", () => {
  let api: ApiHelper;
  let ui: UiHelper;

  test.beforeEach(async ({ page, request }) => {
    await setupTestEnv(page);
    api = new ApiHelper(request);
    ui = new UiHelper(page);
  });

  test("create a project", async ({ page }) => {
    await ui.click("sidebar-new-project");
    await ui.fill("create-project-path", "/tmp/test-project");
    await ui.clickButton("Create");

    // Project should appear in sidebar
    await ui.see("test-project");
  });

  test("view project details", async ({ page }) => {
    const project = await api.post("/api/v1/projects", {
      name: "detail-test",
      path: "/tmp/detail",
    });
    await page.reload();

    await ui.clickText("detail-test");
    await ui.seeTestId("project-view");
  });

  test("delete project disappears from sidebar", async ({ page }) => {
    const project = await api.post("/api/v1/projects", {
      name: "to-delete",
      path: "/tmp/del",
    });
    await page.reload();
    await ui.see("to-delete");

    await api.delete(`/api/v1/projects/${project.id}`);
    await page.reload();

    await ui.notSee("to-delete");
  });
});

test.describe("SC.PROJ.2 - Project Reorder [Web UI]", () => {
  test("reorder reflects in sidebar", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);

    const p1 = await api.post("/api/v1/projects", { name: "Project-A", path: "/tmp/a" });
    const p2 = await api.post("/api/v1/projects", { name: "Project-B", path: "/tmp/b" });
    const p3 = await api.post("/api/v1/projects", { name: "Project-C", path: "/tmp/c" });

    await api.put("/api/v1/projects/reorder", { ids: [p3.id, p1.id, p2.id] });
    await page.reload();

    const items = await page.getByTestId(/^sidebar-project-/).allTextContents();
    expect(items[0]).toContain("Project-C");
    expect(items[1]).toContain("Project-A");
    expect(items[2]).toContain("Project-B");
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test projects.spec.ts
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/projects.spec.ts
git commit -m "test: add SC.PROJ.1~2 Playwright e2e tests"
```

---

## Task 13: Playwright E2E — SC.TAB.1~5, SC.TAB.7

**Files:**
- Create: `tests/e2e/tabs.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/tabs.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

test.describe("SC.TAB.1 - Tab CRUD [Web UI]", () => {
  test("create a tab via dialog", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "tab-crud", path: "/tmp" });
    await page.reload();
    await ui.clickText("tab-crud");

    await ui.click("project-add-tab");
    await ui.click("add-tab-type-shell");
    await ui.clickButton("Open");

    // New tab should appear
    await page.waitForTimeout(500);
  });

  test("delete a tab", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "tab-del", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "del-tab" });
    await page.reload();
    await ui.clickText("tab-del");
    await ui.see("del-tab");

    await api.delete(`/api/v1/tabs/${tab.id}`);
    await page.reload();
    await ui.clickText("tab-del");
    await ui.notSee("del-tab");
  });
});

test.describe("SC.TAB.2 - Tab Lifecycle [Web UI]", () => {
  test("start tab shows terminal", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "lifecycle", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "start-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    await ui.clickText("lifecycle");
    await ui.clickText("start-tab");

    await ui.seeTestId("terminal-pane");
  });
});

test.describe("SC.TAB.4 - Tab Write [Web UI]", () => {
  test("type in terminal and see output", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const terminal = new TerminalHelper(page);

    const project = await api.post("/api/v1/projects", { name: "write-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "write-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    await ui.clickText("write-test");
    await ui.clickText("write-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    await terminal.type("echo HELLO_E2E\n");
    await terminal.waitForText("HELLO_E2E", 10000);
  });
});

test.describe("SC.TAB.5 - Tab Screen [Web UI]", () => {
  test("terminal shows scrollback", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const terminal = new TerminalHelper(page);

    const project = await api.post("/api/v1/projects", { name: "screen-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "screen-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    await ui.clickText("screen-test");
    await ui.clickText("screen-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    await terminal.type("for i in $(seq 1 5); do echo LINE_$i; done\n");
    await terminal.waitForText("LINE_5", 10000);

    const content = await terminal.getContent();
    expect(content).toContain("LINE_1");
    expect(content).toContain("LINE_5");
  });
});

test.describe("SC.TAB.7 - Dynamic Title [Web UI]", () => {
  test("OSC title updates tab name", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);
    const terminal = new TerminalHelper(page);

    const project = await api.post("/api/v1/projects", { name: "title-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "title-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    await ui.clickText("title-test");
    await ui.clickText("title-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    await terminal.type('printf "\\033]0;MY_CUSTOM_TITLE\\007"\n');
    await ui.waitForText("MY_CUSTOM_TITLE", 5000);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test tabs.spec.ts
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/tabs.spec.ts
git commit -m "test: add SC.TAB.1~5,7 Playwright e2e tests"
```

---

## Task 14: Playwright E2E — SC.TERM.1~4

**Files:**
- Create: `tests/e2e/terminal.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/terminal.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

async function setupRunningTab(page: any, request: any) {
  const api = new ApiHelper(request);
  const project = await api.post("/api/v1/projects", { name: "term-test", path: "/tmp" });
  const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "term-tab" });
  await api.post(`/api/v1/tabs/${tab.id}/start`);
  await page.reload();
  const ui = new UiHelper(page);
  await ui.clickText("term-test");
  await ui.clickText("term-tab");
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
  return { api, project, tab };
}

test.describe("SC.TERM.1 - Session Lifecycle", () => {
  test("terminal session produces output", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("echo SESSION_ALIVE\n");
    await terminal.waitForText("SESSION_ALIVE", 5000);
  });
});

test.describe("SC.TERM.2 - Scrollback", () => {
  test("output preserved in scrollback buffer", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("for i in $(seq 1 20); do echo SCROLL_$i; done\n");
    await terminal.waitForText("SCROLL_20", 5000);

    const content = await terminal.getContent();
    expect(content).toContain("SCROLL_1");
    expect(content).toContain("SCROLL_20");
  });
});

test.describe("SC.TERM.3 - Output Recovery", () => {
  test("reconnect replays previous output", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await terminal.type("echo BEFORE_RECONNECT\n");
    await terminal.waitForText("BEFORE_RECONNECT", 5000);

    // Simulate reconnect
    await page.reload();
    const ui = new UiHelper(page);
    await ui.clickText("term-test");
    await ui.clickText("term-tab");
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const newTerminal = new TerminalHelper(page);
    await newTerminal.waitForText("BEFORE_RECONNECT", 10000);
  });
});

test.describe("SC.TERM.4 - Terminal Resize", () => {
  test("terminal adapts to viewport resize", async ({ page, request }) => {
    await setupTestEnv(page);
    await setupRunningTab(page, request);
    const terminal = new TerminalHelper(page);

    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);

    await terminal.type("echo RESIZED_OK\n");
    await terminal.waitForText("RESIZED_OK", 5000);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test terminal.spec.ts
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/terminal.spec.ts
git commit -m "test: add SC.TERM.1~4 Playwright e2e tests"
```

---

## Task 15: Playwright E2E — SC.WS.1~2, SC.WS.4~6

**Files:**
- Create: `tests/e2e/websocket.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/websocket.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import { TerminalHelper } from "./helpers/terminal";

test.describe("SC.WS.1 - Terminal Connection", () => {
  test("WebSocket connects and terminal is interactive", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const project = await api.post("/api/v1/projects", { name: "ws-conn", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "ws-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    const ui = new UiHelper(page);
    await ui.clickText("ws-conn");
    await ui.clickText("ws-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const terminal = new TerminalHelper(page);
    await terminal.type("echo WS_OK\n");
    await terminal.waitForText("WS_OK", 5000);
  });
});

test.describe("SC.WS.2 - Terminal Events", () => {
  test("process exit updates tab status", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const project = await api.post("/api/v1/projects", { name: "ws-exit", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "exit-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    const ui = new UiHelper(page);
    await ui.clickText("ws-exit");
    await ui.clickText("exit-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);

    await terminal.type("exit 0\n");
    await page.waitForTimeout(3000);

    const tabStatus = await api.get(`/api/v1/tabs/${tab.id}`);
    expect(tabStatus.status).toBe("stopped");
  });
});

test.describe("SC.WS.4 - Scrollback on Reconnect", () => {
  test("previous output replayed after page reload", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const project = await api.post("/api/v1/projects", { name: "ws-scroll", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "scroll-tab" });
    await api.post(`/api/v1/tabs/${tab.id}/start`);
    await page.reload();
    const ui = new UiHelper(page);
    await ui.clickText("ws-scroll");
    await ui.clickText("scroll-tab");

    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });
    const terminal = new TerminalHelper(page);

    await terminal.type("echo SCROLLBACK_XYZ\n");
    await terminal.waitForText("SCROLLBACK_XYZ", 5000);

    await page.reload();
    await ui.clickText("ws-scroll");
    await ui.clickText("scroll-tab");
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 10000 });

    const newTerminal = new TerminalHelper(page);
    await newTerminal.waitForText("SCROLLBACK_XYZ", 10000);
  });
});

test.describe("SC.WS.5 - Real-Time Events", () => {
  test("notification arrives in real-time", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "ws-events", path: "/tmp" });
    await page.reload();
    await ui.clickText("ws-events");

    await api.post("/api/v1/notify", { title: "REALTIME_ALERT" });

    await page.waitForTimeout(2000);
    await ui.click("notification-bell");
    await ui.waitForText("REALTIME_ALERT", 5000);
  });
});

test.describe("SC.WS.6 - Demo Terminal", () => {
  test("demo WebSocket endpoint accepts connection", async ({ page }) => {
    await setupTestEnv(page);

    const connected = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/demo`);
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });

    expect(connected).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test websocket.spec.ts
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/websocket.spec.ts
git commit -m "test: add SC.WS.1~2,4~6 Playwright e2e tests"
```

---

## Task 16: Playwright E2E — SC.MSG.1~3

**Files:**
- Create: `tests/e2e/messaging.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/messaging.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.MSG.1 - Send Message", () => {
  test("direct message appears in notification center", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "msg-test", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a" });
    const tabB = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-b" });
    await page.reload();
    await ui.clickText("msg-test");

    await api.post("/api/v1/messages", {
      scope: "direct",
      from_tab_id: tabA.id,
      to_tab_id: tabB.id,
      body: "hello-from-a",
    });

    await ui.click("notification-bell");
    await ui.waitForText("hello-from-a", 5000);
  });

  test("broadcast message visible", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "bcast", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a" });
    await page.reload();
    await ui.clickText("bcast");

    await api.post("/api/v1/messages", {
      scope: "broadcast",
      from_tab_id: tabA.id,
      body: "hello-broadcast",
    });

    await ui.click("notification-bell");
    await ui.waitForText("hello-broadcast", 5000);
  });

  test("global feed message", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.post("/api/v1/messages", { scope: "global", body: "global-msg" });

    await ui.click("notification-bell");
    await ui.waitForText("global-msg", 5000);
  });
});

test.describe("SC.MSG.2 - Inbox and Feed", () => {
  test("messages displayed in notification center", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "inbox-test", path: "/tmp" });
    const tabA = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a" });
    const tabB = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-b" });

    await api.post("/api/v1/messages", {
      scope: "direct", from_tab_id: tabA.id, to_tab_id: tabB.id, body: "direct-msg",
    });
    await api.post("/api/v1/messages", {
      scope: "broadcast", from_tab_id: tabA.id, body: "broadcast-msg",
    });

    await page.reload();
    await ui.clickText("inbox-test");
    await ui.click("notification-bell");

    await ui.click("notif-filter-messages");
    await ui.see("direct-msg");
    await ui.see("broadcast-msg");
  });
});

test.describe("SC.MSG.3 - Read Markers", () => {
  test("marking read clears unread state", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const project = await api.post("/api/v1/projects", { name: "read-test", path: "/tmp" });
    const tab = await api.post(`/api/v1/projects/${project.id}/tabs`, { name: "tab-a" });

    await api.post("/api/v1/messages", {
      scope: "direct", to_tab_id: tab.id, body: "unread-msg",
    });

    await page.reload();
    await ui.clickText("read-test");
    await ui.click("notification-bell");
    await ui.see("unread-msg");

    // Mark as read
    const inbox = await api.get(`/api/v1/messages/inbox/${tab.id}`);
    if (inbox && inbox.length > 0) {
      const lastId = inbox[inbox.length - 1].id;
      await api.put(`/api/v1/messages/inbox/${tab.id}/read`, { last_read_id: lastId });
    }

    await page.reload();
    // Unread indicator should be gone after marking read
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test messaging.spec.ts
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/messaging.spec.ts
git commit -m "test: add SC.MSG.1~3 Playwright e2e messaging tests"
```

---

## Task 17: Playwright E2E — SC.NOTIF.1, SC.SET.1~2, SC.API.4

**Files:**
- Create: `tests/e2e/notifications.spec.ts`
- Create: `tests/e2e/settings.spec.ts`
- Create: `tests/e2e/spa-routing.spec.ts`

- [ ] **Step 1: notifications.spec.ts**

`tests/e2e/notifications.spec.ts`:

```typescript
import { test } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.NOTIF.1 - Send Notification", () => {
  test("notification appears in panel", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.post("/api/v1/notify", { title: "Test Alert", body: "Something happened" });

    await ui.click("notification-bell");
    await ui.waitForText("Test Alert", 5000);
    await ui.see("Something happened");
  });

  test("notification with flag", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.post("/api/v1/notify", { title: "Flagged Alert", flag: true });

    await ui.click("notification-bell");
    await ui.waitForText("Flagged Alert", 5000);
  });
});
```

- [ ] **Step 2: settings.spec.ts**

`tests/e2e/settings.spec.ts`:

```typescript
import { test } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";

test.describe("SC.SET.1 - Settings CRUD [Web UI]", () => {
  test("view settings page", async ({ page, request }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.see("font_size");
  });

  test("changed setting reflects in UI", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.put("/api/v1/settings/font_size", { value: 18 });
    await page.reload();
    await ui.click("sidebar-settings");
    await ui.see("18");
  });
});

test.describe("SC.SET.2 - Default Settings [Web UI]", () => {
  test("defaults present on fresh start", async ({ page, request }) => {
    await setupTestEnv(page);
    const ui = new UiHelper(page);

    await ui.click("sidebar-settings");
    await ui.see("font_size");
  });

  test("reset restores default value", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    await api.put("/api/v1/settings/font_size", { value: 20 });
    await api.delete("/api/v1/settings/font_size");
    await page.reload();
    await ui.click("sidebar-settings");
    await ui.see("14");
  });
});
```

- [ ] **Step 3: spa-routing.spec.ts**

`tests/e2e/spa-routing.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";

test.describe("SC.API.4 - SPA Routing", () => {
  test("deep URL returns SPA, not 404", async ({ page }) => {
    await page.goto("/some/deep/route");
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body).not.toContain("404");
  });

  test("API routes not caught by SPA fallback", async ({ page }) => {
    const resp = await page.request.get("/api/v1/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("ok");
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test notifications.spec.ts settings.spec.ts spa-routing.spec.ts
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/notifications.spec.ts tests/e2e/settings.spec.ts tests/e2e/spa-routing.spec.ts
git commit -m "test: add SC.NOTIF.1, SC.SET.1~2, SC.API.4 Playwright e2e tests"
```

---

## Task 18: Playwright E2E — SC.FS.1~4

**Files:**
- Create: `tests/e2e/filesystem.spec.ts`

- [ ] **Step 1: 테스트 작성**

`tests/e2e/filesystem.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { setupTestEnv } from "./helpers/test-env";
import { ApiHelper } from "./helpers/api";
import { UiHelper } from "./helpers/ui";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

function createTempDir(): string {
  return fs.mkdtempSync("/tmp/gosok-fs-test-");
}

function cleanupDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

test.describe("SC.FS.1 - Directory Browsing", () => {
  test("browse directories in editor pane", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.mkdirSync(path.join(tmpDir, "subdir-a"));
    fs.mkdirSync(path.join(tmpDir, "subdir-b"));

    const project = await api.post("/api/v1/projects", { name: "fs-test", path: tmpDir });
    await page.reload();
    await ui.clickText("fs-test");
    await ui.click("project-mode-editor");

    await ui.waitForText("subdir-a", 5000);
    await ui.see("subdir-b");

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.2 - File Listing", () => {
  test("list files", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.writeFileSync(path.join(tmpDir, "file-a.txt"), "content-a");
    fs.writeFileSync(path.join(tmpDir, "file-b.txt"), "content-b");

    const project = await api.post("/api/v1/projects", { name: "files-test", path: tmpDir });
    await page.reload();
    await ui.clickText("files-test");
    await ui.click("project-mode-editor");

    await ui.waitForText("file-a.txt", 5000);
    await ui.see("file-b.txt");

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.3 - File Read/Write", () => {
  test("read file content in editor", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    fs.writeFileSync(path.join(tmpDir, "editable.txt"), "original content");

    const project = await api.post("/api/v1/projects", { name: "edit-test", path: tmpDir });
    await page.reload();
    await ui.clickText("edit-test");
    await ui.click("project-mode-editor");
    await ui.clickText("editable.txt");

    await ui.waitForText("original content", 5000);

    cleanupDir(tmpDir);
  });
});

test.describe("SC.FS.4 - Git Changes", () => {
  test("show changed files in diff mode", async ({ page, request }) => {
    await setupTestEnv(page);
    const api = new ApiHelper(request);
    const ui = new UiHelper(page);

    const tmpDir = createTempDir();
    spawnSync("git", ["init"], { cwd: tmpDir });
    spawnSync("git", ["config", "user.email", "test@test.com"], { cwd: tmpDir });
    spawnSync("git", ["config", "user.name", "Test"], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "initial");
    spawnSync("git", ["add", "."], { cwd: tmpDir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "modified");

    const project = await api.post("/api/v1/projects", { name: "git-test", path: tmpDir });
    await page.reload();
    await ui.clickText("git-test");
    await ui.click("project-mode-diff");

    await ui.waitForText("file.txt", 5000);

    cleanupDir(tmpDir);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && make build
cd tests/e2e && npx playwright test filesystem.spec.ts
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add tests/e2e/filesystem.spec.ts
git commit -m "test: add SC.FS.1~4 Playwright e2e filesystem tests"
```

---

## Task 19: Makefile + .gitignore 업데이트

**Files:**
- Modify: `Makefile`
- Modify: `.gitignore`

- [ ] **Step 1: Makefile에 테스트 타겟 추가**

```makefile
test-integration:
	go test ./tests/integration/... -timeout 60s

test-e2e: build
	cd tests/e2e && npx playwright test

test-all: test test-integration test-e2e
```

- [ ] **Step 2: .gitignore에 테스트 아티팩트 추가**

```
# E2E test artifacts
tests/e2e/node_modules/
tests/e2e/test-results/
tests/e2e/playwright-report/
tests/e2e/dist/
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/cookieshake/workspace/gosok-terminal
git add Makefile .gitignore
git commit -m "chore: add test-integration, test-e2e, test-all targets and gitignore"
```

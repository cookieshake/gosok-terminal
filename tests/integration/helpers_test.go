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

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

func (r *Response) ID() string {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return ""
	}
	id, _ := m["id"].(string)
	return id
}

func (r *Response) Get(key string) string {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return ""
	}
	v, _ := m[key].(string)
	return v
}

func (r *Response) GetNum(key string) float64 {
	m, ok := r.parsed.(map[string]any)
	if !ok {
		return 0
	}
	v, _ := m[key].(float64)
	return v
}

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

func (r *Response) Body() string {
	return string(r.body)
}

type CLIResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

func (e *TestEnv) CLI(format string, args ...any) *CLIResult {
	e.t.Helper()

	cmdLine := fmt.Sprintf(format, args...)
	parts := strings.Fields(cmdLine)

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

func (r *CLIResult) JSON() map[string]any {
	var result map[string]any
	json.Unmarshal([]byte(r.Stdout), &result)
	return result
}

func (r *CLIResult) JSONArray() []map[string]any {
	var result []map[string]any
	json.Unmarshal([]byte(r.Stdout), &result)
	return result
}

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

func (w *WSConn) Send(data []byte) {
	w.t.Helper()
	err := w.conn.WriteMessage(websocket.BinaryMessage, data)
	require.NoError(w.t, err)
}

func (w *WSConn) SendJSON(v any) {
	w.t.Helper()
	err := w.conn.WriteJSON(v)
	require.NoError(w.t, err)
}

func (w *WSConn) Read(timeout time.Duration) (int, []byte) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	msgType, data, err := w.conn.ReadMessage()
	require.NoError(w.t, err)
	return msgType, data
}

func (w *WSConn) ReadJSON(timeout time.Duration, v any) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	err := w.conn.ReadJSON(v)
	require.NoError(w.t, err)
}

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

func (w *WSConn) WaitForClose(timeout time.Duration) {
	w.t.Helper()
	w.conn.SetReadDeadline(time.Now().Add(timeout))
	for {
		_, _, err := w.conn.ReadMessage()
		if err != nil {
			return
		}
	}
}

func (w *WSConn) Close() {
	w.conn.Close()
}

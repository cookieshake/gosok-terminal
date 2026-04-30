package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Only kept here: scenarios that exercise CLI-specific behaviour or
// state transitions that the API tests don't cover. Trivial CLI →
// HTTP wrappers (create/list/delete) live as API tests.

func getTabStatus(env *TestEnv, tabID string) string {
	resp := env.HTTP("GET", "/api/v1/tabs/"+tabID)
	if resp.Status != http.StatusOK {
		return ""
	}
	m, ok := resp.parsed.(map[string]any)
	if !ok {
		return ""
	}
	statusObj, ok := m["status"].(map[string]any)
	if !ok {
		return ""
	}
	s, _ := statusObj["status"].(string)
	return s
}

func TestSC_CLI_2_TabStartStop(t *testing.T) {
	env := NewTestEnv(t)

	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"cli-startstop","path":"/tmp/cli-startstop"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	require.NotEmpty(t, projectID)

	createResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs",
		`{"name":"start-stop-tab","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, createResp.Status)
	tabID := createResp.ID()
	require.NotEmpty(t, tabID)

	startResult := env.CLI("gosok tab start %s", tabID)
	assert.Equal(t, 0, startResult.ExitCode, "tab start should exit 0; stderr: %s", startResult.Stderr)
	assert.Equal(t, "running", getTabStatus(env, tabID), "tab should be running after start")

	stopResult := env.CLI("gosok tab stop %s", tabID)
	assert.Equal(t, 0, stopResult.ExitCode, "tab stop should exit 0; stderr: %s", stopResult.Stderr)
	assert.Equal(t, "stopped", getTabStatus(env, tabID), "tab should be stopped after stop")
}

func TestSC_TAB_6_EnvInjection(t *testing.T) {
	env := NewTestEnv(t)

	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"env-inject-project","path":"/tmp/env-inject"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	projectName := projResp.Get("name")
	require.NotEmpty(t, projectID)

	tabResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs",
		`{"name":"env-tab","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, tabResp.Status)
	tabID := tabResp.ID()
	tabName := tabResp.Get("name")
	require.NotEmpty(t, tabID)

	startResp := env.HTTP("POST", "/api/v1/tabs/"+tabID+"/start")
	require.Equal(t, http.StatusOK, startResp.Status, "start tab: %s", startResp.Body())
	sessionID := startResp.Get("session_id")
	require.NotEmpty(t, sessionID, "start response should contain session_id")

	term := env.WS("/api/ws/sessions/%s/terminal", sessionID)
	helloMsg, err := json.Marshal(map[string]any{"type": "resize", "cols": 220, "rows": 50})
	require.NoError(t, err)
	require.NoError(t, term.conn.WriteMessage(websocket.TextMessage, helloMsg))

	// Wait for the shell to drain the initial banner before sending probes.
	// Shorter than this and the prompt arrives mid-echo and corrupts WaitFor.
	time.Sleep(500 * time.Millisecond)

	term.Send([]byte("echo TABID=$GOSOK_TAB_ID\n"))
	term.WaitFor("TABID="+tabID, 5*time.Second)

	term.Send([]byte("echo TABNAME=$GOSOK_TAB_NAME\n"))
	term.WaitFor("TABNAME="+tabName, 5*time.Second)

	term.Send([]byte("echo PROJNAME=$GOSOK_PROJECT_NAME\n"))
	term.WaitFor("PROJNAME="+projectName, 5*time.Second)

	term.Send([]byte("echo APIURL=$GOSOK_API_URL\n"))
	term.WaitFor("APIURL=http", 5*time.Second)
}

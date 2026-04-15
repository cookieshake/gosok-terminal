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

// getTabStatus retrieves the nested status field from GET /api/v1/tabs/{id}
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

func TestSC_CLI_2_TabManagement(t *testing.T) {
	env := NewTestEnv(t)

	// Create a project via HTTP to use in all subtests
	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"cli-test-project","path":"/tmp/cli-test"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	require.NotEmpty(t, projectID)

	t.Run("create tab", func(t *testing.T) {
		// Flags must come before positional args due to Go flag parsing behavior
		result := env.CLI("gosok tab create --name my-tab %s", projectID)
		assert.Equal(t, 0, result.ExitCode, "CLI should exit 0; stderr: %s", result.Stderr)

		// Verify via HTTP
		listResp := env.HTTP("GET", "/api/v1/projects/"+projectID+"/tabs")
		require.Equal(t, http.StatusOK, listResp.Status)
		tabs := listResp.Array()
		require.NotEmpty(t, tabs, "expected at least one tab")
		found := false
		for _, tab := range tabs {
			if tab["name"] == "my-tab" {
				found = true
				break
			}
		}
		assert.True(t, found, "tab 'my-tab' should exist via HTTP after CLI create")
	})

	t.Run("list tabs", func(t *testing.T) {
		result := env.CLI("gosok ls %s", projectID)
		assert.Equal(t, 0, result.ExitCode, "CLI should exit 0; stderr: %s", result.Stderr)
		assert.Contains(t, result.Stdout, "my-tab", "stdout should contain tab name")
	})

	t.Run("start and stop tab", func(t *testing.T) {
		// Create a fresh tab via HTTP
		createResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs",
			`{"name":"start-stop-tab","tab_type":"shell"}`)
		require.Equal(t, http.StatusCreated, createResp.Status)
		tabID := createResp.ID()
		require.NotEmpty(t, tabID)

		// Start via CLI
		startResult := env.CLI("gosok tab start %s", tabID)
		assert.Equal(t, 0, startResult.ExitCode, "tab start should exit 0; stderr: %s", startResult.Stderr)

		// Verify running via HTTP (status embedded in tab response)
		status := getTabStatus(env, tabID)
		assert.Equal(t, "running", status, "tab should be running after start")

		// Stop via CLI
		stopResult := env.CLI("gosok tab stop %s", tabID)
		assert.Equal(t, 0, stopResult.ExitCode, "tab stop should exit 0; stderr: %s", stopResult.Stderr)

		// Verify stopped via HTTP
		status2 := getTabStatus(env, tabID)
		assert.Equal(t, "stopped", status2, "tab should be stopped after stop")
	})

	t.Run("delete tab", func(t *testing.T) {
		// Create a tab via HTTP
		createResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs",
			`{"name":"to-delete-tab","tab_type":"shell"}`)
		require.Equal(t, http.StatusCreated, createResp.Status)
		tabID := createResp.ID()
		require.NotEmpty(t, tabID)

		// Delete via CLI
		deleteResult := env.CLI("gosok tab delete %s", tabID)
		assert.Equal(t, 0, deleteResult.ExitCode, "tab delete should exit 0; stderr: %s", deleteResult.Stderr)

		// Verify 404 via HTTP
		getResp := env.HTTP("GET", "/api/v1/tabs/"+tabID)
		assert.Equal(t, http.StatusNotFound, getResp.Status, "tab should return 404 after delete")
	})
}

func TestSC_TAB_6_EnvInjection(t *testing.T) {
	env := NewTestEnv(t)

	// Create project via HTTP
	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"env-inject-project","path":"/tmp/env-inject"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	projectName := projResp.Get("name")
	require.NotEmpty(t, projectID)

	// Create tab via HTTP
	tabBody := `{"name":"env-tab","tab_type":"shell"}`
	tabResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs", tabBody)
	require.Equal(t, http.StatusCreated, tabResp.Status)
	tabID := tabResp.ID()
	tabName := tabResp.Get("name")
	require.NotEmpty(t, tabID)

	// Start tab via HTTP
	startResp := env.HTTP("POST", "/api/v1/tabs/"+tabID+"/start")
	require.Equal(t, http.StatusOK, startResp.Status, "start tab: %s", startResp.Body())
	sessionID := startResp.Get("session_id")
	require.NotEmpty(t, sessionID, "start response should contain session_id")

	// Connect via WebSocket
	term := env.WS("/api/ws/sessions/%s/terminal", sessionID)

	// Send initial hello/resize message (required by the WS protocol)
	helloMsg, err := json.Marshal(map[string]any{
		"type": "resize",
		"cols": 220,
		"rows": 50,
	})
	require.NoError(t, err)
	require.NoError(t, term.conn.WriteMessage(websocket.TextMessage, helloMsg))

	// Wait for sync message and shell prompt to appear
	time.Sleep(500 * time.Millisecond)

	// Check GOSOK_TAB_ID
	term.Send([]byte("echo TABID=$GOSOK_TAB_ID\n"))
	term.WaitFor("TABID="+tabID, 5*time.Second)

	// Check GOSOK_TAB_NAME
	term.Send([]byte("echo TABNAME=$GOSOK_TAB_NAME\n"))
	term.WaitFor("TABNAME="+tabName, 5*time.Second)

	// Check GOSOK_PROJECT_NAME
	term.Send([]byte("echo PROJNAME=$GOSOK_PROJECT_NAME\n"))
	term.WaitFor("PROJNAME="+projectName, 5*time.Second)

	// Check GOSOK_API_URL (just non-empty - contains "APIURL=" followed by the URL)
	term.Send([]byte("echo APIURL=$GOSOK_API_URL\n"))
	term.WaitFor("APIURL=http", 5*time.Second)
}

package integration_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Only kept here: CLI behaviours that the message API itself doesn't
// exercise — argument validation and the blocking `gosok wait` loop.

func TestSC_CLI_3_SendWithoutRecipientFails(t *testing.T) {
	env := NewTestEnv(t)

	result := env.CLI("gosok send")
	assert.NotEqual(t, 0, result.ExitCode, "expected non-zero exit when no recipient given")
}

func TestSC_MSG_4_WaitForMessage(t *testing.T) {
	t.Run("wait and receive", func(t *testing.T) {
		env := NewTestEnv(t)

		projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"wait-proj","path":"/tmp/wait"}`)
		require.Equal(t, 201, projResp.Status)
		projID := projResp.ID()

		tabResp := env.HTTP("POST", fmt.Sprintf("/api/v1/projects/%s/tabs", projID),
			`{"tab_type":"shell","name":"waiter"}`)
		require.Equal(t, 201, tabResp.Status)
		tabID := tabResp.ID()

		done := make(chan *CLIResult, 1)
		go func() {
			done <- env.CLI("gosok wait --timeout 10s %s", tabID)
		}()

		// Give the CLI subscription a moment to be in place; otherwise the
		// message arrives before `wait` registers and the send is dropped.
		time.Sleep(500 * time.Millisecond)
		msgBody, _ := json.Marshal(map[string]string{
			"scope":     "direct",
			"to_tab_id": tabID,
			"body":      "wake-up",
		})
		msgResp := env.HTTP("POST", "/api/v1/messages", string(msgBody))
		require.Equal(t, 201, msgResp.Status)

		select {
		case res := <-done:
			assert.Equal(t, 0, res.ExitCode, "expected exit 0 after receiving message; stderr: %s", res.Stderr)
			assert.Contains(t, res.Stdout, "wake-up", "expected stdout to contain 'wake-up'")
		case <-time.After(15 * time.Second):
			t.Fatal("timed out waiting for gosok wait to return")
		}
	})

	t.Run("wait with timeout and no message", func(t *testing.T) {
		env := NewTestEnv(t)

		projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"timeout-proj","path":"/tmp/timeout"}`)
		require.Equal(t, 201, projResp.Status)
		projID := projResp.ID()

		tabResp := env.HTTP("POST", fmt.Sprintf("/api/v1/projects/%s/tabs", projID),
			`{"tab_type":"shell","name":"timeout-tab"}`)
		require.Equal(t, 201, tabResp.Status)
		tabID := tabResp.ID()

		// CLI must exit 1 when the deadline passes with no messages, not 0.
		result := env.CLI("gosok wait --timeout 2s %s", tabID)
		assert.Equal(t, 1, result.ExitCode, "expected exit 1 on timeout with no messages; stderr: %s", result.Stderr)
	})
}

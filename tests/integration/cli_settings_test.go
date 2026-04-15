package integration_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSC_CLI_4_SettingsAndNotifications(t *testing.T) {
	env := NewTestEnv(t)

	t.Run("list settings", func(t *testing.T) {
		result := env.CLI("gosok setting list")
		assert.Equal(t, 0, result.ExitCode, "CLI should exit 0; stderr: %s", result.Stderr)
		assert.Contains(t, result.Stdout, "font_size", "stdout should contain font_size")
	})

	t.Run("get setting", func(t *testing.T) {
		result := env.CLI("gosok setting get font_size")
		assert.Equal(t, 0, result.ExitCode, "CLI should exit 0; stderr: %s", result.Stderr)
		assert.Contains(t, result.Stdout, "14", "stdout should contain default value 14")
	})

	t.Run("set setting", func(t *testing.T) {
		setResult := env.CLI("gosok setting set font_size 16")
		assert.Equal(t, 0, setResult.ExitCode, "setting set should exit 0; stderr: %s", setResult.Stderr)

		getResult := env.CLI("gosok setting get font_size")
		assert.Equal(t, 0, getResult.ExitCode, "setting get should exit 0; stderr: %s", getResult.Stderr)
		assert.Contains(t, getResult.Stdout, "16", "stdout should contain updated value 16")
	})

	t.Run("delete setting resets to default", func(t *testing.T) {
		// Set to 20
		setResult := env.CLI("gosok setting set font_size 20")
		assert.Equal(t, 0, setResult.ExitCode, "setting set should exit 0; stderr: %s", setResult.Stderr)

		// Verify it's 20
		getResult := env.CLI("gosok setting get font_size")
		assert.Contains(t, getResult.Stdout, "20", "font_size should be 20 after set")

		// Delete (reset to default)
		deleteResult := env.CLI("gosok setting delete font_size")
		assert.Equal(t, 0, deleteResult.ExitCode, "setting delete should exit 0; stderr: %s", deleteResult.Stderr)

		// Verify back to default 14
		getResult2 := env.CLI("gosok setting get font_size")
		assert.Equal(t, 0, getResult2.ExitCode, "setting get should exit 0; stderr: %s", getResult2.Stderr)
		assert.Contains(t, getResult2.Stdout, "14", "font_size should be back to default 14 after delete")
	})

	t.Run("send notification", func(t *testing.T) {
		result := env.CLI("gosok notify test-alert --body alert-body")
		assert.Equal(t, 0, result.ExitCode, "notify should exit 0; stderr: %s", result.Stderr)
		assert.Contains(t, result.Stdout, "notification sent", "stdout should confirm notification sent")
	})
}

package integration_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSC_CLI_1_ProjectManagement(t *testing.T) {
	t.Run("list projects", func(t *testing.T) {
		env := NewTestEnv(t)

		// Create a project via HTTP
		resp := env.HTTP("POST", "/api/v1/projects", `{"name":"list-test-project","path":"/tmp/list-test"}`)
		require.Equal(t, 201, resp.Status)
		projectName := resp.Get("name")
		require.Equal(t, "list-test-project", projectName)

		// Run gosok ps
		result := env.CLI("gosok ps")
		assert.Equal(t, 0, result.ExitCode, "expected exit 0; stderr: %s", result.Stderr)
		assert.True(t, strings.Contains(result.Stdout, "list-test-project"),
			"expected stdout to contain %q, got: %s", "list-test-project", result.Stdout)
	})

	t.Run("create project", func(t *testing.T) {
		env := NewTestEnv(t)

		// Create project via CLI (flags must come before positional args with Go's flag package)
		result := env.CLI("gosok project create --path /tmp/new new-project")
		assert.Equal(t, 0, result.ExitCode, "expected exit 0; stderr: %s", result.Stderr)

		// Verify via HTTP GET that project exists
		listResp := env.HTTP("GET", "/api/v1/projects")
		require.Equal(t, 200, listResp.Status)

		projects := listResp.Array()
		found := false
		for _, p := range projects {
			if name, _ := p["name"].(string); name == "new-project" {
				found = true
				break
			}
		}
		assert.True(t, found, "expected project 'new-project' to exist after CLI create; projects: %v", projects)
	})

	t.Run("update project", func(t *testing.T) {
		env := NewTestEnv(t)

		// Create project via HTTP
		createResp := env.HTTP("POST", "/api/v1/projects", `{"name":"original-name","path":"/tmp/update-test"}`)
		require.Equal(t, 201, createResp.Status)
		id := createResp.ID()
		require.NotEmpty(t, id, "expected project ID")

		// Update via CLI (flags must come before positional args with Go's flag package)
		result := env.CLI("gosok project update --name updated-name %s", id)
		assert.Equal(t, 0, result.ExitCode, "expected exit 0; stderr: %s", result.Stderr)

		// Verify name changed via HTTP
		getResp := env.HTTP("GET", "/api/v1/projects/"+id)
		require.Equal(t, 200, getResp.Status)
		assert.Equal(t, "updated-name", getResp.Get("name"),
			"expected project name to be 'updated-name', got: %s", getResp.Get("name"))
	})

	t.Run("delete project", func(t *testing.T) {
		env := NewTestEnv(t)

		// Create project via HTTP
		createResp := env.HTTP("POST", "/api/v1/projects", `{"name":"delete-test","path":"/tmp/delete-test"}`)
		require.Equal(t, 201, createResp.Status)
		id := createResp.ID()
		require.NotEmpty(t, id, "expected project ID")

		// Delete via CLI
		result := env.CLI("gosok project delete %s", id)
		assert.Equal(t, 0, result.ExitCode, "expected exit 0; stderr: %s", result.Stderr)

		// Verify 404 via HTTP
		getResp := env.HTTP("GET", "/api/v1/projects/"+id)
		assert.Equal(t, 404, getResp.Status,
			"expected 404 after delete, got: %d", getResp.Status)
	})
}

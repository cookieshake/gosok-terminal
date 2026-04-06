package integration_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSC_API_1_ResponseFormat tests SC.API.1: consistent response format
func TestSC_API_1_ResponseFormat(t *testing.T) {
	t.Run("successful response wraps data", func(t *testing.T) {
		env := NewTestEnv(t)
		resp := env.HTTP("POST", "/api/v1/projects", `{"name":"test-project","path":"/tmp/test-project"}`)
		assert.Equal(t, http.StatusCreated, resp.Status)
		assert.NotEmpty(t, resp.ID())
		assert.Equal(t, "test-project", resp.Get("name"))
	})

	t.Run("list response returns array", func(t *testing.T) {
		env := NewTestEnv(t)
		resp := env.HTTP("GET", "/api/v1/projects")
		assert.Equal(t, http.StatusOK, resp.Status)
		assert.NotNil(t, resp.Array())
	})

	t.Run("not found returns 404", func(t *testing.T) {
		env := NewTestEnv(t)
		resp := env.HTTP("GET", "/api/v1/projects/nonexistent")
		assert.Equal(t, http.StatusNotFound, resp.Status)
	})

	t.Run("invalid JSON returns 400", func(t *testing.T) {
		env := NewTestEnv(t)
		resp := env.HTTP("POST", "/api/v1/projects", `{invalid}`)
		assert.Equal(t, http.StatusBadRequest, resp.Status)
	})
}

// TestSC_API_2_CORS tests SC.API.2: CORS headers
func TestSC_API_2_CORS(t *testing.T) {
	t.Run("CORS headers present", func(t *testing.T) {
		env := NewTestEnv(t)

		req, err := http.NewRequest("GET", env.BaseURL()+"/api/v1/projects", nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, "*", resp.Header.Get("Access-Control-Allow-Origin"))
		allowMethods := resp.Header.Get("Access-Control-Allow-Methods")
		assert.True(t, strings.Contains(allowMethods, "GET"), "Allow-Methods should contain GET, got: %s", allowMethods)
		assert.True(t, strings.Contains(allowMethods, "POST"), "Allow-Methods should contain POST, got: %s", allowMethods)
	})

	t.Run("OPTIONS returns 204", func(t *testing.T) {
		env := NewTestEnv(t)

		req, err := http.NewRequest("OPTIONS", env.BaseURL()+"/api/v1/projects", nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})
}

// TestSC_API_3_HealthCheck tests SC.API.3: health check endpoint
func TestSC_API_3_HealthCheck(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("GET", "/api/v1/health")
	assert.Equal(t, http.StatusOK, resp.Status)
	assert.Equal(t, "ok", resp.Get("status"))
}

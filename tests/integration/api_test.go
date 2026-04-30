package integration_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPI_Health(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("GET", "/api/v1/health")
	require.Equal(t, http.StatusOK, resp.Status)
	require.Equal(t, "ok", resp.Get("status"))
}

func TestAPI_CORSAllowsCrossOrigin(t *testing.T) {
	env := NewTestEnv(t)

	req, err := http.NewRequest("OPTIONS", env.BaseURL()+"/api/v1/projects", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusNoContent, resp.StatusCode)
	require.Equal(t, "*", resp.Header.Get("Access-Control-Allow-Origin"))
	allowMethods := resp.Header.Get("Access-Control-Allow-Methods")
	require.Contains(t, allowMethods, "GET")
	require.Contains(t, allowMethods, "POST")
}

func TestAPI_ProjectRoundTrip(t *testing.T) {
	env := NewTestEnv(t)

	// Create
	created := env.HTTP("POST", "/api/v1/projects", `{"name":"alpha","path":"/tmp/alpha","description":"first"}`)
	require.Equal(t, http.StatusCreated, created.Status)
	id := created.ID()
	require.NotEmpty(t, id, "POST must return an id")
	assert.Equal(t, "alpha", created.Get("name"))

	// Get returns the same record with persisted fields
	got := env.HTTP("GET", "/api/v1/projects/"+id)
	require.Equal(t, http.StatusOK, got.Status)
	assert.Equal(t, "alpha", got.Get("name"))
	assert.Equal(t, "/tmp/alpha", got.Get("path"))
	assert.Equal(t, "first", got.Get("description"))

	// List includes the project
	list := env.HTTP("GET", "/api/v1/projects")
	require.Equal(t, http.StatusOK, list.Status)
	assert.True(t, containsID(list.Array(), id), "list must include just-created project")

	// Update
	updated := env.HTTP("PUT", "/api/v1/projects/"+id, `{"name":"alpha2","path":"/tmp/alpha","description":"renamed"}`)
	require.Equal(t, http.StatusOK, updated.Status)
	assert.Equal(t, "alpha2", updated.Get("name"))

	// Update persisted on next GET
	gotAfter := env.HTTP("GET", "/api/v1/projects/"+id)
	require.Equal(t, http.StatusOK, gotAfter.Status)
	assert.Equal(t, "alpha2", gotAfter.Get("name"))
	assert.Equal(t, "renamed", gotAfter.Get("description"))

	// Delete
	deleted := env.HTTP("DELETE", "/api/v1/projects/"+id)
	require.Equal(t, http.StatusNoContent, deleted.Status)

	// Subsequent GET is 404
	gone := env.HTTP("GET", "/api/v1/projects/"+id)
	assert.Equal(t, http.StatusNotFound, gone.Status)
}

func TestAPI_ProjectInvalidJSON(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("POST", "/api/v1/projects", `{not-json}`)
	require.Equal(t, http.StatusBadRequest, resp.Status)
}

func TestAPI_ProjectGetUnknown(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("GET", "/api/v1/projects/01HXNOTEXIST00000000000000")
	require.Equal(t, http.StatusNotFound, resp.Status)
}

func TestAPI_DeletingProjectCascadesToTabs(t *testing.T) {
	env := NewTestEnv(t)

	proj := env.HTTP("POST", "/api/v1/projects", `{"name":"with-tabs","path":"/tmp/with-tabs"}`)
	require.Equal(t, http.StatusCreated, proj.Status)
	pid := proj.ID()

	tab := env.HTTP("POST", "/api/v1/projects/"+pid+"/tabs", `{"name":"orphan","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, tab.Status)
	tid := tab.ID()
	require.NotEmpty(t, tid)

	require.Equal(t, http.StatusNoContent, env.HTTP("DELETE", "/api/v1/projects/"+pid).Status)

	// Tab must be gone too — a project's tabs must not outlive it.
	gone := env.HTTP("GET", "/api/v1/tabs/"+tid)
	assert.Equal(t, http.StatusNotFound, gone.Status,
		"tab should be cascade-deleted with its parent project")
}

func TestAPI_TabRoundTrip(t *testing.T) {
	env := NewTestEnv(t)

	proj := env.HTTP("POST", "/api/v1/projects", `{"name":"tab-rt","path":"/tmp/tab-rt"}`)
	require.Equal(t, http.StatusCreated, proj.Status)
	pid := proj.ID()

	created := env.HTTP("POST", "/api/v1/projects/"+pid+"/tabs", `{"name":"first","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, created.Status)
	tid := created.ID()
	require.NotEmpty(t, tid)

	got := env.HTTP("GET", "/api/v1/tabs/"+tid)
	require.Equal(t, http.StatusOK, got.Status)
	assert.Equal(t, "first", got.Get("name"))
	assert.Equal(t, "shell", got.Get("tab_type"))

	// List under the parent project includes it.
	list := env.HTTP("GET", "/api/v1/projects/"+pid+"/tabs")
	require.Equal(t, http.StatusOK, list.Status)
	assert.True(t, containsID(list.Array(), tid))

	// Update name.
	upd := env.HTTP("PUT", "/api/v1/tabs/"+tid, `{"name":"renamed","tab_type":"shell"}`)
	require.Equal(t, http.StatusOK, upd.Status)
	assert.Equal(t, "renamed", env.HTTP("GET", "/api/v1/tabs/"+tid).Get("name"))

	// Delete.
	require.Equal(t, http.StatusNoContent, env.HTTP("DELETE", "/api/v1/tabs/"+tid).Status)
	assert.Equal(t, http.StatusNotFound, env.HTTP("GET", "/api/v1/tabs/"+tid).Status)
}

func TestAPI_SettingDefaultAndOverride(t *testing.T) {
	env := NewTestEnv(t)

	// On a fresh DB the default font_size is 14; reads must return it
	// without an explicit PUT.
	def := env.HTTP("GET", "/api/v1/settings/terminal_font_size")
	require.Equal(t, http.StatusOK, def.Status, "default must be readable; body: %s", def.Body())
	assert.Contains(t, def.Body(), "14", "default font_size should be 14")

	// Override.
	require.Equal(t, http.StatusOK,
		env.HTTP("PUT", "/api/v1/settings/terminal_font_size", `{"value":18}`).Status)
	override := env.HTTP("GET", "/api/v1/settings/terminal_font_size")
	require.Equal(t, http.StatusOK, override.Status)
	assert.Contains(t, override.Body(), "18", "override should be returned: %s", override.Body())

	// Delete restores default. The endpoint returns 200 with the default value
	// rather than 204 — clients can use the response directly without a re-read.
	deleted := env.HTTP("DELETE", "/api/v1/settings/terminal_font_size")
	require.Equal(t, http.StatusOK, deleted.Status)
	assert.Contains(t, deleted.Body(), "14", "DELETE should echo the restored default")
	restored := env.HTTP("GET", "/api/v1/settings/terminal_font_size")
	require.Equal(t, http.StatusOK, restored.Status)
	assert.Contains(t, restored.Body(), "14", "default should be restored after delete: %s", restored.Body())
}

func TestAPI_MessageDirectInbox(t *testing.T) {
	env := NewTestEnv(t)

	proj := env.HTTP("POST", "/api/v1/projects", `{"name":"msg-rt","path":"/tmp/msg-rt"}`)
	require.Equal(t, http.StatusCreated, proj.Status)
	pid := proj.ID()
	from := env.HTTP("POST", "/api/v1/projects/"+pid+"/tabs", `{"name":"sender","tab_type":"shell"}`).ID()
	to := env.HTTP("POST", "/api/v1/projects/"+pid+"/tabs", `{"name":"receiver","tab_type":"shell"}`).ID()
	require.NotEmpty(t, from)
	require.NotEmpty(t, to)

	body := fmt.Sprintf(`{"scope":"direct","from_tab_id":%q,"to_tab_id":%q,"body":"hello-direct"}`, from, to)
	created := env.HTTP("POST", "/api/v1/messages", body)
	require.Equal(t, http.StatusCreated, created.Status)

	inbox := env.HTTP("GET", "/api/v1/messages/inbox/"+to)
	require.Equal(t, http.StatusOK, inbox.Status)
	require.True(t, anyBody(inbox.Array(), "hello-direct"),
		"inbox of recipient should contain the direct message")

	// The sender's inbox must not see its own outgoing direct message.
	otherInbox := env.HTTP("GET", "/api/v1/messages/inbox/"+from)
	require.Equal(t, http.StatusOK, otherInbox.Status)
	assert.False(t, anyBody(otherInbox.Array(), "hello-direct"),
		"sender's inbox must not contain its own outgoing direct message")
}

func TestAPI_MessageDirectMissingRecipient(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("POST", "/api/v1/messages",
		`{"scope":"direct","body":"no-target"}`)
	assert.Equal(t, http.StatusBadRequest, resp.Status,
		"direct without to_tab_id must be rejected; got %d body=%s", resp.Status, resp.Body())
}

func TestAPI_MessageInvalidScope(t *testing.T) {
	env := NewTestEnv(t)
	resp := env.HTTP("POST", "/api/v1/messages", `{"scope":"private","body":"x"}`)
	assert.Equal(t, http.StatusBadRequest, resp.Status,
		"unknown scope must be rejected; got %d body=%s", resp.Status, resp.Body())
}

func containsID(items []map[string]any, id string) bool {
	for _, it := range items {
		if got, _ := it["id"].(string); got == id {
			return true
		}
	}
	return false
}

func anyBody(items []map[string]any, body string) bool {
	for _, it := range items {
		if got, _ := it["body"].(string); strings.Contains(got, body) {
			return true
		}
	}
	return false
}

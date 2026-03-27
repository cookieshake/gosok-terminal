package tab

type TabType string

const (
	Shell      TabType = "shell"
	ClaudeCode TabType = "claude-code"
	Codex      TabType = "codex"
	GeminiCLI  TabType = "gemini-cli"
	OpenCode   TabType = "opencode"
)

type TabDef struct {
	Command     string
	DefaultArgs []string
	DisplayName string
}

var Registry = map[TabType]TabDef{
	Shell: {Command: "", DefaultArgs: []string{}, DisplayName: "Shell"},
}

type Status string

const (
	StatusStopped  Status = "stopped"
	StatusRunning  Status = "running"
	StatusStarting Status = "starting"
)

type TabStatus struct {
	TabID        string `json:"tab_id"`
	Status       Status `json:"status"`
	SessionID    string `json:"session_id,omitempty"`
	LastActivity int64  `json:"last_activity,omitempty"` // UnixMilli; 0 = no output yet
}

// ValidTabType returns true if the given type is known.
func ValidTabType(t string) bool {
	_, ok := Registry[TabType(t)]
	return ok
}

package agent

type AgentType string

const (
	Shell      AgentType = "shell"
	ClaudeCode AgentType = "claude-code"
	Codex      AgentType = "codex"
	GeminiCLI  AgentType = "gemini-cli"
	OpenCode   AgentType = "opencode"
)

type AgentDef struct {
	Command     string
	DefaultArgs []string
	DisplayName string
}

var Registry = map[AgentType]AgentDef{
	Shell:      {Command: "", DefaultArgs: []string{}, DisplayName: "Shell"},
	ClaudeCode: {Command: "claude", DefaultArgs: []string{}, DisplayName: "Claude Code"},
	Codex:      {Command: "codex", DefaultArgs: []string{}, DisplayName: "Codex"},
	GeminiCLI:  {Command: "gemini", DefaultArgs: []string{}, DisplayName: "Gemini CLI"},
	OpenCode:   {Command: "opencode", DefaultArgs: []string{}, DisplayName: "OpenCode"},
}

type Status string

const (
	StatusStopped  Status = "stopped"
	StatusRunning  Status = "running"
	StatusStarting Status = "starting"
)

type AgentStatus struct {
	AgentID   string `json:"agent_id"`
	Status    Status `json:"status"`
	SessionID string `json:"session_id,omitempty"`
}

// ValidAgentType returns true if the given type is known.
func ValidAgentType(t string) bool {
	_, ok := Registry[AgentType(t)]
	return ok
}

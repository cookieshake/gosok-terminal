package tab

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

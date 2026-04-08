package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func apiURL() string {
	u := os.Getenv("GOSOK_API_URL")
	if u == "" {
		u = "http://localhost:18435"
	}
	return strings.TrimRight(u, "/")
}

func tabID() string {
	return os.Getenv("GOSOK_TAB_ID")
}

func runSend(args []string) {
	fs := flag.NewFlagSet("send", flag.ExitOnError)
	all := fs.Bool("all", false, "broadcast to all tabs")
	fs.Parse(args)

	remaining := fs.Args()

	var body map[string]string

	if *all {
		if len(remaining) < 1 {
			fmt.Fprintln(os.Stderr, "usage: gosok send --all <message>")
			os.Exit(1)
		}
		body = map[string]string{
			"scope":       "broadcast",
			"from_tab_id": tabID(),
			"body":        strings.Join(remaining, " "),
		}
	} else {
		if len(remaining) < 2 {
			fmt.Fprintln(os.Stderr, "usage: gosok send <tab-id> <message>")
			os.Exit(1)
		}
		body = map[string]string{
			"scope":       "direct",
			"from_tab_id": tabID(),
			"to_tab_id":   remaining[0],
			"body":        strings.Join(remaining[1:], " "),
		}
	}

	resp, err := postJSON(apiURL()+"/api/v1/messages", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}
	fmt.Println("sent")
}

func runFeed(args []string) {
	if len(args) > 0 && args[0] != "" && !strings.HasPrefix(args[0], "-") {
		// Post to global feed
		body := map[string]string{
			"scope":       "global",
			"from_tab_id": tabID(),
			"body":        strings.Join(args, " "),
		}
		resp, err := postJSON(apiURL()+"/api/v1/messages", body)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			fmt.Fprintf(os.Stderr, "error: %s\n", b)
			os.Exit(1)
		}
		fmt.Println("posted")
		return
	}

	// Read global feed
	resp, err := http.Get(apiURL() + "/api/v1/messages/feed")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	printMessages(resp.Body)
}

func runInbox(args []string) {
	tid := tabID()
	if len(args) > 0 && args[0] != "" {
		tid = args[0]
	}
	if tid == "" {
		fmt.Fprintln(os.Stderr, "error: GOSOK_TAB_ID not set and no tab-id provided")
		os.Exit(1)
	}

	resp, err := http.Get(apiURL() + "/api/v1/messages/inbox/" + tid)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	printMessages(resp.Body)
}

func runWait(args []string) {
	fs := flag.NewFlagSet("wait", flag.ExitOnError)
	timeout := fs.String("timeout", "30s", "timeout duration (e.g. 10s, 1m, 5m)")
	fs.Parse(args)

	remaining := fs.Args()
	tid := tabID()
	if len(remaining) > 0 && remaining[0] != "" {
		tid = remaining[0]
	}
	if tid == "" {
		fmt.Fprintln(os.Stderr, "error: GOSOK_TAB_ID not set and no tab-id provided")
		os.Exit(1)
	}

	url := fmt.Sprintf("%s/api/v1/messages/inbox/%s/wait?timeout=%s", apiURL(), tid, *timeout)
	resp, err := http.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	var msgs []cliMessage
	if err := json.NewDecoder(resp.Body).Decode(&msgs); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	if len(msgs) == 0 {
		os.Exit(1)
	}
	for _, m := range msgs {
		ts := m.CreatedAt.Local().Format("15:04:05")
		from := m.FromTabID
		if from == "" {
			from = "system"
		}
		if len(from) > 8 {
			from = from[:8]
		}
		fmt.Printf("[%s] <%s> [%s] %s\n", ts, from, m.Scope, m.Body)
	}
}

func runNotify(args []string) {
	var body string
	var flagged bool
	var titleParts []string

	for i := 0; i < len(args); i++ {
		if (args[i] == "--body" || args[i] == "-body") && i+1 < len(args) {
			body = args[i+1]
			i++ // skip next
		} else if args[i] == "--flag" || args[i] == "-flag" {
			flagged = true
		} else {
			titleParts = append(titleParts, args[i])
		}
	}

	if len(titleParts) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok notify <title> [--body <body>] [--flag]")
		os.Exit(1)
	}

	payload := map[string]any{
		"title":  strings.Join(titleParts, " "),
		"body":   body,
		"tab_id": tabID(),
		"flag":   flagged,
	}

	resp, err := postJSON(apiURL()+"/api/v1/notify", payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}
	fmt.Println("notification sent")
}

func runProject(args []string) {
	if len(args) == 0 {
		runProjects()
		return
	}
	switch args[0] {
	case "create":
		runProjectCreate(args[1:])
	case "update":
		runProjectUpdate(args[1:])
	case "delete":
		runProjectDelete(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "unknown project subcommand: %s\n", args[0])
		os.Exit(1)
	}
}

func runProjectCreate(args []string) {
	fs := flag.NewFlagSet("project create", flag.ExitOnError)
	path := fs.String("path", "", "project directory path")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 || *path == "" {
		fmt.Fprintln(os.Stderr, "usage: gosok project create <name> --path <dir>")
		os.Exit(1)
	}

	body := map[string]string{"name": remaining[0], "path": *path}
	resp, err := postJSON(apiURL()+"/api/v1/projects", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var p struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Path string `json:"path"`
	}
	json.NewDecoder(resp.Body).Decode(&p)
	fmt.Printf("created %-28s %s (%s)\n", p.ID, p.Name, p.Path)
}

func runProjectUpdate(args []string) {
	fs := flag.NewFlagSet("project update", flag.ExitOnError)
	name := fs.String("name", "", "new name")
	path := fs.String("path", "", "new path")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok project update <id> --name <name> --path <dir>")
		os.Exit(1)
	}

	body := map[string]string{}
	if *name != "" {
		body["name"] = *name
	}
	if *path != "" {
		body["path"] = *path
	}

	resp, err := putJSON(apiURL()+"/api/v1/projects/"+remaining[0], body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var p struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Path string `json:"path"`
	}
	json.NewDecoder(resp.Body).Decode(&p)
	fmt.Printf("updated %-28s %s (%s)\n", p.ID, p.Name, p.Path)
}

func runProjectDelete(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok project delete <id>")
		os.Exit(1)
	}
	resp, err := doDelete(apiURL() + "/api/v1/projects/" + args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)
	fmt.Printf("deleted %s\n", args[0])
}

func runProjects() {
	resp, err := http.Get(apiURL() + "/api/v1/projects")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	var projects []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Path string `json:"path"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&projects); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	if len(projects) == 0 {
		fmt.Println("no projects")
		return
	}
	for _, p := range projects {
		fmt.Printf("%-28s %s (%s)\n", p.ID, p.Name, p.Path)
	}
}

func runTab(args []string) {
	if len(args) == 0 {
		runTabs(nil)
		return
	}
	switch args[0] {
	case "create":
		runTabCreate(args[1:])
	case "update":
		runTabUpdate(args[1:])
	case "delete":
		runTabDelete(args[1:])
	case "start":
		runTabStart(args[1:])
	case "stop":
		runTabStop(args[1:])
	default:
		// Not a subcommand — treat as project filter for tab listing
		runTabs(args)
	}
}

func runTabCreate(args []string) {
	fs := flag.NewFlagSet("tab create", flag.ExitOnError)
	name := fs.String("name", "", "tab name")
	tabType := fs.String("type", "shell", "tab type")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok tab create <project-id> --name <name> --type <shell>")
		os.Exit(1)
	}

	body := map[string]string{"tab_type": *tabType}
	if *name != "" {
		body["name"] = *name
	}

	resp, err := postJSON(apiURL()+"/api/v1/projects/"+remaining[0]+"/tabs", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var t struct {
		ID        string `json:"id"`
		ProjectID string `json:"project_id"`
		Name      string `json:"name"`
	}
	json.NewDecoder(resp.Body).Decode(&t)
	fmt.Printf("created %-28s %s\n", t.ID, t.Name)
}

func runTabUpdate(args []string) {
	fs := flag.NewFlagSet("tab update", flag.ExitOnError)
	name := fs.String("name", "", "new name")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok tab update <id> --name <name>")
		os.Exit(1)
	}

	body := map[string]string{}
	if *name != "" {
		body["name"] = *name
	}

	resp, err := putJSON(apiURL()+"/api/v1/tabs/"+remaining[0], body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var t struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	json.NewDecoder(resp.Body).Decode(&t)
	fmt.Printf("updated %-28s %s\n", t.ID, t.Name)
}

func runTabDelete(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok tab delete <id>")
		os.Exit(1)
	}
	resp, err := doDelete(apiURL() + "/api/v1/tabs/" + args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)
	fmt.Printf("deleted %s\n", args[0])
}

func runTabStart(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok tab start <id>")
		os.Exit(1)
	}
	resp, err := postJSON(apiURL()+"/api/v1/tabs/"+args[0]+"/start", map[string]string{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var st struct {
		TabID     string `json:"tab_id"`
		Status    string `json:"status"`
		SessionID string `json:"session_id"`
	}
	json.NewDecoder(resp.Body).Decode(&st)
	fmt.Printf("started %-28s %s\n", st.TabID, st.Status)
}

func runTabStop(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok tab stop <id>")
		os.Exit(1)
	}
	resp, err := postJSON(apiURL()+"/api/v1/tabs/"+args[0]+"/stop", map[string]string{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var st struct {
		TabID  string `json:"tab_id"`
		Status string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&st)
	fmt.Printf("stopped %-28s %s\n", st.TabID, st.Status)
}

func runTabs(args []string) {
	// List tabs for a project, or all projects if no arg given
	resp, err := http.Get(apiURL() + "/api/v1/projects")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	var projects []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&projects); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Filter by project name or ID if arg given
	if len(args) > 0 && args[0] != "" {
		query := strings.ToLower(args[0])
		var filtered []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		for _, p := range projects {
			if strings.Contains(strings.ToLower(p.ID), query) || strings.Contains(strings.ToLower(p.Name), query) {
				filtered = append(filtered, p)
			}
		}
		projects = filtered
	}

	if len(projects) == 0 {
		fmt.Println("no matching projects")
		return
	}

	type tabInfo struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Status struct {
			Status string `json:"status"`
		} `json:"status"`
	}

	for _, p := range projects {
		tresp, err := http.Get(apiURL() + "/api/v1/projects/" + p.ID + "/tabs")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error fetching tabs for %s: %v\n", p.Name, err)
			continue
		}
		var tabs []tabInfo
		json.NewDecoder(tresp.Body).Decode(&tabs)
		tresp.Body.Close()

		fmt.Printf("[%s] %s\n", p.ID[:8], p.Name)
		if len(tabs) == 0 {
			fmt.Println("  (no tabs)")
		}
		for _, t := range tabs {
			status := t.Status.Status
			if status == "" {
				status = "stopped"
			}
			fmt.Printf("  %-28s %-20s %s\n", t.ID, t.Name, status)
		}
	}
}

func runSetting(args []string) {
	if len(args) == 0 {
		runSettingList()
		return
	}
	switch args[0] {
	case "list":
		runSettingList()
	case "get":
		runSettingGet(args[1:])
	case "set":
		runSettingSet(args[1:])
	case "delete":
		runSettingDelete(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "unknown setting subcommand: %s\n", args[0])
		os.Exit(1)
	}
}

func runSettingList() {
	resp, err := http.Get(apiURL() + "/api/v1/settings")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	var settings map[string]json.RawMessage
	json.NewDecoder(resp.Body).Decode(&settings)
	if len(settings) == 0 {
		fmt.Println("no settings")
		return
	}
	for k, v := range settings {
		fmt.Printf("%-30s %s\n", k, string(v))
	}
}

func runSettingGet(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok setting get <key>")
		os.Exit(1)
	}
	resp, err := http.Get(apiURL() + "/api/v1/settings/" + args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)

	b, _ := io.ReadAll(resp.Body)
	fmt.Println(string(b))
}

func runSettingSet(args []string) {
	if len(args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: gosok setting set <key> <value>")
		os.Exit(1)
	}

	// Try to parse value as JSON; if it fails, treat as string
	var value any
	if err := json.Unmarshal([]byte(args[1]), &value); err != nil {
		value = args[1]
	}

	body := map[string]any{"value": value}
	resp, err := putJSON(apiURL()+"/api/v1/settings/"+args[0], body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)
	fmt.Printf("set %s\n", args[0])
}

func runSettingDelete(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok setting delete <key>")
		os.Exit(1)
	}
	resp, err := doDelete(apiURL() + "/api/v1/settings/" + args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)
	fmt.Printf("reset %s to default\n", args[0])
}

func runScreen(args []string) {
	fs := flag.NewFlagSet("screen", flag.ExitOnError)
	lines := fs.Int("lines", 0, "number of lines (default 24)")
	bytesN := fs.Int("bytes", 0, "number of bytes")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok screen <tab-id> [--lines N] [--bytes N]")
		os.Exit(1)
	}

	url := apiURL() + "/api/v1/tabs/" + remaining[0] + "/screen"
	if *bytesN > 0 {
		url += fmt.Sprintf("?bytes=%d", *bytesN)
	} else if *lines > 0 {
		url += fmt.Sprintf("?lines=%d", *lines)
	}

	resp, err := http.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}

	io.Copy(os.Stdout, resp.Body)
}

func runWrite(args []string) {
	if len(args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: gosok write <tab-id> <text>")
		os.Exit(1)
	}

	tabID := args[0]
	text := strings.Join(args[1:], " ") + "\n"

	body := map[string]string{"input": text}
	resp, err := postJSON(apiURL()+"/api/v1/tabs/"+tabID+"/write", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}
	fmt.Println("sent")
}

func runInboxRead(args []string) {
	tid := tabID()
	if len(args) > 0 && args[0] != "" {
		tid = args[0]
	}
	if tid == "" {
		fmt.Fprintln(os.Stderr, "error: GOSOK_TAB_ID not set and no tab-id provided")
		os.Exit(1)
	}

	resp, err := putJSON(apiURL()+"/api/v1/messages/inbox/"+tid+"/read", map[string]string{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	checkResp(resp)
	fmt.Println("marked as read")
}

func printHelp() {
	fmt.Print(`gosok — terminal multiplexer with agent messaging

COMMANDS
  (no args)                       Start the gosok server

  projects (ps)                   List all projects
  project create <name> --path <dir>  Create a project
  project update <id> [--name N] [--path P]  Update a project
  project delete <id>             Delete a project

  tabs (ls) [project]             List tabs (optionally filter by project name/ID)
  tab create <project-id> [--name N] [--type shell]  Create a tab
  tab update <id> --name <name>   Update a tab
  tab delete <id>                 Delete a tab
  tab start <id>                  Start a tab
  tab stop <id>                   Stop a tab

  setting list                    List all settings
  setting get <key>               Get a setting value
  setting set <key> <value>       Set a setting value
  setting delete <key>            Reset a setting to default

  screen <tab-id> [--lines N] [--bytes N]  Read tab terminal output (default: 24 lines)
  write <tab-id> <text>           Write text to a tab's terminal (appends newline)

  send <tab-id> <message>         Send a direct message to a tab
  send --all <message>            Broadcast a message to all tabs
  feed <message>                  Post a message to the global feed
  feed                            Read the global feed
  inbox [tab-id]                  Read messages for a tab (defaults to $GOSOK_TAB_ID)
  inbox read [tab-id]             Mark inbox as read
  wait [--timeout 30s] [tab-id]   Wait for next inbox message (exit 0 on msg, 1 on timeout)
  notify <title> [--body <text>] [--flag]  Send a notification (--flag highlights tab dot)
  help                            Show this help

ENVIRONMENT
  GOSOK_TAB_ID    Current tab ID (auto-injected in gosok tabs)
  GOSOK_API_URL   Server URL (auto-injected, default http://localhost:18435)
  GOSOK_HOST      Bind address (default 127.0.0.1, use 0.0.0.0 to expose externally)
  GOSOK_PORT      Server port (default 18435)
  GOSOK_DB_PATH   Database path (default ~/.gosok/gosok.db)

EXAMPLES
  gosok project create my-app --path /code/my-app
  gosok tab create 01ABC123 --name "test-runner"
  gosok tab start 01ABC123
  gosok send 01ABC123 "npm test"
  gosok wait --timeout 1m
  gosok setting set terminal_font_size 16
  gosok projects
  gosok tabs myproject
`)
}

func postJSON(url string, data any) (*http.Response, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return http.Post(url, "application/json", bytes.NewReader(b))
}

func putJSON(url string, data any) (*http.Response, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

func doDelete(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

func checkResp(resp *http.Response) {
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}
}

type cliMessage struct {
	ID        string    `json:"id"`
	Scope     string    `json:"scope"`
	FromTabID string    `json:"from_tab_id"`
	ToTabID   string    `json:"to_tab_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

func printMessages(r io.Reader) {
	var msgs []cliMessage
	if err := json.NewDecoder(r).Decode(&msgs); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	if len(msgs) == 0 {
		fmt.Println("no messages")
		return
	}
	for _, m := range msgs {
		ts := m.CreatedAt.Local().Format("15:04:05")
		from := m.FromTabID
		if from == "" {
			from = "system"
		}
		if len(from) > 8 {
			from = from[:8]
		}
		fmt.Printf("[%s] <%s> [%s] %s\n", ts, from, m.Scope, m.Body)
	}
}

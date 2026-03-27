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

func runNotify(args []string) {
	fs := flag.NewFlagSet("notify", flag.ExitOnError)
	body := fs.String("body", "", "notification body")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok notify <title> [--body <body>]")
		os.Exit(1)
	}

	payload := map[string]string{
		"title":  strings.Join(remaining, " "),
		"body":   *body,
		"tab_id": tabID(),
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

func printHelp() {
	fmt.Print(`gosok — terminal multiplexer with agent messaging

COMMANDS
  (no args)                       Start the gosok server

  send <tab-id> <message>         Send a direct message to a tab
  send --all <message>            Broadcast a message to all tabs
  feed <message>                  Post a message to the global feed
  feed                            Read the global feed
  inbox [tab-id]                  Read messages for a tab (defaults to $GOSOK_TAB_ID)
  notify <title> [--body <text>]  Send a browser notification
  help                            Show this help

ENVIRONMENT
  GOSOK_TAB_ID    Current tab ID (auto-injected in gosok tabs)
  GOSOK_API_URL   Server URL (auto-injected, default http://localhost:18435)
  GOSOK_PORT      Server port (default 18435)
  GOSOK_DB_PATH   Database path (default ~/.gosok/gosok.db)

EXAMPLES
  gosok send 01J3X7K "build done"
  gosok send --all "DB migration complete"
  gosok feed "v2.1 release ready"
  gosok inbox
  gosok notify "Build Complete" --body "Project X build succeeded"
`)
}

func postJSON(url string, data any) (*http.Response, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return http.Post(url, "application/json", bytes.NewReader(b))
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

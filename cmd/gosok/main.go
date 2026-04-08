package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"time"

	"github.com/cookieshake/gosok-terminal/internal/api"
	"github.com/cookieshake/gosok-terminal/internal/messaging"
	"github.com/cookieshake/gosok-terminal/internal/server"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

//go:embed all:dist
var frontendDist embed.FS

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "send":
			runSend(os.Args[2:])
			return
		case "feed":
			runFeed(os.Args[2:])
			return
		case "inbox":
			if len(os.Args) > 2 && os.Args[2] == "read" {
				runInboxRead(os.Args[3:])
				return
			}
			runInbox(os.Args[2:])
			return
		case "wait":
			runWait(os.Args[2:])
			return
		case "notify":
			runNotify(os.Args[2:])
			return
		case "project":
			runProject(os.Args[2:])
			return
		case "projects", "ps":
			runProjects()
			return
		case "tab":
			runTab(os.Args[2:])
			return
		case "tabs", "ls":
			runTabs(os.Args[2:])
			return
		case "screen":
			runScreen(os.Args[2:])
			return
		case "write":
			runWrite(os.Args[2:])
			return
		case "setting":
			runSetting(os.Args[2:])
			return
		case "help":
			printHelp()
			return
		}
	}

	host := os.Getenv("GOSOK_HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	port := os.Getenv("GOSOK_PORT")
	if port == "" {
		port = "18435"
	}

	// Database path
	dbPath := os.Getenv("GOSOK_DB_PATH")
	if dbPath == "" {
		home, _ := os.UserHomeDir()
		dbDir := filepath.Join(home, ".gosok")
		os.MkdirAll(dbDir, 0755)
		dbPath = filepath.Join(dbDir, "gosok.db")
	}

	// Initialize store
	s, err := store.NewSQLite(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer s.Close()

	// Initialize default settings (insert only if key is absent)
	ctx := context.Background()
	for key, defVal := range api.DefaultSettings {
		existing, err := s.GetSetting(ctx, key)
		if err != nil {
			log.Printf("warn: check setting %s: %v", key, err)
			continue
		}
		if existing == "" {
			if err := s.SetSetting(ctx, key, defVal); err != nil {
				log.Printf("warn: init setting %s: %v", key, err)
			}
		}
	}

	// Message cleanup loop (purge messages older than 7 days, every 24h)
	messaging.StartCleanupLoop(ctx, s, 24*time.Hour, 7*24*time.Hour)

	// Serve embedded frontend
	distFS, err := fs.Sub(frontendDist, "dist")
	if err != nil {
		log.Fatalf("failed to load frontend: %v", err)
	}

	srv := server.New(s, distFS)

	httpSrv := &http.Server{
		Addr:    host + ":" + port,
		Handler: srv,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		fmt.Println("\nshutting down...")
		srv.TabSvc.StopAll(context.Background())
		httpSrv.Close()
	}()

	fmt.Printf("gosok-terminal server starting on %s\n", host+":"+port)
	fmt.Printf("database: %s\n", dbPath)
	if err := httpSrv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

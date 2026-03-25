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

	"github.com/cookieshake/gosok-terminal/internal/api"
	"github.com/cookieshake/gosok-terminal/internal/server"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

//go:embed all:dist
var frontendDist embed.FS

func main() {
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

	// Serve embedded frontend
	distFS, err := fs.Sub(frontendDist, "dist")
	if err != nil {
		log.Fatalf("failed to load frontend: %v", err)
	}

	srv := server.New(s, distFS)

	httpSrv := &http.Server{
		Addr:    ":" + port,
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

	fmt.Printf("gosok-terminal server starting on :%s\n", port)
	fmt.Printf("database: %s\n", dbPath)
	if err := httpSrv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

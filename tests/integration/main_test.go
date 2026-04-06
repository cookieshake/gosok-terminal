package integration_test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

var gosokBin string

func TestMain(m *testing.M) {
	tmp, err := os.MkdirTemp("", "gosok-test-bin-*")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create temp dir: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(tmp)

	gosokBin = filepath.Join(tmp, "gosok")

	build := exec.Command("go", "build", "-o", gosokBin, "./cmd/gosok/")
	build.Dir = filepath.Join("..", "..")
	build.Stdout = os.Stdout
	build.Stderr = os.Stderr
	if err := build.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to build gosok: %v\n", err)
		os.Exit(1)
	}

	os.Exit(m.Run())
}

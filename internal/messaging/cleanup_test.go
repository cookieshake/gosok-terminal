package messaging

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

// fakeStore records calls to PurgeOldMessages and returns canned values.
// Other Store methods are not exercised by the cleanup loop, so they panic.
type fakeStore struct {
	mu    sync.Mutex
	calls []time.Time
	n     int64
	err   error
}

func (f *fakeStore) PurgeOldMessages(_ context.Context, before time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, before)
	return f.n, f.err
}

func (f *fakeStore) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func (f *fakeStore) lastCutoff() time.Time {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[len(f.calls)-1]
}

// All other Store methods — cleanup loop never calls them.
func (f *fakeStore) Close() error                                               { panic("unused") }
func (f *fakeStore) CreateProject(context.Context, *store.Project) error        { panic("unused") }
func (f *fakeStore) GetProject(context.Context, string) (*store.Project, error) { panic("unused") }
func (f *fakeStore) ListProjects(context.Context) ([]*store.Project, error)     { panic("unused") }
func (f *fakeStore) UpdateProject(context.Context, *store.Project) error        { panic("unused") }
func (f *fakeStore) DeleteProject(context.Context, string) error                { panic("unused") }
func (f *fakeStore) ReorderProjects(context.Context, []string) error            { panic("unused") }
func (f *fakeStore) CreateTab(context.Context, *store.Tab) error                { panic("unused") }
func (f *fakeStore) GetTab(context.Context, string) (*store.Tab, error)         { panic("unused") }
func (f *fakeStore) ListTabsByProject(context.Context, string) ([]*store.Tab, error) {
	panic("unused")
}
func (f *fakeStore) UpdateTab(context.Context, *store.Tab) error          { panic("unused") }
func (f *fakeStore) UpdateTabTitle(context.Context, string, string) error { panic("unused") }
func (f *fakeStore) DeleteTab(context.Context, string) error              { panic("unused") }
func (f *fakeStore) ReorderTabs(context.Context, []string) error          { panic("unused") }
func (f *fakeStore) CreateMessage(context.Context, *store.Message) error  { panic("unused") }
func (f *fakeStore) GetInbox(context.Context, string, string) ([]*store.Message, error) {
	panic("unused")
}
func (f *fakeStore) GetFeed(context.Context, string) ([]*store.Message, error)   { panic("unused") }
func (f *fakeStore) UpdateReadMarker(context.Context, string, string, string) error {
	panic("unused")
}
func (f *fakeStore) GetReadMarker(context.Context, string, string) (string, error) {
	panic("unused")
}
func (f *fakeStore) GetSetting(context.Context, string) (string, error)      { panic("unused") }
func (f *fakeStore) SetSetting(context.Context, string, string) error        { panic("unused") }
func (f *fakeStore) ListSettings(context.Context) (map[string]string, error) { panic("unused") }
func (f *fakeStore) DeleteSetting(context.Context, string) error             { panic("unused") }

func TestCleanupRunsImmediately(t *testing.T) {
	f := &fakeStore{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartCleanupLoop(ctx, f, time.Hour, 7*24*time.Hour)

	if got := f.callCount(); got != 1 {
		t.Fatalf("expected one immediate purge, got %d", got)
	}
}

func TestCleanupCutoffIsNowMinusTTL(t *testing.T) {
	f := &fakeStore{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	const ttl = 7 * 24 * time.Hour
	before := time.Now()
	StartCleanupLoop(ctx, f, time.Hour, ttl)
	after := time.Now()

	cutoff := f.lastCutoff()
	expectedMin := before.Add(-ttl)
	expectedMax := after.Add(-ttl)
	if cutoff.Before(expectedMin) || cutoff.After(expectedMax) {
		t.Fatalf("cutoff %v not within [%v, %v]", cutoff, expectedMin, expectedMax)
	}
}

func TestCleanupTickerFires(t *testing.T) {
	f := &fakeStore{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartCleanupLoop(ctx, f, 20*time.Millisecond, time.Hour)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if f.callCount() >= 3 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("ticker fired only %d times in 2s; expected ≥ 3", f.callCount())
}

func TestCleanupContextCancelStopsLoop(t *testing.T) {
	f := &fakeStore{}
	ctx, cancel := context.WithCancel(context.Background())

	StartCleanupLoop(ctx, f, 10*time.Millisecond, time.Hour)

	// Wait for at least one tick beyond the immediate call.
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) && f.callCount() < 2 {
		time.Sleep(5 * time.Millisecond)
	}
	cancel()

	// Snapshot count, then ensure no further calls happen.
	stable := f.callCount()
	time.Sleep(80 * time.Millisecond)
	if got := f.callCount(); got != stable {
		t.Fatalf("ticker continued after context cancel: %d → %d", stable, got)
	}
}

func TestCleanupContinuesAfterPurgeError(t *testing.T) {
	var failures atomic.Int64
	f := &fakeStore{err: errors.New("boom")}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	StartCleanupLoop(ctx, f, 15*time.Millisecond, time.Hour)

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if f.callCount() >= 3 {
			return
		}
		failures.Add(1)
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("loop stopped after error; only %d calls", f.callCount())
}

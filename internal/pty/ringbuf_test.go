package pty

import (
	"bytes"
	"sync"
	"testing"
)

func TestRingBufferEmpty(t *testing.T) {
	r := newRingBuffer(16)
	if got := r.Offset(); got != 0 {
		t.Fatalf("Offset on empty = %d, want 0", got)
	}
	if got := r.Bytes(); len(got) != 0 {
		t.Fatalf("Bytes on empty = %q, want empty", got)
	}
}

func TestRingBufferWriteSmaller(t *testing.T) {
	r := newRingBuffer(16)
	if _, err := r.Write([]byte("hello")); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if got := r.Offset(); got != 5 {
		t.Fatalf("Offset = %d, want 5", got)
	}
	if got := r.Bytes(); !bytes.Equal(got, []byte("hello")) {
		t.Fatalf("Bytes = %q, want %q", got, "hello")
	}
}

func TestRingBufferWriteExactCapacity(t *testing.T) {
	r := newRingBuffer(4)
	_, _ = r.Write([]byte("abcd"))
	if got := r.Bytes(); !bytes.Equal(got, []byte("abcd")) {
		t.Fatalf("Bytes after exact-fit write = %q, want %q", got, "abcd")
	}
	_, _ = r.Write([]byte("ef"))
	if got := r.Bytes(); !bytes.Equal(got, []byte("cdef")) {
		t.Fatalf("Bytes after wrap = %q, want %q", got, "cdef")
	}
	if got := r.Offset(); got != 6 {
		t.Fatalf("Offset = %d, want 6", got)
	}
}

func TestRingBufferWriteLargerThanCapacity(t *testing.T) {
	r := newRingBuffer(4)
	_, _ = r.Write([]byte("abcdefghij"))
	if got := r.Bytes(); !bytes.Equal(got, []byte("ghij")) {
		t.Fatalf("Bytes after oversized write = %q, want last 4 bytes %q", got, "ghij")
	}
	if got := r.Offset(); got != 10 {
		t.Fatalf("Offset after oversized write = %d, want 10", got)
	}
}

func TestRingBufferWriteSpansWrap(t *testing.T) {
	r := newRingBuffer(6)
	_, _ = r.Write([]byte("abcde"))
	_, _ = r.Write([]byte("fghij"))
	if got := r.Bytes(); !bytes.Equal(got, []byte("efghij")) {
		t.Fatalf("Bytes after wrap = %q, want %q", got, "efghij")
	}
	if got := r.Offset(); got != 10 {
		t.Fatalf("Offset = %d, want 10", got)
	}
}

func TestRingBufferBytesReturnsCopy(t *testing.T) {
	r := newRingBuffer(8)
	_, _ = r.Write([]byte("abc"))
	got := r.Bytes()
	got[0] = 'X'
	again := r.Bytes()
	if again[0] == 'X' {
		t.Fatalf("Bytes() must return a copy; mutation leaked into buffer")
	}
}

func TestRingBufferConcurrentWrites(t *testing.T) {
	r := newRingBuffer(1024)
	const goroutines = 20
	const perG = 200
	const chunk = "0123456789" // 10 bytes

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < perG; j++ {
				_, _ = r.Write([]byte(chunk))
			}
		}()
	}
	wg.Wait()

	want := uint64(goroutines * perG * len(chunk))
	if got := r.Offset(); got != want {
		t.Fatalf("Offset after concurrent writes = %d, want %d", got, want)
	}
}


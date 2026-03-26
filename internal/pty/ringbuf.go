package pty

import "sync"

// ringBuffer is a fixed-size circular buffer that keeps the most recent data.
type ringBuffer struct {
	mu     sync.Mutex
	buf    []byte
	size   int
	w      int    // next write position
	full   bool   // true once the buffer has wrapped around
	offset uint64 // cumulative bytes written (monotonically increasing)
}

func newRingBuffer(size int) *ringBuffer {
	return &ringBuffer{
		buf:  make([]byte, size),
		size: size,
	}
}

// Write appends data to the ring buffer, overwriting the oldest data if full.
func (r *ringBuffer) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	n := len(p)
	r.offset += uint64(n)

	if n >= r.size {
		copy(r.buf, p[n-r.size:])
		r.w = 0
		r.full = true
		return n, nil
	}

	oldW := r.w
	space := r.size - r.w
	if n <= space {
		copy(r.buf[r.w:], p)
	} else {
		copy(r.buf[r.w:], p[:space])
		copy(r.buf, p[space:])
	}
	r.w = (r.w + n) % r.size

	if !r.full && r.w <= oldW {
		r.full = true
	}

	return n, nil
}

// Offset returns the cumulative number of bytes written.
func (r *ringBuffer) Offset() uint64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.offset
}

// Bytes returns a copy of the buffered data in chronological order.
func (r *ringBuffer) Bytes() []byte {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.bytesLocked()
}

// BytesSince returns only the data written after clientOffset.
// If clientOffset is too old (data already evicted), it falls back to the full buffer.
// Returns (data, currentOffset, isFull).
// isFull is true when the full buffer is returned (client should reset its display).
func (r *ringBuffer) BytesSince(clientOffset uint64) ([]byte, uint64, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// How many bytes are currently in the buffer?
	var buffered uint64
	if r.full {
		buffered = uint64(r.size)
	} else {
		buffered = uint64(r.w)
	}

	// Oldest offset still in the buffer
	oldest := r.offset - buffered

	if clientOffset < oldest || clientOffset > r.offset {
		// Client is too far behind (or invalid) — send full buffer
		return r.bytesLocked(), r.offset, true
	}

	delta := r.offset - clientOffset
	if delta == 0 {
		return nil, r.offset, false
	}

	all := r.bytesLocked()
	// delta bytes from the end of all
	return all[uint64(len(all))-delta:], r.offset, false
}

func (r *ringBuffer) bytesLocked() []byte {
	if !r.full {
		out := make([]byte, r.w)
		copy(out, r.buf[:r.w])
		return out
	}

	out := make([]byte, r.size)
	n := copy(out, r.buf[r.w:])
	copy(out[n:], r.buf[:r.w])
	return out
}

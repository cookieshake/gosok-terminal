package pty

import "sync"

// ringBuffer is a fixed-size circular buffer that keeps the most recent data.
type ringBuffer struct {
	mu   sync.Mutex
	buf  []byte
	size int
	w    int  // next write position
	full bool // true once the buffer has wrapped around
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

// Bytes returns a copy of the buffered data in chronological order.
func (r *ringBuffer) Bytes() []byte {
	r.mu.Lock()
	defer r.mu.Unlock()

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

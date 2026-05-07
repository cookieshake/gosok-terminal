package ws

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestFrameRoundTrip(t *testing.T) {
	cases := []struct {
		name string
		typ  FrameType
		meta any
		body []byte
	}{
		{"output", FrameOutput, nil, []byte("hello")},
		{"snapshot with offset", FrameSnapshot, map[string]any{"offset": 12345}, []byte("\x1bcSCREEN")},
		{"exit zero", FrameExit, map[string]any{"code": 0}, nil},
		{"resize", FrameResize, map[string]any{"cols": 80, "rows": 24}, nil},
		{"ping", FramePing, nil, nil},
		{"empty body", FrameInput, nil, []byte{}},
		{"binary body with all 256 byte values", FrameOutput, nil, allBytes()},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			encoded, err := EncodeFrame(c.typ, c.meta, c.body)
			if err != nil {
				t.Fatalf("encode: %v", err)
			}
			gotType, gotMeta, gotBody, err := DecodeFrame(encoded)
			if err != nil {
				t.Fatalf("decode: %v", err)
			}
			if gotType != c.typ {
				t.Errorf("type: got %v want %v", gotType, c.typ)
			}
			if !bytes.Equal(gotBody, c.body) {
				t.Errorf("body: got %q want %q", gotBody, c.body)
			}
			if c.meta == nil {
				if string(gotMeta) != "{}" {
					t.Errorf("meta: nil should encode as {}, got %q", gotMeta)
				}
			} else {
				want, _ := json.Marshal(c.meta)
				if !bytes.Equal(gotMeta, want) {
					t.Errorf("meta: got %q want %q", gotMeta, want)
				}
			}
		})
	}
}

func TestDecodeFrameTooShort(t *testing.T) {
	for _, data := range [][]byte{nil, {0x01}, {0x01, 0x00}} {
		if _, _, _, err := DecodeFrame(data); err == nil {
			t.Errorf("decode of %q must fail", data)
		}
	}
}

func TestDecodeFrameMetaOverrun(t *testing.T) {
	// type=0x01, meta_len=0x00FF (255), but we only supply 5 meta bytes
	data := []byte{0x01, 0x00, 0xff, 'a', 'b', 'c', 'd', 'e'}
	if _, _, _, err := DecodeFrame(data); err == nil {
		t.Error("expected overrun error")
	}
}

func TestEncodeMetaTooLarge(t *testing.T) {
	huge := make([]byte, maxMetaLen+1)
	for i := range huge {
		huge[i] = 'a'
	}
	if _, err := EncodeFrame(FrameOutput, map[string]string{"x": string(huge)}, nil); err == nil {
		t.Error("expected meta-too-large error")
	}
}

func allBytes() []byte {
	out := make([]byte, 256)
	for i := range out {
		out[i] = byte(i)
	}
	return out
}

package ws

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
)

// Frame is the v2 wire format for the PTY terminal WebSocket. Each WS binary
// message is exactly one Frame. No mixed text/binary, no implicit pairing.
//
// Wire layout:
//   [1 byte type][2 bytes meta_len BE][meta_len bytes meta JSON][body bytes]
//
// meta is required (use "{}" when no fields). body may be empty.
type FrameType uint8

const (
	FrameOutput   FrameType = 0x01 // S→C: body = PTY raw bytes; meta {}
	FrameSnapshot FrameType = 0x02 // S→C: body = snapshot bytes; meta {offset}
	FrameExit     FrameType = 0x03 // S→C: body empty; meta {code}
	FrameError    FrameType = 0x04 // S→C: body empty; meta {message}
	FrameInput    FrameType = 0x05 // C→S: body = keystroke bytes; meta {}
	FrameResize   FrameType = 0x06 // C→S: body empty; meta {cols, rows}
	FramePing     FrameType = 0x07 // C↔S: body empty; meta {}
	FramePong     FrameType = 0x08 // C↔S: body empty; meta {}
)

const maxMetaLen = 65535 // 2-byte length prefix

// EncodeFrame serializes a frame. meta is marshaled as JSON; if nil, "{}" is used.
func EncodeFrame(t FrameType, meta any, body []byte) ([]byte, error) {
	var metaBytes []byte
	if meta == nil {
		metaBytes = []byte("{}")
	} else {
		var err error
		metaBytes, err = json.Marshal(meta)
		if err != nil {
			return nil, fmt.Errorf("encode meta: %w", err)
		}
	}
	if len(metaBytes) > maxMetaLen {
		return nil, fmt.Errorf("meta length %d exceeds max %d", len(metaBytes), maxMetaLen)
	}

	out := make([]byte, 0, 3+len(metaBytes)+len(body))
	out = append(out, byte(t))
	var lenBuf [2]byte
	binary.BigEndian.PutUint16(lenBuf[:], uint16(len(metaBytes)))
	out = append(out, lenBuf[:]...)
	out = append(out, metaBytes...)
	out = append(out, body...)
	return out, nil
}

// DecodeFrame parses a frame produced by EncodeFrame. Returns the type, raw
// meta bytes (caller can json.Unmarshal into a typed struct), and body.
func DecodeFrame(data []byte) (FrameType, []byte, []byte, error) {
	if len(data) < 3 {
		return 0, nil, nil, errors.New("frame too short")
	}
	t := FrameType(data[0])
	metaLen := int(binary.BigEndian.Uint16(data[1:3]))
	if 3+metaLen > len(data) {
		return 0, nil, nil, fmt.Errorf("meta_len %d overruns frame (have %d remaining)", metaLen, len(data)-3)
	}
	meta := data[3 : 3+metaLen]
	body := data[3+metaLen:]
	return t, meta, body, nil
}

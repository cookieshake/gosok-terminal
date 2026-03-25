# Settings Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 툴 단축 버튼을 DB 기반 설정으로 관리하고, UI에서 편집 가능한 범용 설정 시스템을 구축한다.

**Architecture:** `settings` 테이블(key-value JSON)을 SQLite에 추가하고, Store 인터페이스에 설정 메서드를 붙인다. 프론트엔드는 SettingsContext로 전체 설정을 앱 시작 시 fetch해 공유하며, Sidebar의 설정 아이콘으로 SettingsView를 노출한다.

**Tech Stack:** Go (net/http, modernc/sqlite), React 19, TypeScript, TailwindCSS v4

---

## File Map

**New files:**
- `internal/api/settings.go` — GET/PUT/DELETE /api/v1/settings 핸들러
- `frontend/src/contexts/SettingsContext.tsx` — 전역 설정 상태 + API sync
- `frontend/src/components/SettingsView.tsx` — 설정 페이지 (AI Tools 편집 UI)

**Modified files:**
- `internal/store/store.go` — Store 인터페이스에 GetSetting/SetSetting/ListSettings/DeleteSetting 추가
- `internal/store/sqlite.go` — settings 테이블 migrate + 4개 메서드 구현
- `internal/tab/types.go` — Registry에서 AI tool 항목 제거 (shell만 유지)
- `internal/api/tabs.go` — tabHandler.create()에서 Registry 대신 settings 조회
- `internal/api/routes.go` — settings 라우트 등록, tabHandler에 store 노출
- `cmd/gosok/main.go` — 서버 시작 전 settings 기본값 초기화
- `frontend/src/api/client.ts` — settings API 함수 추가
- `frontend/src/api/types.ts` — AiTool 타입 추가, TabType을 string으로 완화
- `frontend/src/components/ProjectView.tsx` — AI_TOOLS 하드코딩 → useSettings()
- `frontend/src/components/Sidebar.tsx` — 하단에 설정 아이콘 추가
- `frontend/src/components/Layout.tsx` — 설정 네비게이션 prop 전달
- `frontend/src/App.tsx` — SettingsProvider 래핑, settings view 상태 추가

---

## Task 1: DB — settings 테이블 + Store 인터페이스

**Files:**
- Modify: `internal/store/store.go`
- Modify: `internal/store/sqlite.go`

- [ ] **Step 1: Store 인터페이스에 settings 메서드 추가**

`internal/store/store.go`의 `Store` 인터페이스 끝에 추가:

```go
// Settings
GetSetting(ctx context.Context, key string) (string, error) // not found → "", nil
SetSetting(ctx context.Context, key, value string) error    // upsert
ListSettings(ctx context.Context) (map[string]string, error)
DeleteSetting(ctx context.Context, key string) error
```

- [ ] **Step 2: sqlite.go의 migrate()에 settings 테이블 추가**

`migrate()` 함수 내 두 번째 `CREATE TABLE IF NOT EXISTS tabs` 블록 다음에 (두 곳 모두) 추가:

```sql
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

즉, migrate()의 두 SQL 블록(정상 경로 + 폴백 경로) 각각에 위 테이블 생성문을 추가한다.

- [ ] **Step 3: SQLiteStore에 4개 메서드 구현**

`internal/store/sqlite.go` 파일 끝에 추가:

```go
// Settings

func (s *SQLiteStore) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = ?`, key,
	).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func (s *SQLiteStore) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
		key, value,
	)
	return err
}

func (s *SQLiteStore) ListSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		result[k] = v
	}
	return result, rows.Err()
}

func (s *SQLiteStore) DeleteSetting(ctx context.Context, key string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	return err
}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && flox activate -- go build ./...
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add internal/store/store.go internal/store/sqlite.go
git commit -m "feat: add settings table and Store interface methods"
```

---

## Task 2: Backend — 기본값 초기화 + settings API 핸들러

**Files:**
- Create: `internal/api/settings.go`
- Modify: `internal/api/routes.go`
- Modify: `cmd/gosok/main.go`

- [ ] **Step 1: settings.go 핸들러 생성**

`internal/api/settings.go`:

```go
package api

import (
	"encoding/json"
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

// defaultSettings는 DELETE 시 키를 DB에서 제거하면 이 맵에서 폴백 반환.
// 서버 시작 시 DB에 없는 키를 삽입하는 데도 사용.
var DefaultSettings = map[string]string{
	"ai_tools": `[
  {"type":"claude-code","label":"Claude","command":"claude","color":"#2563eb","enabled":true},
  {"type":"codex","label":"Codex","command":"codex","color":"#16a34a","enabled":true},
  {"type":"gemini-cli","label":"Gemini","command":"gemini","color":"#d97706","enabled":true},
  {"type":"opencode","label":"Open","command":"opencode","color":"#7c3aed","enabled":true}
]`,
}

type settingsHandler struct {
	store store.Store
}

// list: GET /api/v1/settings
func (h *settingsHandler) list(w http.ResponseWriter, r *http.Request) {
	stored, err := h.store.ListSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Merge defaults: keys missing from DB return default values
	result := make(map[string]json.RawMessage, len(DefaultSettings))
	for k, defVal := range DefaultSettings {
		raw := json.RawMessage(defVal)
		if v, ok := stored[k]; ok {
			raw = json.RawMessage(v)
		}
		result[k] = raw
	}
	writeJSON(w, http.StatusOK, result)
}

// get: GET /api/v1/settings/{key}
func (h *settingsHandler) get(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	val, err := h.store.GetSetting(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if val == "" {
		def, ok := DefaultSettings[key]
		if !ok {
			writeError(w, http.StatusNotFound, "setting not found")
			return
		}
		val = def
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(val)) //nolint:errcheck
}

// set: PUT /api/v1/settings/{key}
func (h *settingsHandler) set(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")

	var body struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Value == nil {
		writeError(w, http.StatusBadRequest, "value is required")
		return
	}

	if err := h.store.SetSetting(r.Context(), key, string(body.Value)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body.Value) //nolint:errcheck
}

// reset: DELETE /api/v1/settings/{key} — removes from DB, next read returns default
func (h *settingsHandler) reset(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if err := h.store.DeleteSetting(r.Context(), key); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Return the default value
	def, ok := DefaultSettings[key]
	if !ok {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(def)) //nolint:errcheck
}
```

- [ ] **Step 2: routes.go에 settings 라우트 등록**

`internal/api/routes.go`의 `Register` 함수에 추가:

```go
sh := &settingsHandler{store: s}
mux.HandleFunc("GET /api/v1/settings", sh.list)
mux.HandleFunc("GET /api/v1/settings/{key}", sh.get)
mux.HandleFunc("PUT /api/v1/settings/{key}", sh.set)
mux.HandleFunc("DELETE /api/v1/settings/{key}", sh.reset)
```

- [ ] **Step 3: main.go에 기본값 초기화 추가**

`cmd/gosok/main.go`에서 `store.NewSQLite(dbPath)` 성공 후, `server.New(s, distFS)` 호출 전에:

```go
// Initialize default settings (only inserts missing keys)
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
```

`main.go` import에 `api` 패키지 추가:
```go
"github.com/cookieshake/gosok-terminal/internal/api"
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && flox activate -- go build ./...
```

Expected: 에러 없음

- [ ] **Step 5: 동작 확인**

```bash
# 터미널 1
flox activate -- go run ./cmd/gosok/ &
sleep 1

# settings 목록 확인
curl -s http://localhost:18435/api/v1/settings | python3 -m json.tool

# PUT 테스트
curl -s -X PUT http://localhost:18435/api/v1/settings/ai_tools \
  -H 'Content-Type: application/json' \
  -d '{"value": [{"type":"shell","label":"Shell","command":"bash","color":"#000000","enabled":true}]}'

# GET 단일 키
curl -s http://localhost:18435/api/v1/settings/ai_tools

# DELETE (reset)
curl -s -X DELETE http://localhost:18435/api/v1/settings/ai_tools
kill %1
```

Expected: list에 `ai_tools` 키가 있고, PUT/GET/DELETE 각각 정상 응답

- [ ] **Step 6: Commit**

```bash
git add internal/api/settings.go internal/api/routes.go cmd/gosok/main.go
git commit -m "feat: add settings API endpoints and default initialization"
```

---

## Task 3: Backend — tab 생성 시 Registry 대신 settings 조회

**Files:**
- Modify: `internal/tab/types.go`
- Modify: `internal/api/tabs.go`

- [ ] **Step 1: Registry에서 AI tool 항목 제거**

`internal/tab/types.go`에서 `Registry` 맵을 shell만 남기도록 수정:

```go
var Registry = map[TabType]TabDef{
	Shell: {Command: "", DefaultArgs: []string{}, DisplayName: "Shell"},
}
```

`ClaudeCode`, `Codex`, `GeminiCLI`, `OpenCode` 상수 및 `TabDef` 구조체는 유지 (하위 호환). 단, Registry에서만 제거.

- [ ] **Step 2: tabs.go의 create()에서 settings 조회로 변경**

`internal/api/tabs.go`의 `create()` 함수에서 Registry 조회 블록 교체:

기존:
```go
} else {
    def, ok := tabPkg.Registry[tabPkg.TabType(req.TabType)]
    if !ok {
        writeError(w, http.StatusBadRequest, "unknown tab_type: "+req.TabType)
        return
    }
    command = def.Command
}
```

교체 후:
```go
} else {
    // Look up command from ai_tools settings
    aiToolsJSON, err := h.store.GetSetting(r.Context(), "ai_tools")
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    if aiToolsJSON == "" {
        aiToolsJSON = DefaultSettings["ai_tools"]
    }
    var aiTools []struct {
        Type    string `json:"type"`
        Command string `json:"command"`
    }
    if err := json.Unmarshal([]byte(aiToolsJSON), &aiTools); err != nil {
        writeError(w, http.StatusInternalServerError, "invalid ai_tools setting")
        return
    }
    found := false
    for _, t := range aiTools {
        if t.Type == req.TabType {
            command = t.Command
            found = true
            break
        }
    }
    if !found {
        writeError(w, http.StatusBadRequest, "unknown tab_type: "+req.TabType)
        return
    }
}
```

`tabs.go` import에 `api` 패키지 추가 (같은 패키지이므로 불필요 — `DefaultSettings`는 같은 `api` 패키지에 있음). `json` import 이미 있음.

- [ ] **Step 3: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && flox activate -- go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add internal/tab/types.go internal/api/tabs.go
git commit -m "feat: resolve AI tool commands from settings instead of hardcoded registry"
```

---

## Task 4: Frontend — settings API 클라이언트 + SettingsContext

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/contexts/SettingsContext.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: types.ts에 AiTool 타입 추가**

`frontend/src/api/types.ts` 끝에 추가. 기존 `TabType` union과 `TAB_TYPES`는 **유지** (하위 호환):

```ts
export interface AiTool {
  type: string;
  label: string;
  command: string;
  color: string;
  enabled: boolean;
}
```

- [ ] **Step 2: client.ts에 settings API 함수 추가**

`frontend/src/api/client.ts` 끝에 추가:

```ts
// Settings
export const listSettings = () =>
  request<Record<string, unknown>>('/settings');

export const getSetting = <T>(key: string) =>
  request<T>(`/settings/${key}`);

export const setSetting = (key: string, value: unknown) =>
  request<unknown>(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });

export const resetSetting = (key: string) =>
  request<unknown>(`/settings/${key}`, { method: 'DELETE' });
```

- [ ] **Step 3: SettingsContext.tsx 생성**

`frontend/src/contexts/SettingsContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api/client';

interface SettingsContextValue {
  settings: Record<string, unknown>;
  getSetting: <T>(key: string, defaultValue: T) => T;
  setSetting: (key: string, value: unknown) => Promise<void>;
  resetSetting: (key: string) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const reload = useCallback(async () => {
    const data = await api.listSettings();
    setSettings(data || {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getSetting = useCallback(<T,>(key: string, defaultValue: T): T => {
    return key in settings ? (settings[key] as T) : defaultValue;
  }, [settings]);

  const handleSetSetting = useCallback(async (key: string, value: unknown) => {
    await api.setSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetSetting = useCallback(async (key: string) => {
    const defaultValue = await api.resetSetting(key);
    setSettings(prev => ({ ...prev, [key]: defaultValue }));
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings,
      getSetting,
      setSetting: handleSetSetting,
      resetSetting: handleResetSetting,
      reload,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
```

- [ ] **Step 4: App.tsx를 SettingsProvider로 래핑**

`frontend/src/App.tsx`:
- `SettingsProvider` import 추가
- `return` 블록의 최상위를 `<SettingsProvider>...</SettingsProvider>`로 감싸기

```tsx
import { SettingsProvider } from './contexts/SettingsContext';

// return 블록:
return (
  <SettingsProvider>
    <div className="dark">
      {/* 기존 내용 그대로 */}
    </div>
    {/* CreateProjectDialog 포함 */}
  </SettingsProvider>
);
```

- [ ] **Step 5: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal/frontend && flox activate -- npm run build
```

Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts \
        frontend/src/contexts/SettingsContext.tsx frontend/src/App.tsx
git commit -m "feat: add SettingsContext and settings API client"
```

---

## Task 5: Frontend — ProjectView AI 버튼을 settings에서 로드

**Files:**
- Modify: `frontend/src/components/ProjectView.tsx`

- [ ] **Step 1: AI_TOOLS 하드코딩을 useSettings()로 교체**

`ProjectView.tsx`에서:
1. 상단 `AI_TOOLS` const 배열 제거
2. `useSettings` import 추가
3. 컴포넌트 내부에 추가:

```tsx
import { useSettings } from '../contexts/SettingsContext';
import type { AiTool } from '../api/types';

// 컴포넌트 내부 (useState들과 함께):
const { getSetting } = useSettings();
const aiTools = getSetting<AiTool[]>('ai_tools', []).filter(t => t.enabled);
```

4. 탭바의 AI 버튼 렌더링 부분을 `AI_TOOLS.map(...)` → `aiTools.map(...)` 으로 변경 (구조 동일, `as const` 제거)

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal/frontend && flox activate -- npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProjectView.tsx
git commit -m "feat: load AI tool buttons from settings instead of hardcoded array"
```

---

## Task 6: Frontend — 설정 페이지 UI

**Files:**
- Create: `frontend/src/components/SettingsView.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: SettingsView.tsx 생성**

`frontend/src/components/SettingsView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { AiTool } from '../api/types';

export default function SettingsView() {
  const { getSetting, setSetting } = useSettings();
  const [tools, setTools] = useState<AiTool[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTools(getSetting<AiTool[]>('ai_tools', []));
    setDirty(false);
  }, [getSetting]);

  const update = (updated: AiTool[]) => {
    setTools(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting('ai_tools', tools);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (i: number, field: keyof AiTool, value: string | boolean) => {
    const next = tools.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
    update(next);
  };

  const handleAdd = () => {
    update([...tools, { type: `tool-${Date.now()}`, label: 'New Tool', command: '', color: '#6b7280', enabled: true }]);
  };

  const handleDelete = (i: number) => {
    update(tools.filter((_, idx) => idx !== i));
  };

  const handleMove = (i: number, dir: -1 | 1) => {
    const next = [...tools];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const inputStyle: React.CSSProperties = {
    height: '28px', padding: '0 8px', borderRadius: '5px',
    border: '1px solid #e3e5e8', fontSize: '12px', color: '#111827',
    background: '#ffffff', outline: 'none',
  };

  return (
    <div className="flex h-full" style={{ background: '#f1f2f5' }}>
      {/* Category sidebar */}
      <div style={{ width: '180px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8', padding: '16px 0' }}>
        <div style={{ padding: '0 12px 8px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
          Settings
        </div>
        <div style={{
          margin: '0 8px', padding: '6px 10px', borderRadius: '6px',
          background: '#ffffff', border: '1px solid #e3e5e8',
          fontSize: '12.5px', fontWeight: 600, color: '#111827', cursor: 'default',
        }}>
          AI Tools
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '28px 32px', maxWidth: '680px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>AI Tools</h2>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            탭바에 표시되는 AI 툴 단축 버튼을 관리합니다. 클릭 시 해당 command로 새 탭이 열립니다.
          </p>
        </div>

        {/* Tool list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 80px 1fr 140px 60px 70px', gap: '8px', padding: '0 4px', alignItems: 'center' }}>
            {['', 'Color', 'Label', 'Command', 'Enabled', ''].map((h, i) => (
              <span key={i} style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {tools.map((tool, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '28px 80px 1fr 140px 60px 70px',
              gap: '8px', alignItems: 'center',
              background: '#ffffff', padding: '8px', borderRadius: '7px',
              border: '1px solid #e3e5e8',
            }}>
              {/* Up/Down */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <button onClick={() => handleMove(i, -1)} disabled={i === 0}
                  style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                  <ChevronUp style={{ width: '13px', height: '13px' }} />
                </button>
                <button onClick={() => handleMove(i, 1)} disabled={i === tools.length - 1}
                  style={{ border: 'none', background: 'transparent', cursor: i === tools.length - 1 ? 'default' : 'pointer', color: i === tools.length - 1 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                  <ChevronDown style={{ width: '13px', height: '13px' }} />
                </button>
              </div>

              {/* Color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="color" value={tool.color}
                  onChange={e => handleChange(i, 'color', e.target.value)}
                  style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }} />
                <input value={tool.color} onChange={e => handleChange(i, 'color', e.target.value)}
                  style={{ ...inputStyle, width: '52px', fontFamily: 'monospace', fontSize: '11px' }} />
              </div>

              {/* Label */}
              <input value={tool.label} onChange={e => handleChange(i, 'label', e.target.value)}
                style={inputStyle} placeholder="Label" />

              {/* Command */}
              <input value={tool.command} onChange={e => handleChange(i, 'command', e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="command" />

              {/* Enabled toggle */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => handleChange(i, 'enabled', !tool.enabled)}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: tool.enabled ? '#3b82f6' : '#d1d5db',
                    position: 'relative', transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px',
                    left: tool.enabled ? '18px' : '2px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#ffffff', transition: 'left 0.15s',
                  }} />
                </button>
              </div>

              {/* Delete */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => handleDelete(i)}
                  style={{
                    width: '26px', height: '26px', borderRadius: '5px', border: 'none',
                    background: 'transparent', cursor: 'pointer', color: '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add + Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleAdd}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px',
              border: '1px dashed #d1d5db', background: 'transparent',
              color: '#6b7280', fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <Plus style={{ width: '12px', height: '12px' }} />
            Add Tool
          </button>

          <button onClick={handleSave} disabled={!dirty || saving}
            style={{
              height: '30px', padding: '0 16px', borderRadius: '6px',
              border: 'none', cursor: dirty && !saving ? 'pointer' : 'default',
              background: dirty ? '#3b82f6' : '#e5e7eb',
              color: dirty ? '#ffffff' : '#9ca3af',
              fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {!dirty && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar에 설정 아이콘 추가**

`frontend/src/components/Sidebar.tsx`에서:

1. import에 `Settings` 아이콘 추가:
```tsx
import { RefreshCw, Plus, Trash2, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
```

2. Props 인터페이스에 추가:
```tsx
onSettings: () => void;
isSettingsActive?: boolean;
```

3. 확장 사이드바(마지막 `<aside>`) 하단의 "New Project" 버튼 div **앞에** 설정 버튼 추가:

```tsx
{/* Settings button */}
<div style={{ padding: '0 10px 4px' }}>
  <button
    onClick={onSettings}
    className="w-full flex items-center gap-2 transition-all"
    style={{
      padding: '7px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
      background: isSettingsActive ? '#eff6ff' : 'transparent',
      color: isSettingsActive ? '#3b82f6' : '#9ca3af',
      fontSize: '12px',
    }}
    onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; } }}
    onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; } }}
  >
    <Settings style={{ width: '13px', height: '13px', flexShrink: 0 }} />
    Settings
  </button>
</div>
```

4. 접힌 사이드바(`collapsed` 분기)의 하단 버튼 div에도 추가:
```tsx
<button
  onClick={onSettings}
  style={{ ...iconBtn, color: isSettingsActive ? '#3b82f6' : '#9ca3af' }}
  onMouseEnter={e => { if (!isSettingsActive) e.currentTarget.style.background = '#eff6ff'; }}
  onMouseLeave={e => { if (!isSettingsActive) e.currentTarget.style.background = 'transparent'; }}
  title="Settings"
>
  <Settings style={{ width: '14px', height: '14px' }} />
</button>
```

- [ ] **Step 3: Layout.tsx에 settings 관련 prop 추가**

`frontend/src/components/Layout.tsx`:

1. `LayoutProps`에 추가:
```tsx
onSettings: () => void;
isSettingsActive?: boolean;
```

2. `Layout` 함수 파라미터에 추가 (`onDeleteProject` 옆):
```tsx
onSettings,
isSettingsActive = false,
```

3. `<Sidebar>` 컴포넌트에 prop 전달:
```tsx
onSettings={onSettings}
isSettingsActive={isSettingsActive}
```

- [ ] **Step 4: App.tsx에 settings view 상태 추가**

`frontend/src/App.tsx`:

1. `showSettings` 상태 추가:
```tsx
const [showSettings, setShowSettings] = useState(false);
```

2. `<Layout>`에 prop 추가:
```tsx
onSettings={() => { setShowSettings(true); setSelectedProjectId(null); }}
isSettingsActive={showSettings}
```

3. `children` 영역 수정:
```tsx
import SettingsView from './components/SettingsView';

// children:
{showSettings ? (
  <SettingsView />
) : selectedProject ? (
  <ProjectView project={selectedProject} />
) : (
  <Dashboard projects={projects} onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }} />
)}
```

4. `onSelectProject`에서 settings 닫기:
```tsx
onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }}
```

- [ ] **Step 5: 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal/frontend && flox activate -- npm run build
```

Expected: 에러 없음

- [ ] **Step 6: 전체 빌드 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && flox activate -- make build
```

Expected: `bin/gosok` 생성

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SettingsView.tsx \
        frontend/src/components/Sidebar.tsx \
        frontend/src/components/Layout.tsx \
        frontend/src/App.tsx
git commit -m "feat: add settings UI with AI Tools editor"
```

---

## Task 7: 검증

- [ ] **Step 1: 서버 실행 후 통합 확인**

```bash
flox activate -- go run ./cmd/gosok/ &
sleep 1

# 설정 기본값 확인
curl -s http://localhost:18435/api/v1/settings/ai_tools | python3 -m json.tool

# 설정 변경
curl -s -X PUT http://localhost:18435/api/v1/settings/ai_tools \
  -H 'Content-Type: application/json' \
  -d '{"value":[{"type":"claude-code","label":"CCC","command":"claude","color":"#ff0000","enabled":true}]}'

# 변경 확인
curl -s http://localhost:18435/api/v1/settings/ai_tools | python3 -m json.tool

# 리셋
curl -s -X DELETE http://localhost:18435/api/v1/settings/ai_tools | python3 -m json.tool

kill %1
```

Expected: 4개 기본 툴 반환, PUT 후 변경 반영, DELETE 후 기본값 복구

- [ ] **Step 2: 브라우저에서 UI 확인**

```bash
flox activate -- make dev
```

체크리스트:
- [ ] 사이드바 하단 Settings 아이콘 클릭 → 설정 페이지 이동
- [ ] AI Tools 목록 표시 (Claude, Codex, Gemini, Open)
- [ ] label/command/color 수정 → Save → 새로고침 후 유지
- [ ] enabled 토글 off → ProjectView 탭바에서 버튼 사라짐
- [ ] Add Tool → command 입력 → Save → 탭바에 버튼 추가됨
- [ ] 새 AI 툴 버튼 클릭 → 해당 command로 탭 생성됨

- [ ] **Step 3: 린트 확인**

```bash
cd /Users/cookieshake/workspace/gosok-terminal && flox activate -- make lint
```

- [ ] **Step 4: 최종 커밋 (필요 시 수정사항 포함)**

```bash
git add -A
git commit -m "fix: address any lint/build issues from final verification"
```

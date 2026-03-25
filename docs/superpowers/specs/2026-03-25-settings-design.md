# Settings Feature Design

**Date:** 2026-03-25
**Status:** Approved

## Overview

현재 AI 툴 단축 버튼(Claude, Codex, Gemini 등)이 프론트엔드와 백엔드에 하드코딩되어 있다. 이를 DB 기반 범용 설정 시스템으로 교체하여 런타임에 사용자가 AI 툴 목록을 커스텀할 수 있게 한다. 설정 시스템은 향후 다른 설정 항목도 쉽게 추가할 수 있도록 범용적으로 설계한다.

---

## Backend

### DB Schema

```sql
CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,  -- JSON
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

스키마 변경 없이 키 추가만으로 새 설정을 지원한다.

### API Endpoints

```
GET  /api/v1/settings          # 전체 설정 반환 { key: value, ... }
GET  /api/v1/settings/{key}    # 단일 키 조회
PUT  /api/v1/settings/{key}    # upsert (JSON body: { "value": ... })
```

### New Package: `internal/settings`

- `Store` 인터페이스 확장: `GetSetting`, `SetSetting`, `ListSettings`
- `internal/api/settings.go`: REST 핸들러
- `internal/settings/defaults.go`: 앱 시작 시 기본값 초기화 (DB에 키가 없을 때만)

### AI Tools 기본값 (키: `ai_tools`)

```json
[
  { "type": "claude-code", "label": "Claude", "command": "claude", "color": "#2563eb", "enabled": true },
  { "type": "codex",       "label": "Codex",  "command": "codex",  "color": "#16a34a", "enabled": true },
  { "type": "gemini-cli",  "label": "Gemini", "command": "gemini", "color": "#d97706", "enabled": true },
  { "type": "opencode",    "label": "Open",   "command": "opencode","color": "#7c3aed", "enabled": true }
]
```

### Tab Type 검증 변경

현재 `tab.ValidTabType()`은 하드코딩된 `Registry`를 참조한다. AI tool tab은 더 이상 컴파일타임에 검증하지 않고, tab 생성 시 `command` 필드를 설정에서 주입한다. `shell`은 특수 타입으로 하드코딩 유지.

`tab.Registry`는 `shell` 항목만 남기고, AI tool 정보는 settings에서 가져온다.

---

## Frontend

### Settings Context

```ts
// src/contexts/SettingsContext.tsx
interface SettingsContextValue {
  settings: Record<string, unknown>;
  getSetting: <T>(key: string, defaultValue: T) => T;
  setSetting: (key: string, value: unknown) => Promise<void>;
}
```

앱 시작 시 `GET /api/v1/settings` 한 번 fetch. `setSetting` 호출 시 서버 sync 후 로컬 상태 업데이트.

### AI Tools 타입 변경

`src/api/types.ts`의 `TabType` union과 `TAB_TYPES` 하드코딩 제거. AI tool 타입은 설정에서 동적으로 로드.

`ProjectView.tsx`의 `AI_TOOLS` 배열을 `useSettings()`로 대체.

### 설정 UI

**진입점:** 사이드바 하단 ⚙ 아이콘 → 설정 페이지 (`/settings` 라우트)

**설정 페이지 레이아웃:**
- 좌측: 카테고리 목록 (현재는 "AI Tools" 하나, 향후 확장)
- 우측: 선택된 카테고리 편집 영역

**AI Tools 편집 기능:**
- 목록 표시 (name, command, color, enabled 토글)
- 항목 추가 / 삭제
- 이름, 명령어, 색상 인라인 편집
- 드래그로 순서 변경 (선택적, 1차 구현에서는 up/down 버튼으로 대체 가능)

---

## Data Flow

```
앱 로드
  └─ SettingsContext: GET /api/v1/settings
       └─ ai_tools 설정 → ProjectView AI 버튼 렌더링

사용자가 AI 버튼 클릭
  └─ handleAddTab({ tab_type: tool.type, command: tool.command })
       └─ POST /api/v1/projects/{id}/tabs
            └─ tab.Command = 설정에서 가져온 command

설정 페이지에서 수정
  └─ PUT /api/v1/settings/ai_tools
       └─ SettingsContext 로컬 상태 업데이트
            └─ ProjectView 버튼 즉시 반영
```

---

## Constraints & Decisions

- **범용성:** settings 테이블은 임의의 JSON 값을 저장. 앱 레이어에서 타입 정의.
- **기본값:** 서버 시작 시 DB에 키가 없으면 기본값 삽입. 업그레이드 시 누락된 기본값만 추가.
- **shell 타입 고정:** `shell`은 항상 `$SHELL`을 사용하며 설정에서 제외.
- **tab 생성 시 command 저장:** tab 레코드에 command를 저장하므로 설정 변경이 기존 tab에 영향 없음.

---

## File Changes Summary

**New files:**
- `internal/settings/defaults.go`
- `internal/api/settings.go`
- `frontend/src/contexts/SettingsContext.tsx`
- `frontend/src/components/SettingsView.tsx`

**Modified files:**
- `internal/store/store.go` — Store 인터페이스에 settings 메서드 추가
- `internal/store/sqlite.go` — settings 테이블 마이그레이션 + 구현
- `internal/tab/types.go` — Registry에서 AI tool 제거
- `internal/api/routes.go` — settings 라우트 등록
- `frontend/src/api/types.ts` — TabType 동적화
- `frontend/src/api/client.ts` — settings API 클라이언트 추가
- `frontend/src/components/ProjectView.tsx` — AI_TOOLS를 settings에서 로드
- `frontend/src/components/Sidebar.tsx` — 설정 아이콘 추가
- `frontend/src/App.tsx` — SettingsProvider, /settings 라우트 추가

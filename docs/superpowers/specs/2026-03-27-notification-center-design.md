# Notification Center — Right Slide Panel

## Overview

기존 Inbox/Feed 전체화면 뷰를 제거하고, 오른쪽에서 슬라이드로 열리는 통합 알림 패널로 대체한다. 터미널 작업을 중단하지 않고 메시지와 알림을 확인할 수 있다.

## Trigger

- 탭바(TerminalTabs) 오른쪽 끝에 **벨 아이콘** 배치
- 읽지 않은 항목이 있으면 빨간 뱃지로 카운트 표시
- 클릭 시 패널 토글 (열기/닫기)

## Panel Layout

```
┌─────────────────────────────────┐
│ 알림센터                    ✕   │
├────────┬────────┬───────────────┤
│ 전체   │ 메시지 │ 알림          │
├────────┴────────┴───────────────┤
│                                 │
│  [Claude Code 완료]        3분전 │
│  MobileKeybar Alt 키 추가...    │
│                                 │
│  [broadcast] from 01KM...  5분전 │
│  DB migration complete          │
│                                 │
│  [direct] from 01KM...   10분전 │
│  빌드 끝남                      │
│                                 │
└─────────────────────────────────┘
```

- **전체**: 모든 항목 시간순 (최신 위)
- **메시지**: direct + broadcast 메시지만
- **알림**: notification 이벤트만

## Interaction

- **항목 클릭**: 해당 소스 탭으로 이동 (tab_id 기반) + 패널 닫기
- **패널 외부 클릭**: 패널 닫기
- **Esc 키**: 패널 닫기

## Sizing & Position

- **Desktop**: 너비 340px, 오른쪽에서 슬라이드, 메인 콘텐츠 위에 오버레이
- **Mobile**: 전체 너비 오버레이
- 높이: 탭바 아래 ~ 화면 하단 (MobileKeybar 위)

## Backend Changes

### Notify API 확장

`POST /api/v1/notify` 요청에 `tab_id` 필드 추가:

```json
{
  "title": "Claude Code 완료",
  "body": "MobileKeybar Alt 키 추가...",
  "tab_id": "01KMN83P63CRPM7P6VYHAGFCZ2"
}
```

- `tab_id`는 optional. 없으면 알림 클릭 시 탭 이동 없이 dismiss.

### Events Hub 확장

`NotifPayload`에 `tab_id` 필드 추가:

```go
type NotifPayload struct {
    Title string `json:"title"`
    Body  string `json:"body"`
    TabID string `json:"tab_id,omitempty"`
}
```

### CLI 변경

`gosok notify`에서 `GOSOK_TAB_ID` 환경변수를 자동으로 `tab_id`에 포함:

```bash
gosok notify "Claude Code 완료" --body "작업 요약"
# → POST /api/v1/notify { title, body, tab_id: $GOSOK_TAB_ID }
```

## Frontend Changes

### 삭제 대상

- `InboxPanel.tsx` — 제거
- `FeedPanel.tsx` — 제거
- `Sidebar.tsx` — Inbox/Feed 버튼 제거
- `App.tsx` — `showInbox`, `showFeed` 상태 및 관련 로직 제거

### 신규 컴포넌트

**`NotificationCenter.tsx`**

통합 알림 패널 컴포넌트:

- Props: `open`, `onClose`, `onNavigateTab(tabId)`
- 내부 상태: 현재 필터 탭 (`all` | `messages` | `notifications`)
- EventsContext에서 messages + notifications를 통합하여 시간순 정렬
- 항목 클릭 시 `onNavigateTab` 호출 후 `onClose`

**`NotificationItem.tsx`**

개별 알림 항목 렌더링:

- 메시지: scope 뱃지 (direct/broadcast/global) + from_tab_id + body + relative time
- 알림: title + body + relative time
- 타입별 아이콘/색상 구분

### 기존 컴포넌트 수정

**`TerminalTabs.tsx`** (또는 탭바 컴포넌트)

- 오른쪽 끝에 Bell 아이콘 버튼 추가
- unread 카운트 뱃지 (빨간 원 + 숫자)

**`ProjectView.tsx`**

- NotificationCenter 패널을 children으로 렌더링
- `notificationOpen` 상태 관리
- 벨 아이콘 클릭 핸들러

**`EventsContext.tsx`**

- `notifications` 배열 추가 (현재는 브라우저 Notification만 보내고 저장 안 함)
- notification 이벤트를 배열에 축적
- `unreadNotifCount` 추가
- `clearNotifications` 추가
- 통합 unread 카운트: `unreadInboxCount + unreadFeedCount + unreadNotifCount`

**`Layout.tsx`**

- Sidebar에서 Inbox/Feed 관련 props 제거 (`onInbox`, `isInboxActive`, `inboxBadge`, `onFeed`, `isFeedActive`, `feedBadge`)

**`App.tsx`**

- `showInbox`, `showFeed` 상태 제거
- Inbox/Feed 토글 핸들러 제거
- Layout에서 관련 props 제거

## Animation

- 열기: 오른쪽에서 translateX(100%) → translateX(0), 200ms ease-out
- 닫기: translateX(0) → translateX(100%), 150ms ease-in
- 배경 dim: opacity 0 → 0.35, 동시 전환

## Data Flow

```
gosok notify CLI
  → POST /api/v1/notify { title, body, tab_id }
  → Hub.PublishNotification(title, body, tabID)
  → WebSocket → EventsContext
  → notifications 배열 축적 + unread 카운트 증가
  → 벨 아이콘 뱃지 업데이트
  → 패널 열면 통합 목록 표시
```

## Hook Integration (Claude Code)

`~/.claude/hooks/gosok-stop-notify.sh`에서 `tab_id` 포함하여 전송:

```bash
#!/bin/bash
[ -z "$GOSOK_API_URL" ] && exit 0

body=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('tool_input',{}).get('result','작업 완료')
print(r[:200])
" 2>/dev/null || echo "작업 완료")

exec gosok notify "Claude Code 완료" --body "$body"
# GOSOK_TAB_ID는 gosok notify가 자동으로 포함
```

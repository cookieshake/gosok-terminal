# Agent Messaging & Browser Notifications

gosok 탭에서 실행되는 터미널 기반 에이전트(Claude Code, Codex 등)가 서로 메시지를 주고받고, 브라우저 알림을 보낼 수 있는 기능.

## 요구사항

- 탭 간 1:1 다이렉트 메시지
- 전체 탭 브로드캐스트
- 탭과 무관한 글로벌 피드 (게시판)
- 브라우저 Web Notification API 알림
- CLI 서브커맨드로 조작 (내부적으로 REST API 호출)

## 데이터 모델

### messages 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT (ULID) | 메시지 ID |
| scope | TEXT | `direct`, `broadcast`, `global` |
| from_tab_id | TEXT | 발신 탭 (nullable) |
| to_tab_id | TEXT | 수신 탭 (direct일 때만, 나머지 NULL) |
| body | TEXT | 메시지 본문 |
| created_at | DATETIME | 생성 시각 |

### message_reads 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| tab_id | TEXT | 읽은 탭 |
| channel | TEXT | `inbox` 또는 `feed` |
| last_read_id | TEXT (ULID) | 마지막으로 읽은 메시지 ID |

PRIMARY KEY는 `(tab_id, channel)`. ULID가 시간순 정렬이므로 `last_read_id`보다 큰 ID = 안 읽은 메시지. inbox와 feed의 읽음 위치를 독립적으로 추적.

## REST API (내부용)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/messages` | POST | 메시지 발송 (direct/broadcast/global) |
| `/api/v1/messages/inbox/{tabID}` | GET | 탭 inbox 조회 (direct + broadcast), `?since={ulid}` 지원 |
| `/api/v1/messages/feed` | GET | global 피드 조회, `?since={ulid}` 지원 |
| `/api/v1/messages/inbox/{tabID}/read` | PUT | inbox 읽음 위치 갱신 |
| `/api/v1/messages/feed/read/{tabID}` | PUT | feed 읽음 위치 갱신 |
| `/api/v1/notify` | POST | 브라우저 알림 전송 (fire-and-forget) |

### POST /api/v1/messages 요청 본문

```json
{
  "scope": "direct",
  "from_tab_id": "01J...",
  "to_tab_id": "01J...",
  "body": "빌드 끝남"
}
```

- `scope=direct`: `to_tab_id` 필수
- `scope=broadcast`: `to_tab_id` 생략
- `scope=global`: `to_tab_id` 생략

### POST /api/v1/notify 요청 본문

```json
{
  "title": "빌드 완료",
  "body": "프로젝트 X 빌드 성공"
}
```

## CLI 명령어

CLI는 REST API의 thin wrapper. `GOSOK_TAB_ID`와 `GOSOK_API_URL` 환경변수를 자동으로 사용.

```bash
# 1:1 다이렉트
gosok send <tab-id> "메시지"

# 브로드캐스트
gosok send --all "메시지"

# 글로벌 피드 게시
gosok feed "메시지"

# 글로벌 피드 조회
gosok feed

# inbox 확인 (GOSOK_TAB_ID 자동 사용)
gosok inbox

# 브라우저 알림
gosok notify "제목" --body "내용"
```

## 실시간 전달

### 별도 WebSocket 엔드포인트

`/api/ws/events` — 메시징/알림 전용 채널. 기존 터미널 WS(`/api/ws/sessions/{id}/terminal`)와 분리.

프론트엔드가 앱 레벨에서 한 번 연결하고, 탭과 무관하게 수신.

### 서버 → 프론트엔드 메시지 형태

```json
{"type": "message", "id": "01J...", "scope": "direct", "from_tab_id": "01J...", "to_tab_id": "01J...", "body": "빌드 끝남", "created_at": "..."}
{"type": "message", "id": "01J...", "scope": "broadcast", "from_tab_id": "01J...", "body": "DB 마이그레이션 완료", "created_at": "..."}
{"type": "message", "id": "01J...", "scope": "global", "from_tab_id": "01J...", "body": "v2.1 준비 완료", "created_at": "..."}
{"type": "notification", "title": "빌드 완료", "body": "프로젝트 X 빌드 성공"}
```

## 환경변수 주입

탭에서 프로세스 시작 시 자동 주입:

```
GOSOK_TAB_ID=01J...                          # 현재 탭 ID
GOSOK_API_URL=http://localhost:18435         # 서버 주소
```

CLI는 이 환경변수를 자동으로 읽어서 서버 주소와 자기 탭 ID를 알아서 사용.

## 메시지 수명

- **direct / broadcast:** 7일 보관 후 자동 정리
- **global feed:** 7일 보관 후 자동 정리
- **notify:** DB에 저장하지 않음 (fire-and-forget, WebSocket으로 브라우저에 바로 전달)
- 정리 시점: 서버 시작 시 + 24시간 주기

## 프론트엔드

- **알림:** `notification` 이벤트 수신 시 `Notification.requestPermission()` → `new Notification()` 호출
- **inbox 표시:** 탭 UI에 안 읽은 메시지 뱃지, 클릭하면 inbox 패널
- **global feed:** 사이드바 또는 별도 패널에 타임라인 형태

## 아키텍처 확장

```
internal/
  messaging/         # 메시지 CRUD, 읽음 추적, 정리
  notify/            # 브라우저 알림 허브 (WebSocket broadcast)
cmd/gosok/
  cmd/               # cobra 서브커맨드 (send, feed, inbox, notify)
frontend/src/
  hooks/useEvents.ts # /api/ws/events WebSocket 훅
  components/
    InboxPanel.tsx   # 탭별 메시지 목록
    FeedPanel.tsx    # 글로벌 피드
```

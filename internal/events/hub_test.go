package events

import (
	"sync"
	"testing"
	"time"
)

func TestHubPublishDeliversToSubscriber(t *testing.T) {
	h := NewHub()
	ch, unsub := h.Subscribe()
	defer unsub()

	h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "x"}})

	select {
	case ev := <-ch:
		if ev.Type != EventNotification || ev.Notification == nil || ev.Notification.Title != "x" {
			t.Fatalf("got unexpected event: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("did not receive published event")
	}
}

func TestHubPublishFanOutToAllSubscribers(t *testing.T) {
	h := NewHub()
	const n = 5
	chs := make([]<-chan Event, n)
	unsubs := make([]func(), n)
	for i := 0; i < n; i++ {
		chs[i], unsubs[i] = h.Subscribe()
		defer unsubs[i]()
	}

	h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "fan-out"}})

	for i, ch := range chs {
		select {
		case ev := <-ch:
			if ev.Notification == nil || ev.Notification.Title != "fan-out" {
				t.Fatalf("subscriber %d got %+v", i, ev)
			}
		case <-time.After(time.Second):
			t.Fatalf("subscriber %d did not receive event", i)
		}
	}
}

func TestHubUnsubscribeStopsDelivery(t *testing.T) {
	h := NewHub()
	ch, unsub := h.Subscribe()
	unsub()

	// After unsub the channel must be closed; publishing must not panic.
	h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "after-unsub"}})

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel must be closed after unsubscribe")
		}
	case <-time.After(time.Second):
		t.Fatal("channel was not closed after unsubscribe")
	}
}

func TestHubDropsWhenSubscriberFull(t *testing.T) {
	h := NewHub()
	ch, unsub := h.Subscribe()
	defer unsub()

	// Subscriber buffer is 64; publish 200 without draining.
	const sent = 200
	for i := 0; i < sent; i++ {
		h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "spam"}})
	}

	// Drain whatever made it.
	got := 0
drain:
	for {
		select {
		case <-ch:
			got++
		case <-time.After(50 * time.Millisecond):
			break drain
		}
	}

	if got >= sent {
		t.Fatalf("expected drops; received %d of %d (drop policy not enforced)", got, sent)
	}
	if got == 0 {
		t.Fatalf("expected at least some delivery; received nothing")
	}
	if got > 64 {
		t.Fatalf("buffer size is 64 but received %d before any drain", got)
	}
}

func TestHubSlowSubscriberDoesNotBlockOthers(t *testing.T) {
	h := NewHub()
	slow, unsubSlow := h.Subscribe()
	defer unsubSlow()
	fast, unsubFast := h.Subscribe()
	defer unsubFast()

	// Fill slow's buffer (64) and then some.
	for i := 0; i < 200; i++ {
		h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "x"}})
	}

	// Fast subscriber can still receive — proving Publish didn't block on slow.
	select {
	case <-fast:
	case <-time.After(time.Second):
		t.Fatal("fast subscriber starved by slow subscriber's full buffer")
	}
	_ = slow
}

func TestHubConcurrentPublishAndSubscribe(t *testing.T) {
	h := NewHub()
	const subs = 10
	const pubs = 10
	const each = 50

	var wg sync.WaitGroup
	wg.Add(subs)
	stop := make(chan struct{})
	for i := 0; i < subs; i++ {
		go func() {
			defer wg.Done()
			ch, unsub := h.Subscribe()
			defer unsub()
			for {
				select {
				case <-ch:
				case <-stop:
					return
				}
			}
		}()
	}

	var pubWg sync.WaitGroup
	pubWg.Add(pubs)
	for i := 0; i < pubs; i++ {
		go func() {
			defer pubWg.Done()
			for j := 0; j < each; j++ {
				h.Publish(Event{Type: EventNotification, Notification: &NotifPayload{Title: "c"}})
			}
		}()
	}
	pubWg.Wait()
	close(stop)
	wg.Wait()
}

func TestEventJSONIncludesType(t *testing.T) {
	got := Event{Type: EventNotification, Notification: &NotifPayload{Title: "t"}}.JSON()
	if !contains(string(got), `"type":"notification"`) {
		t.Fatalf("missing type field: %s", got)
	}
	if !contains(string(got), `"title":"t"`) {
		t.Fatalf("missing title: %s", got)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

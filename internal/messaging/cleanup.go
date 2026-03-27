package messaging

import (
	"context"
	"log"
	"time"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

func StartCleanupLoop(ctx context.Context, s store.Store, interval, ttl time.Duration) {
	purge := func() {
		n, err := s.PurgeOldMessages(context.Background(), time.Now().Add(-ttl))
		if err != nil {
			log.Printf("message cleanup error: %v", err)
		} else if n > 0 {
			log.Printf("purged %d expired messages", n)
		}
	}

	purge()

	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				purge()
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

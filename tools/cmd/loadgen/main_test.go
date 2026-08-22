package main

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestHammerHitsConcurrently(t *testing.T) {
	var hits atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)

	stats, err := hammer(server.URL+"/api/status", 20, 4, time.Second, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 20 || stats.ok != 20 || stats.err != 0 {
		t.Fatalf("hits=%d stats=%+v", hits.Load(), stats)
	}
}

func TestHammerCountsServerErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)

	stats, err := hammer(server.URL+"/api/status", 8, 2, time.Second, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if stats.err != 8 || stats.ok != 0 {
		t.Fatalf("expected all errors, got %+v", stats)
	}
}

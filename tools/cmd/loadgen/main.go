package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	base := flag.String("base", "", "origin, e.g. https://mathsmine3.xyz (required unless -help)")
	path := flag.String("path", "/api/status", "path to GET")
	n := flag.Int("n", 50, "total requests")
	c := flag.Int("c", 5, "concurrency")
	timeout := flag.Duration("timeout", 8*time.Second, "per-request timeout")
	flag.Parse()
	if *base == "" {
		fmt.Fprintln(os.Stderr, "usage: loadgen -base https://mathsmine3.xyz [-path /api/status -n 50 -c 5]")
		os.Exit(2)
	}
	stats, err := hammer(*base+*path, *n, *c, *timeout, http.DefaultClient)
	if err != nil {
		fmt.Fprintf(os.Stderr, "loadgen: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("ok  loadgen  n=%d c=%d ok=%d err=%d p95=%s\n",
		*n, *c, stats.ok, stats.err, stats.p95)
	if stats.err > 0 {
		os.Exit(1)
	}
}

type resultStats struct {
	ok  int64
	err int64
	p95 time.Duration
}

func hammer(url string, n, c int, timeout time.Duration, client *http.Client) (resultStats, error) {
	if n < 1 || c < 1 {
		return resultStats{}, fmt.Errorf("n and c must be >= 1")
	}
	client = cloneClient(client, timeout)
	jobs := make(chan struct{}, n)
	var okCount, errCount atomic.Int64
	latencies := make([]time.Duration, n)
	var mu sync.Mutex
	idx := 0

	var wg sync.WaitGroup
	for i := 0; i < c; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				start := time.Now()
				err := ping(client, url)
				elapsed := time.Since(start)
				mu.Lock()
				latencies[idx] = elapsed
				idx++
				mu.Unlock()
				if err != nil {
					errCount.Add(1)
					continue
				}
				okCount.Add(1)
			}
		}()
	}
	for i := 0; i < n; i++ {
		jobs <- struct{}{}
	}
	close(jobs)
	wg.Wait()
	return resultStats{ok: okCount.Load(), err: errCount.Load(), p95: percentile(latencies, 95)}, nil
}

func ping(client *http.Client, url string) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

func cloneClient(base *http.Client, timeout time.Duration) *http.Client {
	if base == nil {
		base = http.DefaultClient
	}
	out := *base
	out.Timeout = timeout
	return &out
}

func percentile(samples []time.Duration, p int) time.Duration {
	if len(samples) == 0 {
		return 0
	}
	cp := append([]time.Duration(nil), samples...)
	for i := 0; i < len(cp); i++ {
		for j := i + 1; j < len(cp); j++ {
			if cp[j] < cp[i] {
				cp[i], cp[j] = cp[j], cp[i]
			}
		}
	}
	rank := (p * (len(cp) - 1)) / 100
	return cp[rank]
}

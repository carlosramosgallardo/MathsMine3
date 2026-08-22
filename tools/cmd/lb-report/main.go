package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type leaderboardPage struct {
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
	Total int                `json:"total"`
	Items []leaderboardEntry `json:"items"`
}

type leaderboardEntry struct {
	Rank   int    `json:"rank"`
	Level  int    `json:"level"`
	IsBot  bool   `json:"is_bot"`
	Wallet string `json:"wallet"`
}

func main() {
	base := flag.String("base", "https://mathsmine3.xyz", "portal origin")
	limit := flag.Int("limit", 50, "page size (API clamps at 200)")
	flag.Parse()
	report, err := fetchReport(http.DefaultClient, *base, *limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "lb-report: %v\n", err)
		os.Exit(1)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(report)
}

func fetchReport(client *http.Client, base string, limit int) (map[string]any, error) {
	if client.Timeout == 0 {
		cloned := *client
		cloned.Timeout = 12 * time.Second
		client = &cloned
	}
	url := fmt.Sprintf("%s/api/leaderboard?page=1&limit=%d", trimSlash(base), limit)
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("%s: %s", resp.Status, body)
	}
	var page leaderboardPage
	if err := json.Unmarshal(body, &page); err != nil {
		return nil, err
	}
	bots, humans, legend := 0, 0, 0
	for _, item := range page.Items {
		if item.IsBot {
			bots++
		} else {
			humans++
		}
		if item.Level >= 80 {
			legend++
		}
	}
	return map[string]any{
		"source": url,
		"page":   page.Page,
		"total":  page.Total,
		"shown":  len(page.Items),
		"bots":   bots,
		"humans": humans,
		"legend": legend,
	}, nil
}

func trimSlash(base string) string {
	if len(base) > 0 && base[len(base)-1] == '/' {
		return base[:len(base)-1]
	}
	return base
}

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchReportCountsBotsAndLegend(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/leaderboard" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"page":  1,
			"limit": 50,
			"total": 3,
			"items": []map[string]any{
				{"rank": 1, "wallet": "0xaaa…", "level": 92, "is_bot": true},
				{"rank": 2, "wallet": "0xbbb…", "level": 40, "is_bot": false},
				{"rank": 3, "wallet": "0xccc…", "level": 81, "is_bot": false},
			},
		})
	}))
	t.Cleanup(server.Close)

	report, err := fetchReport(server.Client(), server.URL, 50)
	if err != nil {
		t.Fatal(err)
	}
	if report["total"] != 3 || report["bots"] != 1 || report["humans"] != 2 || report["legend"] != 2 {
		t.Fatalf("report=%v", report)
	}
}

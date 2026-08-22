package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
)

var jsonAnnot = regexp.MustCompile(`// json:([A-Za-z0-9_{}-]+)`)

func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		marker := filepath.Join(dir, "packages", "realtime-protocol", "channels.json")
		if _, statErr := os.Stat(marker); statErr == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "."
		}
		dir = parent
	}
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	} else {
		root = findRepoRoot()
	}
	jsonPath := filepath.Join(root, "packages", "realtime-protocol", "channels.json")
	protoPath := filepath.Join(root, "packages", "realtime-protocol", "mm3_realtime.proto")

	raw, err := os.ReadFile(jsonPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "protocol-lint: %v\n", err)
		os.Exit(1)
	}
	var doc any
	if err := json.Unmarshal(raw, &doc); err != nil {
		fmt.Fprintf(os.Stderr, "protocol-lint: channels.json: %v\n", err)
		os.Exit(1)
	}
	fromJSON := unique(collectStrings(doc))

	proto, err := os.ReadFile(protoPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "protocol-lint: %v\n", err)
		os.Exit(1)
	}
	matches := jsonAnnot.FindAllStringSubmatch(string(proto), -1)
	names := make([]string, 0, len(matches))
	for _, match := range matches {
		names = append(names, match[1])
	}
	names = unique(names)

	missingInProto := diff(fromJSON, names)
	extraInProto := diff(names, fromJSON)
	if len(missingInProto) == 0 && len(extraInProto) == 0 {
		fmt.Printf("ok  protocol-lint  %d channel strings\n", len(fromJSON))
		return
	}
	if len(missingInProto) > 0 {
		fmt.Fprintln(os.Stderr, "in channels.json, missing // json: annotation in proto:")
		for _, name := range missingInProto {
			fmt.Fprintf(os.Stderr, "  %s\n", name)
		}
	}
	if len(extraInProto) > 0 {
		fmt.Fprintln(os.Stderr, "annotated in proto, missing from channels.json:")
		for _, name := range extraInProto {
			fmt.Fprintf(os.Stderr, "  %s\n", name)
		}
	}
	os.Exit(1)
}

func collectStrings(value any) []string {
	switch typed := value.(type) {
	case string:
		return []string{typed}
	case []any:
		var out []string
		for _, item := range typed {
			out = append(out, collectStrings(item)...)
		}
		return out
	case map[string]any:
		var out []string
		for _, item := range typed {
			out = append(out, collectStrings(item)...)
		}
		return out
	default:
		return nil
	}
}

func unique(in []string) []string {
	sort.Strings(in)
	if len(in) == 0 {
		return in
	}
	out := []string{in[0]}
	for i := 1; i < len(in); i++ {
		if in[i] != in[i-1] {
			out = append(out, in[i])
		}
	}
	return out
}

func diff(want, have []string) []string {
	set := make(map[string]struct{}, len(have))
	for _, item := range have {
		set[item] = struct{}{}
	}
	var missing []string
	for _, item := range want {
		if _, ok := set[item]; !ok {
			missing = append(missing, item)
		}
	}
	return missing
}

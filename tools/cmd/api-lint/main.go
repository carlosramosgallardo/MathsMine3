package main

import (
	"bufio"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	} else {
		root = findRepoRoot()
	}
	disk, err := routesFromFilesystem(root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "api-lint: walk routes: %v\n", err)
		os.Exit(1)
	}
	listed, err := routesFromList(filepath.Join(root, "packages", "api-contracts", "routes.txt"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "api-lint: read routes.txt: %v\n", err)
		os.Exit(1)
	}
	missingOnDisk := diff(listed, disk)
	missingInList := diff(disk, listed)
	if len(missingOnDisk) == 0 && len(missingInList) == 0 {
		fmt.Printf("ok  api-lint  %d routes\n", len(disk))
		return
	}
	if len(missingInList) > 0 {
		fmt.Fprintln(os.Stderr, "present on disk, missing from routes.txt:")
		for _, route := range missingInList {
			fmt.Fprintf(os.Stderr, "  %s\n", route)
		}
	}
	if len(missingOnDisk) > 0 {
		fmt.Fprintln(os.Stderr, "listed in routes.txt, missing on disk:")
		for _, route := range missingOnDisk {
			fmt.Fprintf(os.Stderr, "  %s\n", route)
		}
	}
	os.Exit(1)
}

func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		marker := filepath.Join(dir, "packages", "api-contracts", "routes.txt")
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

func routesFromFilesystem(root string) ([]string, error) {
	apiRoot := filepath.Join(root, "app", "api")
	var routes []string
	err := filepath.WalkDir(apiRoot, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || entry.Name() != "route.js" {
			return nil
		}
		rel, relErr := filepath.Rel(apiRoot, filepath.Dir(path))
		if relErr != nil {
			return relErr
		}
		if rel == "." {
			routes = append(routes, "/api")
			return nil
		}
		routes = append(routes, "/api/"+filepath.ToSlash(rel))
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(routes)
	return routes, nil
}

func routesFromList(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	var routes []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		routes = append(routes, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	sort.Strings(routes)
	return unique(routes), nil
}

func unique(in []string) []string {
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

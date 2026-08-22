package github.workflows

deny[msg] {
	step := input.jobs[_].steps[_]
	uses := step.uses
	is_string(uses)
	not startswith(uses, "./")
	not regex.match(`^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@[0-9a-f]{40}$`, uses)
	msg := sprintf("unpinned action: %s", [uses])
}

deny[msg] {
	not input.permissions
	msg := "workflow must set top-level permissions (least privilege)"
}

deny[msg] {
	input.permissions == "write-all"
	msg := "permissions: write-all is not allowed"
}

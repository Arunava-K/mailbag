// Package version reports which build is running. The values are injected at
// link time by the image build (see Dockerfile and .github/workflows/docker.yml);
// the defaults cover `go run` and `go test`.
package version

import "runtime"

var (
	Version   = "dev"
	Commit    = "none"
	BuildTime = "unknown"
)

// Info is the JSON shape served by GET /version.
type Info struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"build_time"`
	Go        string `json:"go"`
}

// Get returns the running build's identity.
func Get() Info {
	return Info{Version: Version, Commit: Commit, BuildTime: BuildTime, Go: runtime.Version()}
}

// String is the one-line form used in startup logs.
func String() string {
	return Version + " (" + Commit + ", built " + BuildTime + ")"
}

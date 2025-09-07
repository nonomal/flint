package main

import (
	"embed"
	"github.com/ccheshirecat/flint/cmd"
)

//go:embed web/out/*
//go:embed web/public/*
var assets embed.FS

func main() {
	cmd.ExecuteWithAssets(assets)
}

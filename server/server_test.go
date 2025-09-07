package server

import (
	"embed"
	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"testing"
)

//go:embed testdata/*
var testAssets embed.FS

func TestServer_GetAPIKey(t *testing.T) {
	// Create a mock client (we'll need to implement a mock for testing)
	// For now, just test that the method exists and returns a string
	client, err := libvirtclient.NewClient("test:///default", "isos", "templates")
	if err != nil {
		t.Skip("Skipping test: libvirt not available in test environment")
	}
	defer client.Close()

	server := NewServer(client, testAssets)
	apiKey := server.GetAPIKey()

	// API key should be a non-empty string
	if apiKey == "" {
		t.Error("GetAPIKey() returned empty string")
	}

	// API key should be 64 characters (32 bytes hex encoded)
	if len(apiKey) != 64 {
		t.Errorf("GetAPIKey() returned string of length %d, expected 64", len(apiKey))
	}
}

func TestValidateAuthToken(t *testing.T) {
	// Create a test server
	client, err := libvirtclient.NewClient("test:///default", "isos", "templates")
	if err != nil {
		t.Skip("Skipping test: libvirt not available in test environment")
	}
	defer client.Close()

	server := NewServer(client, testAssets)

	tests := []struct {
		name  string
		token string
		valid bool
	}{
		{
			name:  "valid token",
			token: server.GetAPIKey(),
			valid: true,
		},
		{
			name:  "empty token",
			token: "",
			valid: false,
		},
		{
			name:  "wrong length",
			token: "short",
			valid: false,
		},
		{
			name:  "invalid hex",
			token: "zzzz8400e29b41d4a716446655440000e29b41d4a716446655440000e29b41d4a716",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := server.validateAuthToken(tt.token)
			if result != tt.valid {
				t.Errorf("validateAuthToken() = %v, want %v", result, tt.valid)
			}
		})
	}
}

package server

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"io/fs"
	"net/http"
)

type Server struct {
	router *chi.Mux
	client libvirtclient.ClientInterface
	assets embed.FS
}

func NewServer(client libvirtclient.ClientInterface, assets embed.FS) *Server {
	s := &Server{
		router: chi.NewRouter(),
		client: client,
		assets: assets,
	}

	s.router.Use(middleware.Logger) // Add logging middleware
	s.setupRoutes()
	return s
}

// Serve embedded static files via chi, without overriding API routes
func (s *Server) setupRoutes() {
	// API routes
	s.router.Route("/api", func(r chi.Router) {
		r.Get("/ssh-key/detect", s.handleDetectSSHKey())
		r.Get("/vms", s.handleGetVMs())
		r.Post("/vms", s.handleCreateVM())
		r.Post("/vms/from-template", s.handleCreateVMFromTemplate())
		r.Get("/vms/{uuid}", s.handleGetVMDetails())
		r.Delete("/vms/{uuid}", s.handleDeleteVM())
		r.Post("/vms/{uuid}/action", s.handleVMAction())
		r.Get("/vms/{uuid}/serial-console", s.handleGetVMSerialConsole())
		r.Get("/vms/{uuid}/serial-console/ws", s.handleVMSerialConsoleWS())
		r.Get("/vms/{uuid}/console-stream", s.handleGetVMConsoleStream())
		r.Get("/vms/{uuid}/snapshots", s.handleGetVMSnapshots())
		r.Post("/vms/{uuid}/snapshots", s.handleCreateVMSnapshot())
		r.Delete("/vms/{uuid}/snapshots/{snapshotName}", s.handleDeleteVMSnapshot())
		r.Post("/vms/{uuid}/snapshots/{snapshotName}/revert", s.handleRevertToVMSnapshot())
		r.Get("/vm-templates", s.handleGetVMTemplates())
		r.Post("/vm-templates", s.handleCreateVMTemplate())
		r.Get("/vms/{uuid}/performance", s.handleGetVMPerformance())
		r.Post("/vms/{uuid}/attach-disk", s.handleAttachDiskToVM())
		r.Post("/vms/{uuid}/attach-network", s.handleAttachNetworkInterfaceToVM())
		r.Get("/host/status", s.handleGetHostStatus())
		r.Get("/host/resources", s.handleGetHostResources())
		r.Get("/storage-pools", s.handleGetStoragePools())
		r.Get("/storage-pools/{poolName}/volumes", s.handleGetVolumes())
		r.Post("/storage-pools/{poolName}/volumes", s.handleCreateVolume())
		r.Get("/networks", s.handleGetNetworks())
		r.Post("/networks", s.handleCreateNetwork())
		r.Delete("/networks/{networkName}", s.handleDeleteNetwork())
		r.Get("/images", s.handleGetImages())
		r.Post("/images/import-from-path", s.handleImportImageFromPath())
		r.Post("/images/download", s.handleDownloadImage())
		r.Delete("/images/{imageId}", s.handleDeleteImage())
		r.Get("/activity", s.handleGetActivity())
	})

	// Serve embedded frontend through chi
	stripped, err := fs.Sub(s.assets, "web/out")
	if err != nil {
		panic(err)
	}
	s.router.Handle("/*", http.FileServer(http.FS(stripped)))
}

func (s *Server) Start(addr string) error {
	if addr == "" {
		addr = "0.0.0.0:5550"
	}
	return http.ListenAndServe(addr, s.router)
}

// validateAuthToken validates an authentication token

func (s *Server) validateAuthToken(token string) bool {
	// For now, implement a simple token validation

	if token == "" {
		return false
	}

	// Simple validation: check if token is a valid hex string of expected length
	if len(token) != 64 { // 32 bytes = 64 hex characters
		return false
	}

	// Check if it's valid hex
	for _, r := range token {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}

	return true
}

// generateAuthToken generates a secure authentication token
func (s *Server) generateAuthToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

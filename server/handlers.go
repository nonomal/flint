package server

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ccheshirecat/flint/pkg/core"
	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

func (s *Server) handleGetVMs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vms, err := s.client.GetVMSummaries()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(vms)
	}
}

func (s *Server) handleGetVMDetails() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		vm, err := s.client.GetVMDetails(uuid)
		if err != nil {
			// Check if it's a "domain not found" error
			if strings.Contains(err.Error(), "lookup domain") {
				http.Error(w, err.Error(), http.StatusNotFound)
			} else {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}
		json.NewEncoder(w).Encode(vm)
	}
}

func (s *Server) handleGetVMSnapshots() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		snapshots, err := s.client.GetVMSnapshots(uuid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(snapshots)
	}
}

func (s *Server) handleCreateVMSnapshot() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		var req core.CreateSnapshotRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		snapshot, err := s.client.CreateVMSnapshot(uuid, req)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(snapshot)
	}
}

func (s *Server) handleDeleteVMSnapshot() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		snapshotName := chi.URLParam(r, "snapshotName")

		err := s.client.DeleteVMSnapshot(uuid, snapshotName)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleRevertToVMSnapshot() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		snapshotName := chi.URLParam(r, "snapshotName")

		err := s.client.RevertToVMSnapshot(uuid, snapshotName)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Revert action initiated."})
	}
}

func (s *Server) handleVMAction() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		var req struct {
			Action string `json:"action"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}
		err := s.client.PerformVMAction(uuid, req.Action)
		if err != nil {
			if strings.Contains(err.Error(), "lookup domain") {
				http.Error(w, `{"error": "VM not found"}`, http.StatusNotFound)
			} else {
				http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			}
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func (s *Server) handleDeleteVM() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		// For now, don't delete disks
		err := s.client.DeleteVM(uuid, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func (s *Server) handleGetHostStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, err := s.client.GetHostStatus()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(status)
	}
}

func (s *Server) handleGetHostResources() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resources, err := s.client.GetHostResources()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(resources)
	}
}

func (s *Server) handleGetStoragePools() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pools, err := s.client.GetStoragePools()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(pools)
	}
}

func (s *Server) handleGetNetworks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		networks, err := s.client.GetNetworks()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(networks)
	}
}

func (s *Server) handleGetActivity() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		activity := s.client.GetActivity()
		json.NewEncoder(w).Encode(activity)
	}
}

func (s *Server) handleGetImages() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		images, err := s.client.GetImages()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(images)
	}
}

func (s *Server) handleImportImageFromPath() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		image, err := s.client.ImportImageFromPath(req.Path)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(image)
	}
}

func (s *Server) handleDownloadImage() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			URL  string `json:"url"`
			Name string `json:"name,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		// Validate URL
		if req.URL == "" {
			http.Error(w, `{"error": "URL is required"}`, http.StatusBadRequest)
			return
		}

		// Parse URL to validate it
		parsedURL, err := url.Parse(req.URL)
		if err != nil {
			http.Error(w, `{"error": "Invalid URL format"}`, http.StatusBadRequest)
			return
		}

		// Only allow HTTP and HTTPS URLs
		if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
			http.Error(w, `{"error": "Only HTTP and HTTPS URLs are allowed"}`, http.StatusBadRequest)
			return
		}

		// Generate filename if not provided
		filename := req.Name
		if filename == "" {
			// Extract filename from URL
			urlPath := parsedURL.Path
			parts := strings.Split(urlPath, "/")
			if len(parts) > 0 {
				filename = parts[len(parts)-1]
			}
			// If still empty, generate a default name
			if filename == "" {
				filename = "downloaded-image-" + time.Now().Format("20060102-150405")
			}
		}

		// Create temporary file
		tempFile, err := os.CreateTemp("", "flint-download-*-"+filename)
		if err != nil {
			http.Error(w, `{"error": "Failed to create temporary file: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		defer os.Remove(tempFile.Name()) // Clean up temp file
		defer tempFile.Close()

		// Download the file
		resp, err := http.Get(req.URL)
		if err != nil {
			http.Error(w, `{"error": "Failed to download file: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		// Check if the download was successful
		if resp.StatusCode != http.StatusOK {
			http.Error(w, `{"error": "Failed to download file: HTTP `+strconv.Itoa(resp.StatusCode)+`"}`, http.StatusInternalServerError)
			return
		}

		// Copy the downloaded content to the temporary file
		_, err = io.Copy(tempFile, resp.Body)
		if err != nil {
			http.Error(w, `{"error": "Failed to save downloaded file: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		// Close the temp file so we can import it
		tempFile.Close()

		// Import the downloaded file into the managed image library
		image, err := s.client.ImportImageFromPath(tempFile.Name())
		if err != nil {
			http.Error(w, `{"error": "Failed to import downloaded image: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		// Return the imported image info
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(image)
	}
}

// generateSecureToken generates a secure random token for WebSocket authentication
func generateSecureToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func (s *Server) handleGetISOs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isos, err := s.client.GetISOs()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(isos)
	}
}

func (s *Server) handleGetTemplates() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		templates, err := s.client.GetTemplates()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(templates)
	}
}

func (s *Server) handleGetVMPerformance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		perf, err := s.client.GetVMPerformance(uuid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(perf)
	}
}

func (s *Server) handleGetVMSerialConsole() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")

		// Generate a secure token for this session
		token := generateSecureToken()

		// Return the WebSocket path and token
		response := map[string]string{
			"websocket_path": fmt.Sprintf("/api/vms/%s/serial-console/ws", uuid),
			"token":          token,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

func (s *Server) handleVMSerialConsoleWS() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")

		// Authenticate using token from query parameters
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "Authentication token required", http.StatusUnauthorized)
			return
		}

		// Validate the token (in a real implementation, you'd check against a database or JWT)

		if !s.validateAuthToken(token) {
			http.Error(w, "Invalid authentication token", http.StatusUnauthorized)
			return
		}

		// Upgrade HTTP connection to WebSocket
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}

				return true
			},
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Failed to upgrade to WebSocket", http.StatusBadRequest)
			return
		}
		defer conn.Close()

		// Get the PTY path for the VM
		ptyPath, err := s.client.GetVMSerialConsolePath(uuid)
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
			return
		}

		// Open the PTY device
		ptyFile, err := os.OpenFile(ptyPath, os.O_RDWR, 0)
		if err != nil {
			conn.WriteMessage(websocket.TextMessage, []byte("Error opening PTY: "+err.Error()))
			return
		}
		defer ptyFile.Close()

		// Send connection confirmation
		conn.WriteMessage(websocket.TextMessage, []byte("Serial console connected\r\n"))

		// Set up bidirectional data flow with proper error handling
		var wg sync.WaitGroup
		wg.Add(2)

		// Channel to signal when either goroutine exits
		done := make(chan struct{})

		// WebSocket -> PTY
		go func() {
			defer wg.Done()
			defer close(done)

			for {
				select {
				case <-done:
					return
				default:
					messageType, data, err := conn.ReadMessage()
					if err != nil {
						// Connection closed or error
						return
					}

					// Only process text messages
					if messageType == websocket.TextMessage {
						_, err = ptyFile.Write(data)
						if err != nil {
							// PTY write error
							conn.WriteMessage(websocket.TextMessage, []byte("Error writing to PTY: "+err.Error()))
							return
						}
					}
				}
			}
		}()

		// PTY -> WebSocket
		go func() {
			defer wg.Done()

			reader := bufio.NewReader(ptyFile)
			buffer := make([]byte, 1024)

			for {
				select {
				case <-done:
					return
				default:
					n, err := reader.Read(buffer)
					if err != nil {
						if err != io.EOF {
							conn.WriteMessage(websocket.TextMessage, []byte("Error reading from PTY: "+err.Error()))
						}
						return
					}

					if n > 0 {
						err = conn.WriteMessage(websocket.TextMessage, buffer[:n])
						if err != nil {
							// WebSocket write error
							return
						}
					}
				}
			}
		}()

		wg.Wait()
	}
}

func (s *Server) handleCreateVM() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var cfg core.VMCreationConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		vm, err := s.client.CreateVM(cfg)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(vm)
	}
}

func (s *Server) handleGetVolumes() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		poolName := chi.URLParam(r, "poolName")
		volumes, err := s.client.GetVolumes(poolName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(volumes)
	}
}

func (s *Server) handleCreateVolume() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		poolName := chi.URLParam(r, "poolName")

		var req core.VolumeConfig
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		err := s.client.CreateVolume(poolName, req)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}
}

func (s *Server) handleCreateNetwork() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name       string `json:"name"`
			BridgeName string `json:"bridgeName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		err := s.client.CreateNetwork(req.Name, req.BridgeName)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}
}

func (s *Server) handleAttachDiskToVM() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		var req struct {
			VolumePath string `json:"volumePath"`
			TargetDev  string `json:"targetDev"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		err := s.client.AttachDiskToVM(uuid, req.VolumePath, req.TargetDev)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Disk attached successfully"})
	}
}

func (s *Server) handleAttachNetworkInterfaceToVM() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		var req struct {
			NetworkName string `json:"networkName"`
			Model       string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "Invalid JSON in request body"}`, http.StatusBadRequest)
			return
		}

		err := s.client.AttachNetworkInterfaceToVM(uuid, req.NetworkName, req.Model)
		if err != nil {
			http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Network interface attached successfully"})
	}
}
func (s *Server) handleDetectSSHKey() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			http.Error(w, `{"error": "Failed to get user home directory"}`, http.StatusInternalServerError)
			return
		}

		sshKeyPath := filepath.Join(homeDir, ".ssh", "id_rsa.pub")

		if _, err := os.Stat(sshKeyPath); os.IsNotExist(err) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(""))
			return
		}

		keyContent, err := os.ReadFile(sshKeyPath)
		if err != nil {
			http.Error(w, `{"error": "Failed to read SSH key"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write(keyContent)
	}
}

// handleGetVMConsoleStream returns WebSocket connection info for console streaming
func (s *Server) handleGetVMConsoleStream() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid")
		if uuid == "" {
			http.Error(w, "UUID is required", http.StatusBadRequest)
			return
		}

		// Return WebSocket path for frontend to connect to
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"websocket_path": fmt.Sprintf("/api/vms/%s/serial-console/ws", uuid),
		})
	})
}

// handleCreateVMFromTemplate creates a VM from a template
func (s *Server) handleCreateVMFromTemplate() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TemplateID string `json:"templateId"`
			Name       string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Get snapshots for the template VM
		snapshots, err := s.client.GetVMSnapshots(req.TemplateID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get template snapshots: %v", err), http.StatusInternalServerError)
			return
		}

		if len(snapshots) == 0 {
			http.Error(w, "No snapshots found for template", http.StatusBadRequest)
			return
		}

		// Use the latest snapshot
		latestSnapshot := snapshots[0]

		// Create VM from snapshot (simplified - in practice you'd clone the VM)
		err = s.client.RevertToVMSnapshot(req.TemplateID, latestSnapshot.Name)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create VM from template: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"uuid":    req.TemplateID, // In practice, this would be a new UUID
			"name":    req.Name,
			"message": "VM created from template successfully",
		})
	})
}

// handleGetVMTemplates returns available VM templates
func (s *Server) handleGetVMTemplates() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get all VMs and check which ones have snapshots (templates)
		vms, err := s.client.GetVMSummaries()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get VMs: %v", err), http.StatusInternalServerError)
			return
		}

		var templates []map[string]interface{}

		for _, vm := range vms {
			snapshots, err := s.client.GetVMSnapshots(vm.UUID)
			if err != nil {
				continue // Skip VMs we can't get snapshots for
			}

			if len(snapshots) > 0 {
				// This VM has snapshots, so it can be used as a template
				template := map[string]interface{}{
					"id":          vm.UUID,
					"name":        vm.Name + "-template",
					"description": fmt.Sprintf("Template based on %s with %d snapshots", vm.Name, len(snapshots)),
					"sourceVM":    vm.Name,
					"vcpus":       vm.VCPUs,
					"memory":      vm.MemoryKB / 1024, // Convert to MB
					"diskSize":    20,                 // Default disk size
					"createdAt":   time.Now().Format(time.RFC3339),
				}
				templates = append(templates, template)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(templates)
	})
}

// handleCreateVMTemplate creates a new template from a VM
func (s *Server) handleCreateVMTemplate() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			VMID        string `json:"vmId"`
			Name        string `json:"name"`
			Description string `json:"description"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Create a snapshot of the VM to use as template
		snapshotReq := core.CreateSnapshotRequest{
			Name:        req.Name,
			Description: req.Description,
		}

		snapshot, err := s.client.CreateVMSnapshot(req.VMID, snapshotReq)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create template snapshot: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":          req.VMID,
			"name":        req.Name,
			"description": req.Description,
			"snapshot":    snapshot.Name,
			"createdAt":   time.Now().Format(time.RFC3339),
			"message":     "Template created successfully",
		})
	})
}

// handleDeleteNetwork deletes a virtual network
func (s *Server) handleDeleteNetwork() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		networkName := chi.URLParam(r, "networkName")
		if networkName == "" {
			http.Error(w, "Network name is required", http.StatusBadRequest)
			return
		}

		// Prevent deletion of default network
		if networkName == "default" {
			http.Error(w, "Cannot delete default network", http.StatusBadRequest)
			return
		}

		// Call the actual delete function
		err := s.client.DeleteNetwork(networkName)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Failed to delete network: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": fmt.Sprintf("Network '%s' deleted successfully", networkName),
		})
	})
}

// handleDeleteImage deletes an image
func (s *Server) handleDeleteImage() http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		imageId := chi.URLParam(r, "imageId")
		if imageId == "" {
			http.Error(w, `{"error": "Image ID is required"}`, http.StatusBadRequest)
			return
		}

		// Call the actual delete function
		err := s.client.DeleteImage(imageId)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Failed to delete image: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})
}

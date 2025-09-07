package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

var imageCmd = &cobra.Command{
	Use:   "image",
	Short: "Manage cloud image repository",
	Long:  "flint image provides commands to browse, download, and manage cloud images",
}

var imageListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available cloud images",
	Long:  "List all available cloud images in the repository with download status",
	Run: func(cmd *cobra.Command, args []string) {
		baseURL, _ := cmd.Flags().GetString("server")
		if baseURL == "" {
			baseURL = "http://localhost:8080"
		}

		resp, err := http.Get(baseURL + "/api/image-repository")
		if err != nil {
			log.Fatalf("Failed to connect to server: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Fatalf("Server returned error: %s", resp.Status)
		}

		var images []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&images); err != nil {
			log.Fatalf("Failed to decode response: %v", err)
		}

		// Display in table format
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tNAME\tOS\tVERSION\tARCH\tSIZE\tSTATUS")
		fmt.Fprintln(w, "---\t----\t--\t-------\t----\t----\t------")

		for _, img := range images {
			id := img["id"].(string)
			name := img["name"].(string)
			os := img["os"].(string)
			version := img["version"].(string)
			arch := img["architecture"].(string)
			size := img["size"].(string)
			
			status := "Available"
			if downloaded, ok := img["downloaded"].(bool); ok && downloaded {
				status = "Downloaded"
			}

			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
				id, name, os, version, arch, size, status)
		}
		w.Flush()
	},
}

var imageDownloadCmd = &cobra.Command{
	Use:   "download [image-id]",
	Short: "Download a cloud image",
	Long:  "Download a cloud image from the repository",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		imageID := args[0]
		baseURL, _ := cmd.Flags().GetString("server")
		if baseURL == "" {
			baseURL = "http://localhost:8080"
		}

		// Start download
		resp, err := http.Post(baseURL+"/api/image-repository/"+imageID+"/download", "application/json", nil)
		if err != nil {
			log.Fatalf("Failed to start download: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Fatalf("Failed to start download: %s", resp.Status)
		}

		fmt.Printf("Download started for image: %s\n", imageID)
		fmt.Println("Use 'flint image status' to check progress")

		// Optionally wait for completion if --wait flag is set
		wait, _ := cmd.Flags().GetBool("wait")
		if wait {
			fmt.Println("Waiting for download to complete...")
			for {
				time.Sleep(2 * time.Second)
				
				statusResp, err := http.Get(baseURL + "/api/image-repository/" + imageID + "/status")
				if err != nil {
					log.Printf("Failed to check status: %v", err)
					continue
				}

				var status map[string]interface{}
				json.NewDecoder(statusResp.Body).Decode(&status)
				statusResp.Body.Close()

				if downloading, ok := status["downloading"].(bool); !ok || !downloading {
					if downloaded, ok := status["downloaded"].(bool); ok && downloaded {
						fmt.Println("✅ Download completed successfully!")
					} else {
						fmt.Println("❌ Download failed")
					}
					break
				}

				if progress, ok := status["progress"].(float64); ok {
					fmt.Printf("\rProgress: %.1f%%", progress*100)
				}
			}
		}
	},
}

var imageStatusCmd = &cobra.Command{
	Use:   "status [image-id]",
	Short: "Check download status of an image",
	Long:  "Check the download status and progress of a cloud image",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		baseURL, _ := cmd.Flags().GetString("server")
		if baseURL == "" {
			baseURL = "http://localhost:8080"
		}

		if len(args) == 0 {
			// Show status for all images
			resp, err := http.Get(baseURL + "/api/image-repository")
			if err != nil {
				log.Fatalf("Failed to connect to server: %v", err)
			}
			defer resp.Body.Close()

			var images []map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&images)

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tNAME\tSTATUS\tPROGRESS")
			fmt.Fprintln(w, "---\t----\t------\t--------")

			for _, img := range images {
				id := img["id"].(string)
				name := img["name"].(string)
				
				status := "Available"
				progress := ""
				
				if downloaded, ok := img["downloaded"].(bool); ok && downloaded {
					status = "Downloaded"
					progress = "100%"
				} else if downloading, ok := img["downloading"].(bool); ok && downloading {
					status = "Downloading"
					if prog, ok := img["progress"].(float64); ok {
						progress = fmt.Sprintf("%.1f%%", prog*100)
					}
				}

				fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", id, name, status, progress)
			}
			w.Flush()
		} else {
			// Show status for specific image
			imageID := args[0]
			resp, err := http.Get(baseURL + "/api/image-repository/" + imageID + "/status")
			if err != nil {
				log.Fatalf("Failed to check status: %v", err)
			}
			defer resp.Body.Close()

			var status map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&status)

			fmt.Printf("Image ID: %s\n", imageID)
			if downloaded, ok := status["downloaded"].(bool); ok && downloaded {
				fmt.Println("Status: Downloaded ✅")
				if path, ok := status["path"].(string); ok {
					fmt.Printf("Path: %s\n", path)
				}
			} else if downloading, ok := status["downloading"].(bool); ok && downloading {
				fmt.Println("Status: Downloading 📥")
				if progress, ok := status["progress"].(float64); ok {
					fmt.Printf("Progress: %.1f%%\n", progress*100)
				}
			} else {
				fmt.Println("Status: Available for download")
			}
		}
	},
}

func init() {
	imageCmd.AddCommand(imageListCmd)
	imageCmd.AddCommand(imageDownloadCmd)
	imageCmd.AddCommand(imageStatusCmd)

	// Add server flag to all image commands
	imageListCmd.Flags().String("server", "http://localhost:8080", "Flint server URL")
	imageDownloadCmd.Flags().String("server", "http://localhost:8080", "Flint server URL")
	imageDownloadCmd.Flags().Bool("wait", false, "Wait for download to complete")
	imageStatusCmd.Flags().String("server", "http://localhost:8080", "Flint server URL")
}
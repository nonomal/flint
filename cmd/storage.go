package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"text/tabwriter"

	"github.com/ccheshirecat/flint/pkg/core"
	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"github.com/spf13/cobra"
)

var storageCmd = &cobra.Command{
	Use:   "storage",
	Short: "Manage storage pools and volumes",
	Long:  `Create, delete, resize, and list storage pools and volumes.`,
}

var storagePoolCmd = &cobra.Command{
	Use:   "pool",
	Short: "Manage storage pools",
	Long:  `Create, delete, and list storage pools.`,
}

var storageVolumeCmd = &cobra.Command{
	Use:   "volume",
	Short: "Manage storage volumes",
	Long:  `Create, delete, resize, and list storage volumes.`,
}

var poolListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List storage pools",
	Long: `List all storage pools with their status and capacity.

Examples:
  flint storage pool list                # List all pools
  flint storage pool list --format json # JSON output`,
	Run: func(cmd *cobra.Command, args []string) {
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		pools, err := client.GetStoragePools()
		if err != nil {
			log.Fatalf("Failed to get storage pools: %v", err)
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			jsonData, _ := json.MarshalIndent(pools, "", "  ")
			fmt.Println(string(jsonData))
			return
		}

		displayPoolsTable(pools)
	},
}

var volumeListCmd = &cobra.Command{
	Use:     "list [pool-name]",
	Aliases: []string{"ls"},
	Short:   "List volumes in a storage pool",
	Long: `List all volumes in the specified storage pool.

Examples:
  flint storage volume list default     # List volumes in default pool
  flint storage volume list --format json default`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		poolName := args[0]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		volumes, err := client.GetVolumes(poolName)
		if err != nil {
			log.Fatalf("Failed to get volumes: %v", err)
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			jsonData, _ := json.MarshalIndent(volumes, "", "  ")
			fmt.Println(string(jsonData))
			return
		}

		displayVolumesTable(volumes)
	},
}

var volumeCreateCmd = &cobra.Command{
	Use:   "create [pool-name] [volume-name]",
	Short: "Create a storage volume",
	Long: `Create a new storage volume in the specified pool.

Examples:
  flint storage volume create default myvolume --size 10G
  flint storage volume create default myvolume --size 10G --format qcow2`,
	Args: cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		poolName := args[0]
		volumeName := args[1]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		sizeStr, _ := cmd.Flags().GetString("size")

		// Parse size (e.g., "10G", "1024M")
		sizeGB, err := parseSizeToGB(sizeStr)
		if err != nil {
			log.Fatalf("Invalid size format: %v", err)
		}

		config := core.VolumeConfig{
			Name:   volumeName,
			SizeGB: uint64(sizeGB),
		}

		err = client.CreateVolume(poolName, config)
		if err != nil {
			log.Fatalf("Failed to create volume: %v", err)
		}

		fmt.Printf("Volume '%s' created successfully in pool '%s'\n", volumeName, poolName)
	},
}

var volumeDeleteCmd = &cobra.Command{
	Use:   "delete [pool-name] [volume-name]",
	Short: "Delete a storage volume",
	Long: `Delete an existing storage volume from the specified pool.

Examples:
  flint storage volume delete default myvolume`,
	Args: cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		poolName := args[0]
		volumeName := args[1]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		err = client.DeleteVolume(poolName, volumeName)
		if err != nil {
			log.Fatalf("Failed to delete volume: %v", err)
		}

		fmt.Printf("Volume '%s' deleted successfully from pool '%s'\n", volumeName, poolName)
	},
}

var volumeResizeCmd = &cobra.Command{
	Use:   "resize [pool-name] [volume-name] [new-size]",
	Short: "Resize a storage volume",
	Long: `Resize an existing storage volume. Only expansion is supported for safety.

Examples:
  flint storage volume resize default myvolume 20G`,
	Args: cobra.ExactArgs(3),
	Run: func(cmd *cobra.Command, args []string) {
		poolName := args[0]
		volumeName := args[1]
		newSizeStr := args[2]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		newSizeGB, err := parseSizeToGB(newSizeStr)
		if err != nil {
			log.Fatalf("Invalid size format: %v", err)
		}

		config := core.VolumeConfig{
			Name:   volumeName,
			SizeGB: uint64(newSizeGB),
		}
		err = client.UpdateVolume(poolName, volumeName, config)
		if err != nil {
			log.Fatalf("Failed to resize volume: %v", err)
		}

		fmt.Printf("Volume '%s' resized successfully to %s\n", volumeName, newSizeStr)
	},
}

func displayPoolsTable(pools interface{}) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tSTATUS\tCAPACITY\tALLOCATED\tAVAILABLE")
	fmt.Fprintln(w, "----\t------\t--------\t---------\t---------")

	switch v := pools.(type) {
	case []interface{}:
		for _, pool := range v {
			if poolMap, ok := pool.(map[string]interface{}); ok {
				name := getStringField(poolMap, "name")
				status := getStringField(poolMap, "state")
				
				capacity := formatBytes(getInt64Field(poolMap, "capacity_b"))
				allocated := formatBytes(getInt64Field(poolMap, "allocation_b"))
				available := formatBytes(getInt64Field(poolMap, "capacity_b") - getInt64Field(poolMap, "allocation_b"))

				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", name, status, capacity, allocated, available)
			}
		}
	}

	w.Flush()
}

func displayVolumesTable(volumes interface{}) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tCAPACITY\tALLOCATION\tFORMAT\tPATH")
	fmt.Fprintln(w, "----\t--------\t----------\t------\t----")

	switch v := volumes.(type) {
	case []interface{}:
		for _, volume := range v {
			if volMap, ok := volume.(map[string]interface{}); ok {
				name := getStringField(volMap, "name")
				capacity := formatBytes(getInt64Field(volMap, "capacity_b"))
				allocation := formatBytes(getInt64Field(volMap, "allocation_b"))
				format := getStringField(volMap, "format")
				path := getStringField(volMap, "path")

				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", name, capacity, allocation, format, path)
			}
		}
	}

	w.Flush()
}

func getInt64Field(m map[string]interface{}, key string) int64 {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int64:
			return v
		case int:
			return int64(v)
		case float64:
			return int64(v)
		}
	}
	return 0
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func parseSizeToGB(sizeStr string) (float64, error) {
	if len(sizeStr) == 0 {
		return 0, fmt.Errorf("empty size string")
	}

	// Extract unit
	unit := sizeStr[len(sizeStr)-1:]
	valueStr := sizeStr[:len(sizeStr)-1]

	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid size value: %v", err)
	}

	switch unit {
	case "G", "g":
		return value, nil
	case "M", "m":
		return value / 1024, nil
	case "T", "t":
		return value * 1024, nil
	default:
		return 0, fmt.Errorf("unsupported unit: %s (use G, M, or T)", unit)
	}
}

func init() {
	// Add subcommands
	storageCmd.AddCommand(storagePoolCmd)
	storageCmd.AddCommand(storageVolumeCmd)
	
	storagePoolCmd.AddCommand(poolListCmd)
	
	storageVolumeCmd.AddCommand(volumeListCmd)
	storageVolumeCmd.AddCommand(volumeCreateCmd)
	storageVolumeCmd.AddCommand(volumeDeleteCmd)
	storageVolumeCmd.AddCommand(volumeResizeCmd)

	// Add flags
	poolListCmd.Flags().String("format", "table", "Output format (table, json)")
	volumeListCmd.Flags().String("format", "table", "Output format (table, json)")
	
	volumeCreateCmd.Flags().String("size", "10G", "Size of the volume (e.g., 10G, 1024M)")
	volumeCreateCmd.Flags().String("format", "qcow2", "Format of the volume (qcow2, raw)")
}
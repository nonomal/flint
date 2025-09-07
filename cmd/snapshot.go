package cmd

import (
	"fmt"
	"log"
	"os"
	"text/tabwriter"
	"time"

	"github.com/ccheshirecat/flint/pkg/core"
	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"github.com/spf13/cobra"
)

var (
	snapshotName string
	description  string
)

var snapshotCmd = &cobra.Command{
	Use:   "snapshot",
	Short: "Manage VM snapshots",
	Long:  `Create, list, and manage VM snapshots for quick VM templating.`,
}

var createSnapshotCmd = &cobra.Command{
	Use:   "create [vm-name]",
	Short: "Create a snapshot of a VM",
	Long: `Create a snapshot of a VM that can be used as a template.

Examples:
  flint snapshot create web-server --name base-config
  flint snapshot create web-server --name "after-nginx-install" --description "Web server with nginx configured"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		vmIdentifier := args[0]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		// Find VM by name
		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to get VMs: %v", err)
		}
		
		var vm *core.VM_Summary
		for _, v := range vms {
			if v.Name == vmIdentifier || v.UUID == vmIdentifier {
				vm = &v
				break
			}
		}
		
		if vm == nil {
			log.Fatalf("VM '%s' not found", vmIdentifier)
		}

		// Create snapshot
		req := core.CreateSnapshotRequest{
			Name:        snapshotName,
			Description: description,
		}

		fmt.Printf("📸 Creating snapshot '%s' of VM '%s'...\n", snapshotName, vm.Name)

		snapshot, err := client.CreateVMSnapshot(vm.UUID, req)
		if err != nil {
			log.Fatalf("Failed to create snapshot: %v", err)
		}

		fmt.Printf("✅ Snapshot created successfully!\n")
		fmt.Printf("   Name: %s\n", snapshot.Name)
		fmt.Printf("   Description: %s\n", snapshot.Description)
		fmt.Printf("   Created: %s\n", time.Unix(snapshot.CreationTS, 0).Format("2006-01-02 15:04:05"))
	},
}

var listSnapshotsCmd = &cobra.Command{
	Use:   "list [vm-name]",
	Short: "List snapshots for a VM",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		vmIdentifier := args[0]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		// Find VM by name
		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to get VMs: %v", err)
		}
		
		var vm *core.VM_Summary
		for _, v := range vms {
			if v.Name == vmIdentifier || v.UUID == vmIdentifier {
				vm = &v
				break
			}
		}
		
		if vm == nil {
			log.Fatalf("VM '%s' not found", vmIdentifier)
		}

		// Get snapshots
		snapshots, err := client.GetVMSnapshots(vm.UUID)
		if err != nil {
			log.Fatalf("Failed to get snapshots: %v", err)
		}

		if len(snapshots) == 0 {
			fmt.Printf("No snapshots found for VM '%s'\n", vm.Name)
			return
		}

		fmt.Printf("📸 Snapshots for VM '%s':\n\n", vm.Name)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tDESCRIPTION\tCREATED")
		fmt.Fprintln(w, "----\t-----------\t-------")

		for _, snapshot := range snapshots {
			fmt.Fprintf(w, "%s\t%s\t%s\n",
				snapshot.Name,
				snapshot.Description,
				time.Unix(snapshot.CreationTS, 0).Format("2006-01-02 15:04:05"))
		}

		w.Flush()
	},
}

var revertSnapshotCmd = &cobra.Command{
	Use:   "revert [vm-name] [snapshot-name]",
	Short: "Revert VM to a snapshot",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		vmIdentifier := args[0]
		snapshotName := args[1]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		// Find VM by name
		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to get VMs: %v", err)
		}
		
		var vm *core.VM_Summary
		for _, v := range vms {
			if v.Name == vmIdentifier || v.UUID == vmIdentifier {
				vm = &v
				break
			}
		}
		
		if vm == nil {
			log.Fatalf("VM '%s' not found", vmIdentifier)
		}

		fmt.Printf("⏪ Reverting VM '%s' to snapshot '%s'...\n", vm.Name, snapshotName)

		err = client.RevertToVMSnapshot(vm.UUID, snapshotName)
		if err != nil {
			log.Fatalf("Failed to revert to snapshot: %v", err)
		}

		fmt.Printf("✅ VM reverted to snapshot '%s' successfully!\n", snapshotName)
	},
}

func init() {
	// Add subcommands
	snapshotCmd.AddCommand(createSnapshotCmd)
	snapshotCmd.AddCommand(listSnapshotsCmd)
	snapshotCmd.AddCommand(revertSnapshotCmd)

	// Flags for create command
	createSnapshotCmd.Flags().StringVar(&snapshotName, "name", "", "Snapshot name (required)")
	createSnapshotCmd.Flags().StringVar(&description, "description", "", "Snapshot description")
	createSnapshotCmd.MarkFlagRequired("name")
}
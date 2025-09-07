package cmd

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/ccheshirecat/flint/pkg/core"
	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"github.com/spf13/cobra"
)

var vmCmd = &cobra.Command{
	Use:   "vm",
	Short: "Manage virtual machines",
	Long:  "flint vm provides commands to create, list, connect, and manage VMs efficiently",
}

var vmListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all virtual machines",
	Run: func(cmd *cobra.Command, args []string) {
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to list VMs: %v", err)
		}

		// Enhanced table output
		fmt.Printf("\n%s\n", strings.Repeat("=", 80))
		fmt.Printf("Virtual Machines Status\n")
		fmt.Printf("%s\n\n", strings.Repeat("=", 80))
		fmt.Printf("%-36s %-12s %-8s CPU%-8s MEM%-8s UP%-8s IP\n", "NAME", "STATUS", "", "", "", "")
		fmt.Printf("%s\n", strings.Repeat("-", 80))

		for _, vm := range vms {
			status := vm.State
			if status == "Running" {
				status = fmt.Sprintf("\033[32m%s\033[0m", status)
			} else if status == "Shutoff" {
				status = fmt.Sprintf("\033[31m%s\033[0m", status)
			} else {
				status = fmt.Sprintf("\033[33m%s\033[0m", status)
			}

			uptimeStr := libvirtclient.FormatUptime(vm.UptimeSec)
			ipStr := strings.Join(vm.IPAddresses, ", ")

			fmt.Printf("%-36s %-12s %-8.1f%% %-8dMB %-8s %s\n",
				vm.Name, status, vm.CPUPercent, vm.MemoryKB/1024,
				uptimeStr, ipStr)
		}
		fmt.Printf("\n%s\n", strings.Repeat("=", 80))
	},
}

var vmLaunchCmd = &cobra.Command{
	Use:   "launch [name]",
	Short: "Launch a new VM with smart defaults",
	Long: "flint vm launch [name] creates a new VM with sensible defaults:\n" +
		"  • 2 vCPUs, 4GB RAM, 10GB disk (DHCP networking)\n" +
		"  • Ubuntu template with cloud-init (ubuntu user, SSH enabled)\n" +
		"  • Auto-detected SSH key injection\n" +
		"  • Essential packages: curl, git, vim\n" +
		"  • Auto-starts and ready for SSH",
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		if len(args) > 0 {
			name = args[0]
		}
		if name == "" {
			name = "ubuntu-server"
		}

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		// Generate a secure random password for production
		passwordBytes := make([]byte, 16)
		rand.Read(passwordBytes)
		generatedPassword := base64.URLEncoding.EncodeToString(passwordBytes)
		fmt.Printf("Generated secure password: %s\n", generatedPassword)
		fmt.Printf("Save this password securely - it will be used for the 'ubuntu' user\n\n")

		// Create VM with smart defaults
		cfg := core.VMCreationConfig{
			Name:            name,
			MemoryMB:        4096,
			VCPUs:           2,
			DiskPool:        "default",
			DiskSizeGB:      10,
			ImageName:       "ubuntu-server-template", // Default template
			ImageType:       "template",
			EnableCloudInit: true,
			CloudInit: &core.CloudInitConfig{
				CommonFields: core.CloudInitCommonFields{
					Hostname: name,
					Username: "ubuntu",
					Password: generatedPassword,
					Packages: []string{"curl", "git", "vim"},
					NetworkConfig: &core.CloudInitNetworkConfig{
						UseDHCP: true,
					},
				},
				RawUserData: `#cloud-config
hostname: ` + name + `
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    groups: sudo
    shell: /bin/bash
packages:
  - curl
  - git
  - vim
write_files:
  - path: /etc/motd
    content: |
      Welcome to your new Ubuntu VM!
      Created with flint CLI - the fast path to virtualization.
runcmd:
  - [ systemctl, enable, ssh ]
  - [ ufw, allow, 22 ]
`,
			},
			StartOnCreate: true,
			NetworkName:   "default",
		}

		fmt.Printf("Creating VM '%s' with smart defaults...\n", name)

		vm, err := client.CreateVM(cfg)
		if err != nil {
			log.Fatalf("Failed to create VM: %v", err)
		}

		fmt.Printf("VM '%s' created successfully!\n", name)
		fmt.Printf("UUID: %s\n", vm.UUID)
		fmt.Printf("Boot status: %s\n", vm.State)
		fmt.Printf("Generated password: %s\n\n", generatedPassword)

		if vm.State == "Running" {
			fmt.Printf("SSH ready in a moment...\n")
			fmt.Printf("Use: flint vm ssh %s\n", name)
		}
	},
}

var vmSSHCmd = &cobra.Command{
	Use:   "ssh [name]",
	Short: "SSH into a running VM",
	Long:  "flint vm ssh [name] connects to the VM via SSH with auto-detected IP and key",
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		if len(args) > 0 {
			name = args[0]
		}
		if name == "" {
			fmt.Println("Error: VM name required")
			os.Exit(1)
		}

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to get VMs: %v", err)
		}

		var targetVM *core.VM_Summary
		for _, vm := range vms {
			if vm.Name == name {
				targetVM = &vm
				break
			}
		}

		if targetVM == nil {
			fmt.Printf("Error: VM '%s' not found\n", name)
			os.Exit(1)
		}

		if targetVM.IPAddresses == nil || len(targetVM.IPAddresses) == 0 {
			fmt.Printf("Error: No IP address available for VM '%s'\n", name)
			fmt.Println("The VM may not have cloud-init configured or network interface up yet.")
			os.Exit(1)
		}

		ip := targetVM.IPAddresses[0]
		username := "ubuntu" // Default from cloud-init config

		// Create SSH command
		sshCmd := exec.Command("ssh", "-i", "~/.ssh/id_rsa", fmt.Sprintf("%s@%s", username, ip))
		sshCmd.Stdin = os.Stdin
		sshCmd.Stdout = os.Stdout
		sshCmd.Stderr = os.Stderr

		fmt.Printf("Connecting to %s@%s...\n", username, ip)
		if err := sshCmd.Run(); err != nil {
			fmt.Printf("SSH connection failed: %v\n", err)
			os.Exit(1)
		}
	},
}

var vmConsoleCmd = &cobra.Command{
	Use:   "console [name]",
	Short: "Attach to VM serial console",
	Long:  "flint vm console [name] attaches to the VM's serial console for live monitoring",
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		if len(args) > 0 {
			name = args[0]
		}
		if name == "" {
			fmt.Println("Error: VM name required")
			os.Exit(1)
		}

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		vms, err := client.GetVMSummaries()
		if err != nil {
			log.Fatalf("Failed to get VMs: %v", err)
		}

		var targetVM *core.VM_Summary
		for _, vm := range vms {
			if vm.Name == name {
				targetVM = &vm
				break
			}
		}

		if targetVM == nil {
			fmt.Printf("Error: VM '%s' not found\n", name)
			os.Exit(1)
		}

		// Use libvirt-go Domain.OpenConsole for true PTY attachment
		dom, err := client.GetDomainByName(name)
		if err != nil {
			log.Fatalf("Failed to lookup domain: %v", err)
		}
		defer dom.Free()

		fmt.Printf("Connecting to serial console for VM '%s'...\n", name)
		fmt.Printf("Press Ctrl+] to exit the console\n\n")

		// Create a stream for console communication
		stream, err := client.NewStream(0)
		if err != nil {
			log.Fatalf("Failed to create stream: %v", err)
		}
		defer stream.Free()

		// Open the console
		err = dom.OpenConsole("", stream, 0)
		if err != nil {
			log.Fatalf("Failed to open console: %v", err)
		}

		// Set up bidirectional communication
		done := make(chan bool)

		// Read from stream and write to stdout
		go func() {
			buf := make([]byte, 1024)
			for {
				n, err := stream.Recv(buf)
				if err != nil {
					break
				}
				if n > 0 {
					os.Stdout.Write(buf[:n])
				}
			}
			done <- true
		}()

		// Read from stdin and write to stream
		go func() {
			buf := make([]byte, 1024)
			for {
				n, err := os.Stdin.Read(buf)
				if err != nil {
					break
				}
				if n > 0 {
					_, err := stream.Send(buf[:n])
					if err != nil {
						break
					}
				}
			}
			done <- true
		}()

		// Wait for either goroutine to finish
		<-done
	},
}

var vmDeleteCmd = &cobra.Command{
	Use:   "delete [name]",
	Short: "Delete a virtual machine",
	Long:  "Delete a virtual machine and optionally its storage",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]
		force, _ := cmd.Flags().GetBool("force")
		deleteStorage, _ := cmd.Flags().GetBool("delete-storage")

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		if !force {
			fmt.Printf("Are you sure you want to delete VM '%s'? (y/N): ", name)
			var response string
			fmt.Scanln(&response)
			if response != "y" && response != "Y" {
				fmt.Println("Cancelled")
				return
			}
		}

		err = client.DeleteVM(name, deleteStorage)
		if err != nil {
			log.Fatalf("Failed to delete VM: %v", err)
		}

		fmt.Printf("VM '%s' deleted successfully\n", name)
	},
}

var vmStartCmd = &cobra.Command{
	Use:   "start [name]",
	Short: "Start a virtual machine",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		err = client.StartVM(name)
		if err != nil {
			log.Fatalf("Failed to start VM: %v", err)
		}

		fmt.Printf("VM '%s' started successfully\n", name)
	},
}

var vmStopCmd = &cobra.Command{
	Use:   "stop [name]",
	Short: "Stop a virtual machine",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]
		force, _ := cmd.Flags().GetBool("force")

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		if force {
			err = client.ForceStopVM(name)
		} else {
			err = client.StopVM(name)
		}
		if err != nil {
			log.Fatalf("Failed to stop VM: %v", err)
		}

		action := "stopped"
		if force {
			action = "force stopped"
		}
		fmt.Printf("VM '%s' %s successfully\n", name, action)
	},
}

var vmRestartCmd = &cobra.Command{
	Use:   "restart [name]",
	Short: "Restart a virtual machine",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]
		force, _ := cmd.Flags().GetBool("force")

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		err = client.RestartVM(name, force)
		if err != nil {
			log.Fatalf("Failed to restart VM: %v", err)
		}

		fmt.Printf("VM '%s' restarted successfully\n", name)
	},
}

var vmDetailsCmd = &cobra.Command{
	Use:   "details [name]",
	Short: "Show detailed information about a VM",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		vm, err := client.GetVMDetails(name)
		if err != nil {
			log.Fatalf("Failed to get VM details: %v", err)
		}

		fmt.Printf("\n=== VM Details: %s ===\n", vm.Name)
		fmt.Printf("UUID: %s\n", vm.UUID)
		fmt.Printf("State: %s\n", vm.State)
		fmt.Printf("Memory: %d MB\n", vm.MemoryKB/1024)
		fmt.Printf("vCPUs: %d\n", vm.VCPUs)
		fmt.Printf("OS: %s\n", vm.OS)
		
		if len(vm.IPAddresses) > 0 {
			fmt.Printf("IP Addresses: %s\n", strings.Join(vm.IPAddresses, ", "))
		}
		
		if vm.UptimeSec > 0 {
			fmt.Printf("Uptime: %s\n", libvirtclient.FormatUptime(vm.UptimeSec))
		}
		
		fmt.Printf("CPU Usage: %.1f%%\n", vm.CPUPercent)
		
		if len(vm.Disks) > 0 {
			fmt.Println("\nDisks:")
			for _, disk := range vm.Disks {
				fmt.Printf("  - %s: %s (%s)\n", disk.TargetDev, disk.SourcePath, disk.Device)
			}
		}
		
		if len(vm.Nics) > 0 {
			fmt.Println("\nNetworks:")
			for _, nic := range vm.Nics {
				fmt.Printf("  - %s: %s (%s)\n", nic.MAC, nic.Source, nic.Model)
			}
		}
		fmt.Println()
	},
}

var vmGuestAgentCmd = &cobra.Command{
	Use:   "guest-agent",
	Short: "Manage guest agent",
	Long:  "Commands to interact with the QEMU guest agent",
}

var vmGuestAgentStatusCmd = &cobra.Command{
	Use:   "status [name]",
	Short: "Check guest agent status",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect: %v", err)
		}
		defer client.Close()

		status, err := client.GetGuestAgentStatus(name)
		if err != nil {
			log.Fatalf("Failed to get guest agent status: %v", err)
		}

		fmt.Printf("Guest Agent Status for VM '%s': %s\n", name, status)
	},
}

func init() {
	vmCmd.AddCommand(vmListCmd)
	vmCmd.AddCommand(vmLaunchCmd)
	vmCmd.AddCommand(vmSSHCmd)
	vmCmd.AddCommand(vmConsoleCmd)
	vmCmd.AddCommand(vmDeleteCmd)
	vmCmd.AddCommand(vmStartCmd)
	vmCmd.AddCommand(vmStopCmd)
	vmCmd.AddCommand(vmRestartCmd)
	vmCmd.AddCommand(vmDetailsCmd)
	vmCmd.AddCommand(vmGuestAgentCmd)

	// Add guest agent subcommands
	vmGuestAgentCmd.AddCommand(vmGuestAgentStatusCmd)

	// Add flags
	vmDeleteCmd.Flags().Bool("force", false, "Skip confirmation prompt")
	vmDeleteCmd.Flags().Bool("delete-storage", false, "Also delete VM storage")
	vmStopCmd.Flags().Bool("force", false, "Force stop (equivalent to power off)")
	vmRestartCmd.Flags().Bool("force", false, "Force restart")
}

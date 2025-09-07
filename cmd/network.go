package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"text/tabwriter"

	"github.com/ccheshirecat/flint/pkg/libvirtclient"
	"github.com/spf13/cobra"
)

var networkCmd = &cobra.Command{
	Use:   "network",
	Short: "Manage virtual networks",
	Long:  `Create, delete, start, stop, and list virtual networks.`,
}

var networkListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List virtual networks",
	Long: `List all virtual networks with their status and configuration.

Examples:
  flint network list                # List all networks
  flint network list --format json # JSON output`,
	Run: func(cmd *cobra.Command, args []string) {
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		networks, err := client.GetNetworks()
		if err != nil {
			log.Fatalf("Failed to get networks: %v", err)
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			jsonData, _ := json.MarshalIndent(networks, "", "  ")
			fmt.Println(string(jsonData))
			return
		}

		displayNetworksTable(networks)
	},
}

var networkCreateCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a virtual network",
	Long: `Create a new virtual network with the specified configuration.

Examples:
  flint network create mynet --bridge mybr0 --subnet 192.168.100.0/24`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		networkName := args[0]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		bridgeName, _ := cmd.Flags().GetString("bridge")

		err = client.CreateNetwork(networkName, bridgeName)
		if err != nil {
			log.Fatalf("Failed to create network: %v", err)
		}

		fmt.Printf("Network '%s' created successfully\n", networkName)
	},
}

var networkDeleteCmd = &cobra.Command{
	Use:   "delete [name]",
	Short: "Delete a virtual network",
	Long: `Delete an existing virtual network.

Examples:
  flint network delete mynet`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		networkName := args[0]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		err = client.DeleteNetwork(networkName)
		if err != nil {
			log.Fatalf("Failed to delete network: %v", err)
		}

		fmt.Printf("Network '%s' deleted successfully\n", networkName)
	},
}

var networkStartCmd = &cobra.Command{
	Use:   "start [name]",
	Short: "Start a virtual network",
	Long: `Start an existing virtual network.

Examples:
  flint network start mynet`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		networkName := args[0]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		err = client.UpdateNetwork(networkName, "start")
		if err != nil {
			log.Fatalf("Failed to start network: %v", err)
		}

		fmt.Printf("Network '%s' started successfully\n", networkName)
	},
}

var networkStopCmd = &cobra.Command{
	Use:   "stop [name]",
	Short: "Stop a virtual network",
	Long: `Stop an existing virtual network.

Examples:
  flint network stop mynet`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		networkName := args[0]
		
		client, err := libvirtclient.NewClient("qemu:///system", "isos", "templates")
		if err != nil {
			log.Fatalf("Failed to connect to libvirt: %v", err)
		}
		defer client.Close()

		err = client.UpdateNetwork(networkName, "stop")
		if err != nil {
			log.Fatalf("Failed to stop network: %v", err)
		}

		fmt.Printf("Network '%s' stopped successfully\n", networkName)
	},
}

func displayNetworksTable(networks interface{}) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tSTATUS\tBRIDGE\tPERSISTENT\tUUID")
	fmt.Fprintln(w, "----\t------\t------\t----------\t----")

	// Handle the networks data structure
	switch v := networks.(type) {
	case []interface{}:
		for _, network := range v {
			if netMap, ok := network.(map[string]interface{}); ok {
				name := getStringField(netMap, "name")
				status := "Inactive"
				if active, ok := netMap["is_active"].(bool); ok && active {
					status = "Active"
				}
				bridge := getStringField(netMap, "bridge")
				persistent := "No"
				if pers, ok := netMap["is_persistent"].(bool); ok && pers {
					persistent = "Yes"
				}
				uuid := getStringField(netMap, "uuid")
				if len(uuid) > 8 {
					uuid = uuid[:8] + "..."
				}

				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", name, status, bridge, persistent, uuid)
			}
		}
	}

	w.Flush()
}

func getStringField(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		return fmt.Sprintf("%v", val)
	}
	return "N/A"
}

func init() {
	// Add subcommands
	networkCmd.AddCommand(networkListCmd)
	networkCmd.AddCommand(networkCreateCmd)
	networkCmd.AddCommand(networkDeleteCmd)
	networkCmd.AddCommand(networkStartCmd)
	networkCmd.AddCommand(networkStopCmd)

	// Add flags
	networkListCmd.Flags().String("format", "table", "Output format (table, json)")
	
	networkCreateCmd.Flags().String("bridge", "", "Bridge name for the network")
	networkCreateCmd.Flags().String("subnet", "", "Subnet for the network (e.g., 192.168.100.0/24)")
	networkCreateCmd.Flags().Bool("dhcp", true, "Enable DHCP for the network")
}
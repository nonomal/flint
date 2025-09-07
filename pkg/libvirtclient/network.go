package libvirtclient

import (
	"fmt"
	"github.com/ccheshirecat/flint/pkg/core"
	"strconv"
	"strings"
)

// GetNetworks fetches all virtual networks.
func (c *Client) GetNetworks() ([]core.Network, error) {
	// ListAllNetworks is the most reliable method.
	networks, err := c.conn.ListAllNetworks(0)
	if err != nil {
		return nil, fmt.Errorf("list networks: %w", err)
	}

	out := make([]core.Network, 0, len(networks))
	for _, n := range networks {
		defer n.Free()
		name, _ := n.GetName()
		uuid, _ := n.GetUUIDString()
		isActive, _ := n.IsActive()
		isPersistent, _ := n.IsPersistent()
		bridge, _ := n.GetBridgeName()

		out = append(out, core.Network{
			Name:         name,
			UUID:         uuid,
			IsActive:     isActive,
			IsPersistent: isPersistent,
			Bridge:       bridge,
		})
	}
	return out, nil
}

// CreateNetwork creates a new virtual network with the specified name and bridge name.
func (c *Client) CreateNetwork(name string, bridgeName string) error {
	// Generate a unique network ID
	networkID, err := c.generateNetworkID()
	if err != nil {
		return fmt.Errorf("failed to generate network ID: %w", err)
	}

	// Define the network XML
	networkXML := fmt.Sprintf(`<network>
      <name>%s</name>
      <bridge name='%s' stp='on' delay='0'/>
      <forward mode='nat'/>
      <ip address='192.168.%d.1' netmask='255.255.255.0'>
        <dhcp>
          <range start='192.168.%d.10' end='192.168.%d.254'/>
        </dhcp>
      </ip>
    </network>`, name, bridgeName, networkID, networkID, networkID)

	// Define the network
	network, err := c.conn.NetworkDefineXML(networkXML)
	if err != nil {
		return fmt.Errorf("failed to define network: %w", err)
	}
	defer network.Free()

	// Set autostart
	if err := network.SetAutostart(true); err != nil {
		return fmt.Errorf("failed to set network autostart: %w", err)
	}

	// Activate the network
	if err := network.Create(); err != nil {
		return fmt.Errorf("failed to create network: %w", err)
	}

	return nil
}

// DeleteNetwork deletes a virtual network by name
func (c *Client) UpdateNetwork(name string, action string) error {
	// Look up the network by name
	network, err := c.conn.LookupNetworkByName(name)
	if err != nil {
		return fmt.Errorf("failed to lookup network '%s': %w", name, err)
	}
	defer network.Free()

	switch action {
	case "start":
		isActive, err := network.IsActive()
		if err != nil {
			return fmt.Errorf("failed to check network status: %w", err)
		}
		if !isActive {
			if err := network.Create(); err != nil {
				return fmt.Errorf("failed to start network: %w", err)
			}
		}
	case "stop":
		isActive, err := network.IsActive()
		if err != nil {
			return fmt.Errorf("failed to check network status: %w", err)
		}
		if isActive {
			if err := network.Destroy(); err != nil {
				return fmt.Errorf("failed to stop network: %w", err)
			}
		}
	case "restart":
		isActive, err := network.IsActive()
		if err != nil {
			return fmt.Errorf("failed to check network status: %w", err)
		}
		if isActive {
			if err := network.Destroy(); err != nil {
				return fmt.Errorf("failed to stop network: %w", err)
			}
		}
		if err := network.Create(); err != nil {
			return fmt.Errorf("failed to start network: %w", err)
		}
	default:
		return fmt.Errorf("invalid action '%s'. Valid actions: start, stop, restart", action)
	}

	return nil
}

func (c *Client) DeleteNetwork(name string) error {
	// Look up the network by name
	network, err := c.conn.LookupNetworkByName(name)
	if err != nil {
		return fmt.Errorf("failed to lookup network '%s': %w", name, err)
	}
	defer network.Free()

	// Check if network is active and destroy it first
	isActive, err := network.IsActive()
	if err != nil {
		return fmt.Errorf("failed to check network status: %w", err)
	}

	if isActive {
		if err := network.Destroy(); err != nil {
			return fmt.Errorf("failed to destroy network: %w", err)
		}
	}

	// Undefine the network (removes it permanently)
	if err := network.Undefine(); err != nil {
		return fmt.Errorf("failed to undefine network: %w", err)
	}

	return nil
}

// generateNetworkID generates a unique ID for the network by checking existing networks
func (c *Client) generateNetworkID() (int, error) {
	// Get all existing networks
	networks, err := c.conn.ListAllNetworks(0)
	if err != nil {
		return 0, fmt.Errorf("failed to list networks: %w", err)
	}

	// Track used network IDs
	usedIDs := make(map[int]bool)

	// Check existing networks for their IP ranges
	for _, network := range networks {
		xmlDesc, err := network.GetXMLDesc(0)
		if err != nil {
			continue // Skip if we can't get XML
		}

		// Extract IP address from XML (simple regex approach)
		// Looking for pattern: address='192.168.X.1'
		if strings.Contains(xmlDesc, "192.168.") {
			// Find the IP address pattern
			start := strings.Index(xmlDesc, "192.168.")
			if start != -1 {
				end := strings.Index(xmlDesc[start:], "'")
				if end != -1 {
					ipStr := xmlDesc[start : start+end]
					parts := strings.Split(ipStr, ".")
					if len(parts) >= 3 {
						if id, err := strconv.Atoi(parts[2]); err == nil {
							usedIDs[id] = true
						}
					}
				}
			}
		}
		network.Free()
	}

	// Find the first available ID starting from 100
	for id := 100; id < 255; id++ {
		if !usedIDs[id] {
			return id, nil
		}
	}

	return 0, fmt.Errorf("no available network IDs found")
}


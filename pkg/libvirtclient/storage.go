package libvirtclient

import (
	"fmt"

	"github.com/ccheshirecat/flint/pkg/core"
	libvirt "github.com/libvirt/libvirt-go"
)

// ADD THIS HELPER FUNCTION
// mapStoragePoolState translates libvirt's enum to a clean string.
func mapStoragePoolState(s libvirt.StoragePoolState) string {
	switch s {
	case libvirt.STORAGE_POOL_INACTIVE:
		return "Inactive"
	case libvirt.STORAGE_POOL_BUILDING:
		return "Building"
	case libvirt.STORAGE_POOL_RUNNING:
		return "Active" // This is the state we want to see
	case libvirt.STORAGE_POOL_DEGRADED:
		return "Degraded"
	case libvirt.STORAGE_POOL_INACCESSIBLE:
		return "Inaccessible"
	default:
		return "Unknown"
	}
}

// GetStoragePools lists pools and their status/capacities.
func (c *Client) GetStoragePools() ([]core.StoragePool, error) {
	pools, err := c.conn.ListAllStoragePools(0)
	if err != nil {
		return nil, fmt.Errorf("list pools: %w", err)
	}
	out := make([]core.StoragePool, 0, len(pools))
	for _, p := range pools {
		name, _ := p.GetName()
		info, err := p.GetInfo()
		if err != nil {
			p.Free()
			continue
		}

		// --- THIS IS THE CRITICAL CHANGE ---
		// Populate the new State field using our helper.
		poolState := mapStoragePoolState(info.State)

		out = append(out, core.StoragePool{
			Name:        name,
			State:       poolState, // <-- POPULATE THE NEW FIELD
			CapacityB:   uint64(info.Capacity),
			AllocationB: uint64(info.Allocation),
		})
		p.Free()
	}
	return out, nil
}

// GetVolumes lists volumes for a pool
func (c *Client) GetVolumes(poolName string) ([]core.Volume, error) {
	pool, err := c.conn.LookupStoragePoolByName(poolName)
	if err != nil {
		return nil, fmt.Errorf("lookup pool: %w", err)
	}
	defer pool.Free()

	vols, err := pool.ListAllStorageVolumes(0)
	if err != nil {
		return nil, fmt.Errorf("list volumes: %w", err)
	}
	out := make([]core.Volume, 0, len(vols))
	for _, v := range vols {
		name, _ := v.GetName()
		info, _ := v.GetInfo()
		path, _ := v.GetPath()
		out = append(out, core.Volume{
			Name:     name,
			Path:     path,
			Capacity: uint64(info.Capacity),
		})
		v.Free()
	}
	return out, nil
}


func (c *Client) CreateVolume(poolName string, volConfig core.VolumeConfig) error {
	pool, err := c.conn.LookupStoragePoolByName(poolName)
	if err != nil {
		return fmt.Errorf("lookup pool: %w", err)
	}
	defer pool.Free()

	// simple xml for volume
	volXML := fmt.Sprintf(`<volume>
      <name>%s</name>
      <capacity unit='G'>%d</capacity>
    </volume>`, volConfig.Name, volConfig.SizeGB)

	_, err = pool.StorageVolCreateXML(volXML, 0)
	if err != nil {
		return fmt.Errorf("create vol: %w", err)
	}
	return nil
}

// UpdateVolume updates a storage volume (resize operation)  
func (c *Client) UpdateVolume(poolName string, volumeName string, config core.VolumeConfig) error {
	pool, err := c.conn.LookupStoragePoolByName(poolName)
	if err != nil {
		return fmt.Errorf("lookup storage pool: %w", err)
	}
	defer pool.Free()

	vol, err := pool.LookupStorageVolByName(volumeName)
	if err != nil {
		return fmt.Errorf("lookup volume: %w", err)
	}
	defer vol.Free()

	// Resize the volume
	newCapacity := config.SizeGB * 1024 * 1024 * 1024 // Convert GB to bytes
	if err := vol.Resize(newCapacity, 0); err != nil {
		return fmt.Errorf("resize volume: %w", err)
	}

	return nil
}

// DeleteVolume deletes a storage volume
func (c *Client) DeleteVolume(poolName string, volumeName string) error {
	pool, err := c.conn.LookupStoragePoolByName(poolName)
	if err != nil {
		return fmt.Errorf("lookup storage pool: %w", err)
	}
	defer pool.Free()

	vol, err := pool.LookupStorageVolByName(volumeName)
	if err != nil {
		return fmt.Errorf("lookup volume: %w", err)
	}
	defer vol.Free()

	return vol.Delete(0)
}

package libvirtclient

import (
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ccheshirecat/flint/pkg/core"
	libvirt "github.com/libvirt/libvirt-go"
)

// helper to map libvirt state to string
func libvirtStateToString(s libvirt.DomainState) string {
	switch s {
	case libvirt.DOMAIN_NOSTATE:
		return "NoState"
	case libvirt.DOMAIN_RUNNING:
		return "Running"
	case libvirt.DOMAIN_BLOCKED:
		return "Blocked"
	case libvirt.DOMAIN_PAUSED:
		return "Paused"
	case libvirt.DOMAIN_SHUTDOWN:
		return "Shutdown"
	case libvirt.DOMAIN_SHUTOFF:
		return "Shutoff"
	case libvirt.DOMAIN_CRASHED:
		return "Crashed"
	case libvirt.DOMAIN_PMSUSPENDED:
		return "Suspended"
	default:
		return "Unknown"
	}
}

// GetVMSummaries returns a brief list, computing per-VM CPU percent via a short sample window.
// It samples all domains concurrently to avoid serial 1s sleeps per VM.
func (c *Client) GetVMSummaries() ([]core.VM_Summary, error) {
	domains, err := c.conn.ListAllDomains(0)
	if err != nil {
		return nil, fmt.Errorf("list domains: %w", err)
	}

	type sample struct {
		dom         libvirt.Domain
		name        string
		uuid        string
		info1       libvirt.DomainInfo
		info2       libvirt.DomainInfo
		osInfo      string
		ipAddresses []string
		err         error
	}

	samples := make([]*sample, 0, len(domains))
	for _, d := range domains {
		name, _ := d.GetName()
		uuid, _ := d.GetUUIDString()
		samples = append(samples, &sample{dom: d, name: name, uuid: uuid})
	}

	// First pass: get initial infos concurrently
	var wg sync.WaitGroup
	for _, s := range samples {
		wg.Add(1)
		go func(s *sample) {
			defer wg.Done()
			info, err := s.dom.GetInfo()
			if err != nil {
				s.err = err
				return
			}
			s.info1 = *info

			// For now, we'll populate OS info from XML and leave IP addresses empty
			// IP addresses require qemu-guest-agent running in the VM
			xmlDesc, err := s.dom.GetXMLDesc(0)
			if err == nil {
				// Simple OS detection from XML
				if strings.Contains(xmlDesc, "ubuntu") {
					s.osInfo = "Ubuntu"
				} else if strings.Contains(xmlDesc, "centos") || strings.Contains(xmlDesc, "rhel") {
					s.osInfo = "CentOS/RHEL"
				} else if strings.Contains(xmlDesc, "windows") {
					s.osInfo = "Windows"
				} else {
					s.osInfo = "Unknown"
				}
			}
		}(s)
	}
	wg.Wait()

	// sample window
	sleepDur := time.Second
	time.Sleep(sleepDur)

	// second pass
	for _, s := range samples {
		wg.Add(1)
		go func(s *sample) {
			defer wg.Done()
			info, err := s.dom.GetInfo()
			if err != nil {
				s.err = err
				return
			}
			s.info2 = *info
			// OS info and IP addresses are already populated in first pass
		}(s)
	}
	wg.Wait()

	// assemble results
	out := make([]core.VM_Summary, 0, len(samples))
	for _, s := range samples {
		if s.err != nil {
			s.dom.Free()
			continue
		}
		// compute cpu percent
		deltaCpu := float64(int64(s.info2.CpuTime) - int64(s.info1.CpuTime)) // nanoseconds
		elapsed := sleepDur.Seconds()
		cpuSeconds := deltaCpu / 1e9
		cpuPercent := (cpuSeconds / elapsed) * 100.0 // note: can exceed 100 if multiple vCPUs
		if s.info2.NrVirtCpu > 0 {
			// normalize per-vCPU if you prefer percent per vCPU:
			// cpuPercent = cpuPercent / float64(s.info2.NrVirtCpu)
		}

		stateStr := libvirtStateToString(s.info2.State)

		vm := core.VM_Summary{
			Name:        s.name,
			UUID:        s.uuid,
			State:       stateStr,
			MemoryKB:    uint64(s.info2.Memory), // usually in KiB
			VCPUs:       int(s.info2.NrVirtCpu),
			CPUPercent:  cpuPercent,
			UptimeSec:   uint64(s.info2.CpuTime / 1e9),
			OSInfo:      s.osInfo,
			IPAddresses: s.ipAddresses,
		}

		out = append(out, vm)
		s.dom.Free()
	}

	return out, nil
}

// GetVMDetails(uuidStr)
func (c *Client) GetVMDetails(uuidStr string) (core.VM_Detailed, error) {
	var out core.VM_Detailed
	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return out, fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	name, _ := dom.GetName()
	info, err := dom.GetInfo()
	if err != nil {
		return out, fmt.Errorf("domain get info: %w", err)
	}

	xmlDesc, err := dom.GetXMLDesc(0)
	if err != nil {
		return out, fmt.Errorf("domain xml: %w", err)
	}

	// populate basic fields
	out.VM_Summary = core.VM_Summary{
		Name:      name,
		UUID:      uuidStr,
		State:     libvirtStateToString(info.State),
		MemoryKB:  uint64(info.Memory),
		VCPUs:     int(info.NrVirtCpu),
		UptimeSec: uint64(info.CpuTime / 1e9),
	}
	out.MaxMemoryKB = uint64(info.MaxMem) // <-- ADD THIS LINE
	out.MaxMemoryKB = uint64(info.MaxMem) // <-- ADD THIS LINE
	out.XML = xmlDesc

	// Parse XML for disks and nics (simple unmarshal using anonymous structs)
	type target struct {
		Dev string `xml:"dev,attr"`
	}
	type sourceFile struct {
		File    string `xml:"file,attr"`
		Dev     string `xml:"dev,attr"`
		Network string `xml:"network,attr"`
	}
	type disk struct {
		Device string     `xml:"device,attr"`
		Source sourceFile `xml:"source"`
		Target target     `xml:"target"`
	}
	type iface struct {
		MAC struct {
			Address string `xml:"address,attr"`
		} `xml:"mac"`
		Source struct {
			Network string `xml:"network,attr"`
			Bridge  string `xml:"bridge,attr"`
		} `xml:"source"`
		Model struct {
			Type string `xml:"type,attr"`
		} `xml:"model"`
	}
	type domainXML struct {
		OS struct {
			Type struct {
				Arch string `xml:"arch,attr"`
				Type string `xml:",chardata"`
			} `xml:"type"`
		} `xml:"os"`
		Devices struct {
			Disks  []disk  `xml:"disk"`
			Ifaces []iface `xml:"interface"`
		} `xml:"devices"`
	}

	var dx domainXML
	if err := xml.Unmarshal([]byte(xmlDesc), &dx); err == nil {
		for _, d := range dx.Devices.Disks {
			// only handle file-backed disks and volumes with target devs
			out.Disks = append(out.Disks, core.Disk{
				SourcePath: d.Source.File,
				TargetDev:  d.Target.Dev,
				Device:     d.Device,
			})
		}
		for _, ifc := range dx.Devices.Ifaces {
			src := ifc.Source.Network
			if src == "" {
				src = ifc.Source.Bridge
			}
			out.Nics = append(out.Nics, core.NIC{
				MAC:    ifc.MAC.Address,
				Source: src,
				Model:  ifc.Model.Type,
			})
		}
		if dx.OS.Type.Type != "" {
			out.OS = dx.OS.Type.Type
		}
	} // else: quietly ignore XML parse error (still return xml)

	return out, nil
}

// PerformVMAction(uuidStr, action)
func (c *Client) PerformVMAction(uuidStr string, action string) error {
	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	name, _ := dom.GetName()

	var result error
	switch action {
	case "start":
		result = dom.Create()
		if result == nil {
			c.logger.Add("VM Started", name, "Success", "Virtual machine started successfully")
		}
	case "stop":
		result = dom.Shutdown()
		if result == nil {
			c.logger.Add("VM Stopped", name, "Success", "Virtual machine shut down gracefully")
		}
	case "reboot":
		result = dom.Reboot(0)
		if result == nil {
			c.logger.Add("VM Rebooted", name, "Success", "Virtual machine rebooted")
		}
	case "force-stop":
		result = dom.Destroy()
		if result == nil {
			c.logger.Add("VM Force Stopped", name, "Success", "Virtual machine force stopped")
		}
	case "pause":
		result = dom.Suspend()
		if result == nil {
			c.logger.Add("VM Paused", name, "Success", "Virtual machine paused")
		}
	case "resume":
		result = dom.Resume()
		if result == nil {
			c.logger.Add("VM Resumed", name, "Success", "Virtual machine resumed")
		}
	default:
		return fmt.Errorf("unknown action")
	}
	return result
}

// DeleteVM(uuidStr, deleteDisks)
func (c *Client) DeleteVM(uuidStr string, deleteDisks bool) error {
	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	info, _ := dom.GetInfo()
	if info.State == libvirt.DOMAIN_RUNNING {
		// try graceful first
		_ = dom.Shutdown()
		// wait a short time then force
		time.Sleep(2 * time.Second)
		info, _ = dom.GetInfo()
		if info.State == libvirt.DOMAIN_RUNNING {
			_ = dom.Destroy()
		}
	}

	// optionally delete associated disk volumes:
	if deleteDisks {
		xmlDesc, _ := dom.GetXMLDesc(0)
		// rudimentary parse of <disk type='file'> and <source file='...'>
		type sourceFile struct {
			File   string `xml:"file,attr"`
			Pool   string `xml:"pool,attr"`
			Volume string `xml:"volume,attr"`
		}
		type disk struct {
			Device string     `xml:"device,attr"`
			Source sourceFile `xml:"source"`
			Target struct {
				Dev string `xml:"dev,attr"`
			} `xml:"target"`
		}
		type devices struct {
			Disks []disk `xml:"disk"`
		}
		type dxml struct {
			Devices devices `xml:"devices"`
		}
		var dx dxml
		if err := xml.Unmarshal([]byte(xmlDesc), &dx); err == nil {
			for _, d := range dx.Devices.Disks {
				if d.Source.File != "" {
					// Check if the file is within known storage pools before deleting
					if isFileInKnownStoragePool(d.Source.File) {
						if err := os.Remove(d.Source.File); err != nil {
							// Log error but continue with other disks
							fmt.Printf("Warning: Failed to delete disk file %s: %v\n", d.Source.File, err)
						}
					} else {
						fmt.Printf("Warning: Skipping deletion of disk file %s - not in known storage pool\n", d.Source.File)
					}
				} else if d.Source.Volume != "" && d.Source.Pool != "" {
					// find pool & volume and delete properly via libvirt
					pool, perr := c.conn.LookupStoragePoolByName(d.Source.Pool)
					if perr == nil {
						vol, verr := pool.LookupStorageVolByName(d.Source.Volume)
						if verr == nil {
							_ = vol.Delete(0)
							vol.Free()
						}
						pool.Free()
					}
				}
			}
		}
	}

	// Undefine the domain.
	// Domain.Undefine() or UndefineFlags: use simple undefine
	if err := dom.Undefine(); err != nil {
		// try flags variant if needed
		_ = dom.UndefineFlags(0)
	}
	return nil
}

// GetVMPerformance gets a single, real-time sample of performance counters for a VM.
func (c *Client) GetVMPerformance(uuidStr string) (core.PerformanceSample, error) {
	var sample core.PerformanceSample

	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return sample, fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	// Get CPU time
	info, err := dom.GetInfo()
	if err != nil {
		return sample, fmt.Errorf("get domain info: %w", err)
	}
	sample.CPUNanoSecs = uint64(info.CpuTime)

	// Get memory stats
	memStats, err := dom.MemoryStats(0, 0)
	if err == nil && len(memStats) > 0 {
		// Find RSS (Resident Set Size) which is a good proxy for active memory usage
		for _, stat := range memStats {
			if stat.Tag == 6 { // VIR_DOMAIN_MEMORY_STAT_RSS
				sample.MemoryUsedKB = uint64(stat.Val)
				break
			}
		}
	}

	// Get disk I/O stats (first disk device)
	blockStats, err := dom.BlockStats("vda")
	if err == nil {
		sample.DiskReadBytes = uint64(blockStats.RdBytes)
		sample.DiskWriteBytes = uint64(blockStats.WrBytes)
	}

	// Get network I/O stats (first interface)
	ifaceStats, err := dom.InterfaceStats("vnet0")
	if err == nil {
		sample.NetRxBytes = uint64(ifaceStats.RxBytes)
		sample.NetTxBytes = uint64(ifaceStats.TxBytes)
	}

	return sample, nil
}

// AttachDiskToVM attaches a disk volume to a running VM
func (c *Client) AttachDiskToVM(uuidStr string, volumePath string, targetDev string) error {
	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	name, _ := dom.GetName()

	// Create the attachment XML for a disk
	attachXML := fmt.Sprintf(`<disk type="file" device="disk">
      <driver name="qemu" type="qcow2"/>
      <source file="%s"/>
      <target dev="%s" bus="virtio"/>
    </disk>`, volumePath, targetDev)

	// Attach the disk
	if err := dom.AttachDevice(attachXML); err != nil {
		return fmt.Errorf("failed to attach disk: %w", err)
	}

	c.logger.Add("Disk Attached", name, "Success", fmt.Sprintf("Disk %s attached as %s", volumePath, targetDev))
	return nil
}

// AttachNetworkInterfaceToVM attaches a network interface to a running VM
func (c *Client) AttachNetworkInterfaceToVM(uuidStr string, networkName string, model string) error {
	dom, err := c.conn.LookupDomainByUUIDString(uuidStr)
	if err != nil {
		return fmt.Errorf("lookup domain: %w", err)
	}
	defer dom.Free()

	name, _ := dom.GetName()

	// Create the attachment XML for a network interface
	attachXML := fmt.Sprintf(`<interface type="network">
      <source network="%s"/>
      <model type="%s"/>
    </interface>`, networkName, model)

	// Attach the network interface
	if err := dom.AttachDevice(attachXML); err != nil {
		return fmt.Errorf("failed to attach network interface: %w", err)
	}

	c.logger.Add("Network Interface Attached", name, "Success", fmt.Sprintf("Network interface attached to %s", networkName))
	return nil
}

// isFileInKnownStoragePool checks if a file path is within known storage pools
func isFileInKnownStoragePool(filePath string) bool {
	// Get the absolute path
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return false
	}

	// Check if the file is within the managed flint image pool
	if strings.HasPrefix(absPath, flintImagePoolPath) {
		return true
	}

	// Add additional known storage pool paths here as needed
	// For example, you might check for other libvirt storage pools

	return false
}

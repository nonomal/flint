package core

import (
	"testing"
	"time"
)

func TestVM_Summary(t *testing.T) {
	vm := VM_Summary{
		Name:        "test-vm",
		UUID:        "550e8400-e29b-41d4-a716-446655440000",
		State:       "running",
		MemoryKB:    2097152, // 2GB
		VCPUs:       2,
		CPUPercent:  25.5,
		UptimeSec:   3600,
		OSInfo:      "Ubuntu 24.04",
		IPAddresses: []string{"192.168.122.100"},
	}

	if vm.Name != "test-vm" {
		t.Errorf("Expected name 'test-vm', got '%s'", vm.Name)
	}

	if vm.VCPUs != 2 {
		t.Errorf("Expected 2 VCPUs, got %d", vm.VCPUs)
	}

	if len(vm.IPAddresses) != 1 {
		t.Errorf("Expected 1 IP address, got %d", len(vm.IPAddresses))
	}
}

func TestActivityEvent(t *testing.T) {
	now := time.Now().Unix()
	event := ActivityEvent{
		ID:        "event-1",
		Timestamp: now,
		Action:    "VM Started",
		Target:    "web-server-01",
		Status:    "Success",
		Message:   "VM started successfully",
	}

	if event.Action != "VM Started" {
		t.Errorf("Expected action 'VM Started', got '%s'", event.Action)
	}

	if event.Status != "Success" {
		t.Errorf("Expected status 'Success', got '%s'", event.Status)
	}

	if event.Timestamp != now {
		t.Errorf("Expected timestamp %d, got %d", now, event.Timestamp)
	}
}

func TestHostStatus(t *testing.T) {
	status := HostStatus{
		Hostname:          "test-host",
		HypervisorVersion: "8.0.0",
		TotalVMs:          5,
		RunningVMs:        3,
		PausedVMs:         1,
		ShutOffVMs:        1,
		HealthChecks: []HealthCheck{
			{Type: "warning", Message: "High CPU usage"},
		},
	}

	if status.Hostname != "test-host" {
		t.Errorf("Expected hostname 'test-host', got '%s'", status.Hostname)
	}

	if status.TotalVMs != 5 {
		t.Errorf("Expected 5 total VMs, got %d", status.TotalVMs)
	}

	if len(status.HealthChecks) != 1 {
		t.Errorf("Expected 1 health check, got %d", len(status.HealthChecks))
	}
}

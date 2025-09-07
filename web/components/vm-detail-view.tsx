"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"

// Lazy load the performance tab to reduce initial bundle size
const VMPerformanceTab = dynamic(() => import("@/components/vm-performance-tab").then(mod => ({ default: mod.VMPerformanceTab })), {
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Loading performance data...</span>
      </div>
    </div>
  )
})

// Lazy load the serial console component to reduce initial bundle size
const VMSerialConsole = dynamic(() => import("@/components/vm-serial-console").then(mod => ({ default: mod.VMSerialConsole })), {
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Loading console...</span>
      </div>
    </div>
  )
})

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VMDetailed, vmAPI } from "@/lib/api"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Play,
  Square,
  RotateCcw,
  Monitor,
  Trash2,
  Activity,
  Clock,
  ArrowLeft,
  Camera,
  Plus,
  Edit,
  Loader2,
  Server,
  Key,
  Copy,
} from "lucide-react"

// Helper function to format uptime from seconds
const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export function VMDetailView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [vmData, setVmData] = useState<VMDetailed | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [isPerformingAction, setIsPerformingAction] = useState(false)
  const [isCreateSnapshotOpen, setIsCreateSnapshotOpen] = useState(false)
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotDescription, setSnapshotDescription] = useState("")
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)
  const [isAddDiskOpen, setIsAddDiskOpen] = useState(false)
  const [diskVolumePath, setDiskVolumePath] = useState("")
  const [diskTargetDev, setDiskTargetDev] = useState("")
  const [isAttachingDisk, setIsAttachingDisk] = useState(false)
  const [isAddNetworkOpen, setIsAddNetworkOpen] = useState(false)
  const [networkName, setNetworkName] = useState("")
  const [networkModel, setNetworkModel] = useState("virtio")
  const [isAttachingNetwork, setIsAttachingNetwork] = useState(false)

  useEffect(() => {
    const fetchVMData = async () => {
      const vmId = searchParams.get('id')

      if (!vmId) {
        setError("No VM ID provided")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const data = await vmAPI.getById(vmId)
        setVmData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load VM data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchVMData()
  }, [searchParams])

  useEffect(() => {
    if (vmData?.uuid) {
      fetch(`/api/vms/${vmData.uuid}/snapshots`)
        .then(res => res.json())
        .then(data => setSnapshots(data))
        .catch(err => console.error("Failed to fetch snapshots:", err));
    }
  }, [vmData?.uuid])

  const performVMAction = async (action: string) => {
    if (!vmData?.uuid) return

    setIsPerformingAction(true)
    try {
      const response = await fetch(`/api/vms/${vmData.uuid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} VM (HTTP ${response.status})`);
      }

      // Refresh VM data
      const updatedVM = await vmAPI.getById(vmData.uuid)
      setVmData(updatedVM)

      toast({
        title: "Success",
        description: `VM ${action} operation completed successfully`,
      })
    } catch (err) {
      console.error('VM action failed:', err)
      toast({
        title: "Error",
        description: `Failed to ${action} VM: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsPerformingAction(false)
    }
  }

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim() || !vmData) return

    setIsCreatingSnapshot(true)
    try {
      const response = await fetch(`/api/vms/${vmData.uuid}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snapshotName,
          description: snapshotDescription,
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create snapshot')
      }

      // Refresh snapshots
      const snapshotsResponse = await fetch(`/api/vms/${vmData.uuid}/snapshots`)
      const updatedSnapshots = await snapshotsResponse.json()
      setSnapshots(updatedSnapshots)

      // Reset form
      setSnapshotName("")
      setSnapshotDescription("")
      setIsCreateSnapshotOpen(false)

      toast({
        title: "Success",
        description: `Snapshot "${snapshotName}" created successfully`,
      })
    } catch (err) {
      console.error('Snapshot creation failed:', err)
      toast({
        title: "Error",
        description: `Failed to create snapshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsCreatingSnapshot(false)
    }
  }

  const handleDeleteSnapshot = async (snapshotName: string) => {
    if (!vmData || !confirm(`Are you sure you want to permanently delete the snapshot '${snapshotName}'?`)) {
      return
    }

    try {
      const response = await fetch(`/api/vms/${vmData.uuid}/snapshots/${snapshotName}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete snapshot')
      }

      // Refresh snapshots
      const snapshotsResponse = await fetch(`/api/vms/${vmData.uuid}/snapshots`)
      const updatedSnapshots = await snapshotsResponse.json()
      setSnapshots(updatedSnapshots)

      toast({
        title: "Success",
        description: `Snapshot "${snapshotName}" deleted successfully`,
      })
    } catch (err) {
      console.error('Snapshot deletion failed:', err)
      toast({
        title: "Error",
        description: `Failed to delete snapshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  const handleAttachDisk = async () => {
    if (!vmData?.uuid || !diskVolumePath || !diskTargetDev) return

    try {
      setIsAttachingDisk(true)
      const response = await fetch(`/api/vms/${vmData.uuid}/attach-disk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumePath: diskVolumePath,
          targetDev: diskTargetDev
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to attach disk')
      }

      // Refresh VM data
      const updatedVM = await vmAPI.getById(vmData.uuid)
      setVmData(updatedVM)

      // Close dialog and reset form
      setIsAddDiskOpen(false)
      setDiskVolumePath("")
      setDiskTargetDev("")

      toast({
        title: "Success",
        description: `Disk attached successfully as ${diskTargetDev}`,
      })
    } catch (err) {
      console.error('Disk attachment failed:', err)
      toast({
        title: "Error",
        description: `Failed to attach disk: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsAttachingDisk(false)
    }
  }

  const handleAttachNetwork = async () => {
    if (!vmData?.uuid || !networkName || !networkModel) return

    try {
      setIsAttachingNetwork(true)
      const response = await fetch(`/api/vms/${vmData.uuid}/attach-network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkName: networkName,
          model: networkModel
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to attach network interface')
      }

      // Refresh VM data
      const updatedVM = await vmAPI.getById(vmData.uuid)
      setVmData(updatedVM)

      // Close dialog and reset form
      setIsAddNetworkOpen(false)
      setNetworkName("")
      setNetworkModel("virtio")

      toast({
        title: "Success",
        description: `Network interface attached successfully`,
      })
    } catch (err) {
      console.error('Network attachment failed:', err)
      toast({
        title: "Error",
        description: `Failed to attach network interface: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsAttachingNetwork(false)
    }
  }

  const handleRevertSnapshot = async (snapshotName: string) => {
    if (!vmData || !confirm(`This will revert the VM to the state of '${snapshotName}'. All changes made since that time will be lost. The VM must be stopped to perform this action. Continue?`)) {
      return
    }

    setIsPerformingAction(true)
    try {
      const response = await fetch(`/api/vms/${vmData.uuid}/snapshots/${snapshotName}/revert`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to revert snapshot')
      }

      // Refresh VM data
      const updatedVM = await vmAPI.getById(vmData.uuid)
      setVmData(updatedVM)

      toast({
        title: "Success",
        description: `VM reverted to snapshot "${snapshotName}" successfully`,
      })
    } catch (err) {
      console.error('Snapshot revert failed:', err)
      toast({
        title: "Error",
        description: `Failed to revert snapshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsPerformingAction(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-6 sm:p-8 md:p-10 lg:p-12">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-full" />

        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !vmData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error Loading VM</h2>
          <p className="text-muted-foreground">{error || "VM not found"}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/vms')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to VMs
          </Button>
        </div>
      </div>
    )
  }

  const memoryUsagePercent = vmData.max_memory_kb > 0 ? (vmData.memory_kb / vmData.max_memory_kb) * 100 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 text-white">
            <Activity className="mr-1 h-3 w-3" />
            Running
          </Badge>
        )
      case "shutoff":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white">
            <Square className="mr-1 h-3 w-3" />
            Stopped
          </Badge>
        )
      case "paused":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Clock className="mr-1 h-3 w-3" />
            Paused
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatMemory = (kb: number) => {
    const mb = kb / 1024
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`
    }
    return `${Math.round(mb)}MB`
  }

  const copySSHCommand = () => {
    if (!vmData.ip_addresses || vmData.ip_addresses.length === 0) {
      toast({
        title: "No IP Address",
        description: "VM doesn't have an IP address yet. Wait for cloud-init to complete.",
        variant: "destructive",
      })
      return
    }

    const ip = vmData.ip_addresses[0]
    const username = "ubuntu" // Default from cloud-init
    const command = `ssh ubuntu@${ip}`
    
    navigator.clipboard.writeText(command).then(() => {
      toast({
        title: "SSH Command Copied!",
        description: `Copied: ${command}`,
      })
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = command
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      
      toast({
        title: "SSH Command Copied!",
        description: `Copied: ${command}`,
      })
    })
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 md:p-10 lg:p-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/vms')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to VMs
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{vmData.name}</h1>
              {getStatusBadge(vmData.state)}
            </div>
            <p className="text-muted-foreground mt-1">UUID: {vmData.uuid}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {vmData.state === "Running" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performVMAction('stop')}
                disabled={isPerformingAction}
                aria-label={`Stop virtual machine ${vmData.name}`}
              >
                {isPerformingAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performVMAction('reboot')}
                disabled={isPerformingAction}
                aria-label={`Reboot virtual machine ${vmData.name}`}
              >
                {isPerformingAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reboot
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => performVMAction('start')}
              disabled={isPerformingAction}
              aria-label={`Start virtual machine ${vmData.name}`}
            >
              {isPerformingAction ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Check if console endpoint exists first
              fetch(`/api/vms/${vmData.uuid}/serial-console`)
                .then(response => {
                  if (response.ok) {
                    router.push(`/vms/console?id=${vmData.uuid}`)
                  } else {
                    toast({
                      title: "Console Not Available",
                      description: "Serial console is not available for this VM. Make sure the VM is running.",
                      variant: "destructive",
                    })
                  }
                })
                .catch(() => {
                  toast({
                    title: "Error",
                    description: "Failed to check console availability. The VM might not be running.",
                    variant: "destructive",
                  })
                })
            }}
            aria-label={`Open serial console for ${vmData.name}`}
          >
            <Monitor className="mr-2 h-4 w-4" />
            Serial Console
          </Button>
          {vmData.ip_addresses && vmData.ip_addresses.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={copySSHCommand}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Server className="mr-2 h-4 w-4" />
              SSH
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete virtual machine ${vmData.name}`}
            onClick={async () => {
              if (confirm(`Are you sure you want to permanently delete the virtual machine "${vmData.name}"? This action cannot be undone.`)) {
                try {
                  const response = await fetch(`/api/vms/${vmData.uuid}`, {
                    method: 'DELETE',
                  })

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to delete VM (HTTP ${response.status})`);
                  }

                  toast({
                    title: "Success",
                    description: `VM "${vmData.name}" deleted successfully`,
                  })

                  // Redirect to VM list
                  router.push('/vms')
                } catch (error) {
                  console.error('Failed to delete VM:', error)
                  toast({
                    title: "Error",
                    description: `Failed to delete VM: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: "destructive",
                  })
                }
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 mt-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  Configuration
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">vCPUs</p>
                     <p className="text-lg font-semibold">{vmData.vcpus}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">Memory</p>
                     <p className="text-lg font-semibold">{formatMemory(vmData.memory_kb)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">Operating System</p>
                     <p className="text-lg font-semibold">{vmData.os_info || vmData.os || "Unknown"}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-muted-foreground">State</p>
                     <p className="text-lg font-semibold">{vmData.state}</p>
                   </div>
                 </div>
                <Separator />
                 <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Uptime</span>
                     <span>{formatUptime(vmData.uptime_sec)}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">CPU Usage</span>
                     <span>{vmData.cpu_percent.toFixed(1)}%</span>
                   </div>
                 </div>
              </CardContent>
            </Card>

            {/* Current Usage */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Current Usage</CardTitle>
              </CardHeader>
               <CardContent className="space-y-4 pb-4">
                 <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">CPU Usage</span>
                     <span className="font-medium">{vmData.cpu_percent.toFixed(1)}%</span>
                   </div>
                   <Progress value={vmData.cpu_percent} className="h-2" />
                 </div>
                 <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Memory</span>
                     <span className="font-medium">{formatMemory(vmData.memory_kb)}</span>
                   </div>
                    <Progress value={memoryUsagePercent} className="h-2" />
                 </div>
                 <Separator />
                 <div className="grid grid-cols-2 gap-4 text-center">
                   <div>
                     <p className="text-2xl font-bold text-primary">{vmData.cpu_percent.toFixed(1)}%</p>
                     <p className="text-xs text-muted-foreground">CPU Load</p>
                   </div>
                   <div>
                     <p className="text-2xl font-bold text-accent">{vmData.vcpus}</p>
                     <p className="text-xs text-muted-foreground">vCPUs</p>
                   </div>
                 </div>
                </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-4">
          {vmData && <VMPerformanceTab vmUuid={vmData.uuid} />}
        </TabsContent>

        <TabsContent value="storage" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
               <CardTitle className="flex items-center justify-between">
                 Storage Devices
                 <Dialog open={isAddDiskOpen} onOpenChange={setIsAddDiskOpen}>
                   <DialogTrigger asChild>
                     <Button size="sm">
                       <Plus className="mr-2 h-4 w-4" />
                       Add Disk
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-[425px]">
                     <DialogHeader>
                       <DialogTitle>Add Disk to VM</DialogTitle>
                       <DialogDescription>
                         Attach a storage volume to this virtual machine.
                       </DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="volume-path" className="text-right">
                           Volume Path
                         </Label>
                         <Input
                           id="volume-path"
                           value={diskVolumePath}
                           onChange={(e) => setDiskVolumePath(e.target.value)}
                           className="col-span-3"
                           placeholder="/var/lib/libvirt/images/disk.qcow2"
                         />
                       </div>
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="target-dev" className="text-right">
                           Target Device
                         </Label>
                         <Input
                           id="target-dev"
                           value={diskTargetDev}
                           onChange={(e) => setDiskTargetDev(e.target.value)}
                           className="col-span-3"
                           placeholder="vdb"
                         />
                       </div>
                     </div>
                     <DialogFooter>
                       <Button
                         type="submit"
                         onClick={handleAttachDisk}
                         disabled={isAttachingDisk || !diskVolumePath || !diskTargetDev}
                       >
                         {isAttachingDisk ? (
                           <>
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                             Attaching...
                           </>
                         ) : (
                           "Attach Disk"
                         )}
                       </Button>
                     </DialogFooter>
                   </DialogContent>
                 </Dialog>
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Device</TableHead>
                    <TableHead className="px-4">Type</TableHead>
                    <TableHead className="px-4">Size</TableHead>
                    <TableHead className="px-4">Used</TableHead>
                    <TableHead className="px-4">Format</TableHead>
                    <TableHead className="px-4">Pool</TableHead>
                    <TableHead className="px-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vmData.disks.map((device, index) => (
                     <TableRow key={index} className="hover:bg-muted/50">
                       <TableCell className="font-mono px-4">{device.device}</TableCell>
                       <TableCell className="px-4">Disk</TableCell>
                       <TableCell className="px-4">N/A</TableCell>
                       <TableCell className="px-4">N/A</TableCell>
                       <TableCell className="px-4">N/A</TableCell>
                       <TableCell className="px-4">N/A</TableCell>
                      <TableCell className="px-4">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="networking" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
               <CardTitle className="flex items-center justify-between">
                 Network Interfaces
                 <Dialog open={isAddNetworkOpen} onOpenChange={setIsAddNetworkOpen}>
                   <DialogTrigger asChild>
                     <Button size="sm">
                       <Plus className="mr-2 h-4 w-4" />
                       Add Interface
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-[425px]">
                     <DialogHeader>
                       <DialogTitle>Add Network Interface to VM</DialogTitle>
                       <DialogDescription>
                         Attach a network interface to this virtual machine.
                       </DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="network-name" className="text-right">
                           Network
                         </Label>
                         <Input
                           id="network-name"
                           value={networkName}
                           onChange={(e) => setNetworkName(e.target.value)}
                           className="col-span-3"
                           placeholder="default"
                         />
                       </div>
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="network-model" className="text-right">
                           Model
                         </Label>
                         <select
                           id="network-model"
                           value={networkModel}
                           onChange={(e) => setNetworkModel(e.target.value)}
                           className="col-span-3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                         >
                           <option value="virtio">virtio</option>
                           <option value="e1000">e1000</option>
                           <option value="rtl8139">rtl8139</option>
                         </select>
                       </div>
                     </div>
                     <DialogFooter>
                       <Button
                         type="submit"
                         onClick={handleAttachNetwork}
                         disabled={isAttachingNetwork || !networkName}
                       >
                         {isAttachingNetwork ? (
                           <>
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                             Attaching...
                           </>
                         ) : (
                           "Attach Interface"
                         )}
                       </Button>
                     </DialogFooter>
                   </DialogContent>
                 </Dialog>
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Interface</TableHead>
                    <TableHead className="px-4">Type</TableHead>
                    <TableHead className="px-4">Network</TableHead>
                    <TableHead className="px-4">MAC Address</TableHead>
                    <TableHead className="px-4">IP Address</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vmData.nics.map((iface, index) => (
                     <TableRow key={index} className="hover:bg-muted/50">
                       <TableCell className="font-mono px-4">eth{index}</TableCell>
                       <TableCell className="px-4">{iface.model}</TableCell>
                       <TableCell className="px-4">{iface.source}</TableCell>
                       <TableCell className="font-mono px-4">{iface.mac}</TableCell>
                       <TableCell className="font-mono px-4">N/A</TableCell>
                       <TableCell className="px-4">
                         <Badge className="bg-green-500 hover:bg-green-600 text-white">active</Badge>
                       </TableCell>
                      <TableCell className="px-4">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="space-y-6 mt-4">
          <VMSerialConsole vmUuid={vmData.uuid} />
        </TabsContent>

        <TabsContent value="snapshots" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                VM Snapshots
                <Button
                  size="sm"
                  onClick={() => setIsCreateSnapshotOpen(true)}
                  disabled={vmData.state !== "shutoff"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Snapshot
                </Button>
              </CardTitle>
              <CardDescription>
                Create and manage snapshots of your virtual machine
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              {vmData.state !== "shutoff" && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Snapshots can only be created when the VM is stopped. Current state: {vmData.state}
                  </p>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Description</TableHead>
                    <TableHead className="px-4">Created</TableHead>
                    <TableHead className="px-4 w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot) => (
                    <TableRow key={snapshot.name} className="hover:bg-muted/50">
                      <TableCell className="font-medium px-4">{snapshot.name}</TableCell>
                      <TableCell className="px-4">{snapshot.description || "No description"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground px-4">
                        {new Date(snapshot.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevertSnapshot(snapshot.name)}
                            disabled={vmData.state !== "shutoff"}
                            title={vmData.state !== "shutoff" ? "VM must be stopped to revert" : "Revert to this snapshot"}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSnapshot(snapshot.name)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete snapshot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {snapshots.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Camera className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No snapshots found</p>
                  <p className="text-sm">Create your first snapshot to save the current state</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Snapshot Modal */}
      <Dialog open={isCreateSnapshotOpen} onOpenChange={setIsCreateSnapshotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Create a snapshot of the current VM state. The VM must be stopped to create a snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name *</Label>
              <Input
                id="snapshot-name"
                placeholder="e.g., before-upgrade"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-description">Description</Label>
              <Textarea
                id="snapshot-description"
                placeholder="Optional description of this snapshot..."
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSnapshotOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSnapshot}
              disabled={!snapshotName.trim() || isCreatingSnapshot}
            >
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Snapshot"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

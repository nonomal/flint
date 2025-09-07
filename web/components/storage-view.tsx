"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { HardDrive, Plus, Activity, PowerOff, AlertTriangle, Construction, Loader2, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { StoragePool, Volume, storageAPI, hostAPI } from "@/lib/api"
import { SPACING, TYPOGRAPHY, GRIDS, TRANSITIONS, COLORS } from "@/lib/ui-constants"
import { ConsistentButton } from "@/components/ui/consistent-button"
import { ErrorState } from "@/components/ui/error-state"

// Define the Pool type based on our API contract
interface Pool {
  name: string;
  state: "Active" | "Inactive" | "Building" | "Degraded" | "Inaccessible" | "Unknown";
  capacity_b: number;
  allocation_b: number;
}

// Create a dedicated component for rendering the status badge
const PoolStatusBadge = ({ state }: { state: Pool['state'] }) => {
  switch (state) {
    case "Active":
      return (
        <Badge className="bg-primary text-primary-foreground">
          <Activity className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    case "Inactive":
      return (
        <Badge variant="secondary">
          <PowerOff className="mr-1 h-3 w-3" />
          Inactive
        </Badge>
      );
    case "Building":
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500">
          <Construction className="mr-1 h-3 w-3" />
          Building
        </Badge>
      );
    case "Degraded":
    case "Inaccessible":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="mr-1 h-3 w-3" />
          {state}
        </Badge>
      );
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

export function StorageView() {
  const { toast } = useToast()
  const [storagePools, setStoragePools] = useState<StoragePool[]>([])
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [selectedPool, setSelectedPool] = useState<StoragePool | null>(null)
  const [activeTab, setActiveTab] = useState("pools")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hostResources, setHostResources] = useState<any>(null)
  const [isCreateVolumeDialogOpen, setIsCreateVolumeDialogOpen] = useState(false)
  const [newVolumeName, setNewVolumeName] = useState("")
  const [newVolumeSize, setNewVolumeSize] = useState(10) // Default to 10GB
  const [isCreatingVolume, setIsCreatingVolume] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [editVolumeSize, setEditVolumeSize] = useState(0)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    const fetchStorageData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const [pools, resources] = await Promise.all([
          storageAPI.getPools(),
          hostAPI.getResources()
        ])
        setStoragePools(pools)
        setHostResources(resources)

        if (pools && pools.length > 0) {
          const firstPool = pools[0]
          if (firstPool && firstPool.name) {
            setSelectedPool(firstPool)
            // Only fetch volumes if we have a valid pool name
            try {
              const poolVolumes = await storageAPI.getVolumes(firstPool.name)
              setVolumes(poolVolumes)
            } catch (err) {
              console.error("Failed to load volumes for first pool:", err)
              setVolumes([])
            }
          } else {
            setSelectedPool(null)
            setVolumes([])
          }
        } else {
          setSelectedPool(null)
          setVolumes([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load storage data")
        // Don't reset storage data on error - keep existing data
      } finally {
        setIsLoading(false)
      }
    }

    fetchStorageData()
  }, [])

  const handlePoolSelect = async (pool: StoragePool) => {
    if (!pool || !pool.name) {
      console.error("Invalid pool selected:", pool)
      return
    }
    
    setSelectedPool(pool)
    setVolumes([]) // Clear volumes immediately
    
    try {
      const poolVolumes = await storageAPI.getVolumes(pool.name)
      setVolumes(poolVolumes)
    } catch (err) {
      console.error("Failed to load volumes for pool:", pool.name, err)
      setVolumes([])
    }
  }

  const formatSize = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)}TB`
    }
    return `${gb.toFixed(1)}GB`
  }

  const handleCreateVolume = async () => {
    if (!selectedPool?.name) return
    
    try {
      setIsCreatingVolume(true)
      const newVolume = await storageAPI.createVolume(selectedPool!.name, {
        Name: newVolumeName,
        SizeGB: newVolumeSize,
      })
      
      // Refresh volumes list with proper error handling
      try {
        const updatedVolumes = await storageAPI.getVolumes(selectedPool.name)
        setVolumes(updatedVolumes || [])
      } catch (volumeErr) {
        console.warn('Failed to refresh volumes after creation:', volumeErr)
        // Don't show error since volume was created successfully
        setVolumes(prevVolumes => [...prevVolumes, {
          name: newVolumeName,
          path: `${selectedPool!.name}/${newVolumeName}`,
          capacity_b: newVolumeSize * 1024 * 1024 * 1024
        }])
      }
      
      // Close dialog and reset form
      setIsCreateVolumeDialogOpen(false)
      setNewVolumeName("")
      setNewVolumeSize(10)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create volume")
    } finally {
      setIsCreatingVolume(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading storage data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${SPACING.section} ${SPACING.page}`}>
        <ErrorState 
          title="Error Loading Storage"
          description={error}
        />
      </div>
    )
  }

  return (
    <div className={`${SPACING.section} ${SPACING.page}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className={TYPOGRAPHY.pageTitle}>Storage</h1>
          <p className="text-muted-foreground">Manage storage pools and virtual disk volumes</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <ConsistentButton 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                icon={<Plus className="h-4 w-4" />}
              >
                Create Pool
              </ConsistentButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Storage Pool</DialogTitle>
                <DialogDescription>
                  Create a new storage pool for virtual machine disks
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pool-name">Pool Name</Label>
                  <Input id="pool-name" placeholder="e.g., vm-storage" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pool-path">Storage Path</Label>
                  <Input id="pool-path" placeholder="/var/lib/libvirt/images" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pool-type">Pool Type</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="dir">Directory</option>
                    <option value="fs">Filesystem</option>
                    <option value="netfs">Network Filesystem</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Pool</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Storage Overview Cards */}
      <div className={`${GRIDS.fourCol} ${SPACING.grid}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pools</p>
                <p className="text-2xl font-bold">{storagePools.length}</p>
              </div>
              <HardDrive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Pools</p>
                <p className="text-2xl font-bold text-primary">
                  {(storagePools || []).filter((pool) => pool.allocation_b > 0).length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Capacity</p>
                <p className="text-2xl font-bold">
                  {hostResources ? formatSize(hostResources.storage_total_b) : formatSize(storagePools.reduce((acc, pool) => acc + pool.capacity_b, 0))}
                </p>
              </div>
              <HardDrive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Volumes</p>
                <p className="text-2xl font-bold">{volumes.length}</p>
              </div>
              <HardDrive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mt-4">
          <TabsTrigger value="pools">Storage Pools</TabsTrigger>
          <TabsTrigger value="volumes">All Volumes</TabsTrigger>
        </TabsList>

        <TabsContent value="pools" className="space-y-6 mt-6">
          <div className={`grid gap-6 lg:grid-cols-3`}>
            {/* Storage Pools List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-between">
                    Storage Pools
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {(storagePools || []).map((pool) => (
                    <div
                      key={pool.name}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                        selectedPool?.name === pool.name ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => handlePoolSelect(pool)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{pool.name}</p>
                          <p className="text-xs text-muted-foreground">Storage Pool</p>
                        </div>
                        <PoolStatusBadge state="Active" />
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatSize(pool.allocation_b)} used</span>
                          <span>{formatSize(pool.capacity_b)} total</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div
                            className="bg-primary h-1 rounded-full"
                            style={{ width: `${(pool.allocation_b / pool.capacity_b) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Selected Pool Details */}
            <div className="lg:col-span-2">
              {selectedPool?.name && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between">
                      {selectedPool.name}
                      <div className="flex gap-2">
                        <Dialog open={isCreateVolumeDialogOpen} onOpenChange={setIsCreateVolumeDialogOpen}>
                          <DialogTrigger asChild>
                            <ConsistentButton 
                              size="sm"
                              icon={<Plus className="h-4 w-4" />}
                            >
                              Create Volume
                            </ConsistentButton>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Create New Volume</DialogTitle>
                              <DialogDescription>
                                Create a new storage volume in the {selectedPool.name} pool.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                  Name
                                </Label>
                                <Input
                                  id="name"
                                  value={newVolumeName}
                                  onChange={(e) => setNewVolumeName(e.target.value)}
                                  className="col-span-3"
                                  placeholder="e.g., my-disk"
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="size" className="text-right">
                                  Size (GB)
                                </Label>
                                <Input
                                  id="size"
                                  type="number"
                                  min="1"
                                  value={newVolumeSize}
                                  onChange={(e) => setNewVolumeSize(Number(e.target.value))}
                                  className="col-span-3"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                type="submit" 
                                onClick={handleCreateVolume}
                                disabled={isCreatingVolume || !newVolumeName}
                              >
                                {isCreatingVolume ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  "Create Volume"
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 pb-4">
                    {/* Pool Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                        <p className="font-semibold">Storage Pool</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <PoolStatusBadge state="Active" />
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p className="font-mono text-sm">{selectedPool.name}</p>
                      </div>
                    </div>

                    {/* Storage Usage */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Storage Usage</span>
                        <span className="font-medium">
                          {formatSize(selectedPool.allocation_b)} / {formatSize(selectedPool.capacity_b)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(selectedPool.allocation_b / selectedPool.capacity_b) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatSize(selectedPool.capacity_b - selectedPool.allocation_b)} available</span>
                        <span>{((selectedPool.allocation_b / selectedPool.capacity_b) * 100).toFixed(1)}% used</span>
                      </div>
                    </div>

                    {/* Volumes in Pool */}
                    <div>
                      <h3 className="font-medium mb-2">Volumes ({volumes.length})</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Allocation</TableHead>
                            <TableHead>Used By</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(volumes || []).map((volume) => (
                            <TableRow key={volume.name}>
                              <TableCell className="font-medium">{volume.name}</TableCell>
                              <TableCell>qcow2</TableCell>
                              <TableCell>{formatSize(volume.capacity_b)}</TableCell>
                              <TableCell>{formatSize(volume.capacity_b)}</TableCell>
                              <TableCell>
                                <span className="text-muted-foreground">Unknown</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="hover:bg-muted"
                                    onClick={() => {
                                      setEditingVolume(volume)
                                      setEditVolumeSize(Math.round(volume.capacity_b / (1024 * 1024 * 1024)))
                                      setIsEditDialogOpen(true)
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                      if (!selectedPool?.name) {
                                        toast({
                                          title: "Error",
                                          description: "No storage pool selected",
                                          variant: "destructive",
                                        })
                                        return
                                      }
                                      
                                      if (confirm(`Are you sure you want to delete volume "${volume.name}"?`)) {
                                        try {
                                          const response = await fetch(`/api/storage-pools/${selectedPool!.name}/volumes/${volume.name}`, {
                                            method: 'DELETE',
                                          })
                                          if (!response.ok) {
                                            throw new Error('Failed to delete volume')
                                          }
                                          const updatedVolumes = await storageAPI.getVolumes(selectedPool!.name)
                                          setVolumes(updatedVolumes)
                                          toast({
                                            title: "Success",
                                            description: `Volume "${volume.name}" deleted successfully`,
                                          })
                                        } catch (err) {
                                          toast({
                                            title: "Delete Failed",
                                            description: err instanceof Error ? err.message : "Failed to delete volume",
                                            variant: "destructive",
                                          })
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="volumes" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                All Volumes ({volumes.length})
                <Dialog open={isCreateVolumeDialogOpen} onOpenChange={setIsCreateVolumeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      Create Volume
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New Volume</DialogTitle>
                      <DialogDescription>
                        Create a new storage volume.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={newVolumeName}
                          onChange={(e) => setNewVolumeName(e.target.value)}
                          className="col-span-3"
                          placeholder="e.g., my-disk"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="size" className="text-right">
                          Size (GB)
                        </Label>
                        <Input
                          id="size"
                          type="number"
                          min="1"
                          value={newVolumeSize}
                          onChange={(e) => setNewVolumeSize(Number(e.target.value))}
                          className="col-span-3"
                        />
                      </div>
                      {selectedPool && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="pool" className="text-right">
                            Pool
                          </Label>
                          <div className="col-span-3">
                            <select
                              value={selectedPool.name}
                              onChange={(e) => {
                                const pool = storagePools.find(p => p.name === e.target.value)
                                if (pool) setSelectedPool(pool)
                              }}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {(storagePools || []).map(pool => (
                                <option key={pool.name} value={pool.name}>{pool.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        onClick={handleCreateVolume}
                        disabled={isCreatingVolume || !newVolumeName || !selectedPool}
                      >
                        {isCreatingVolume ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Volume"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Pool</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Used By</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(volumes || []).map((volume) => (
                    <TableRow key={volume.name}>
                      <TableCell className="font-medium">{volume.name}</TableCell>
                      <TableCell>{selectedPool?.name || "Unknown"}</TableCell>
                      <TableCell>qcow2</TableCell>
                      <TableCell>{formatSize(volume.capacity_b)}</TableCell>
                      <TableCell>{formatSize(volume.capacity_b)}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">Unknown</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">{volume.path}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditingVolume(volume)
                            setEditVolumeSize(Math.round(volume.capacity_b / (1024 * 1024 * 1024)))
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Volume Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Volume</DialogTitle>
            <DialogDescription>
              Modify volume settings. Note: Only expansion is supported for safety.
            </DialogDescription>
          </DialogHeader>
          {editingVolume && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!editingVolume || !selectedPool?.name) return

              try {
                const response = await fetch(`/api/storage-pools/${selectedPool.name}/volumes/${editingVolume.name}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ size_gb: editVolumeSize })
                })

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}))
                  throw new Error(errorData.error || `Failed to update volume (HTTP ${response.status})`)
                }

                // Refresh volumes list
                const updatedVolumes = await storageAPI.getVolumes(selectedPool.name)
                setVolumes(updatedVolumes)

                toast({
                  title: "Success",
                  description: `Volume "${editingVolume.name}" updated successfully`,
                })
                setIsEditDialogOpen(false)
                setEditingVolume(null)
              } catch (err) {
                toast({
                  title: "Update Failed",
                  description: err instanceof Error ? err.message : "Failed to update volume",
                  variant: "destructive",
                })
              }
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-volume-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit-volume-name"
                    value={editingVolume.name}
                    className="col-span-3"
                    disabled
                    title="Volume name cannot be changed"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-volume-size" className="text-right">
                    Size (GB)
                  </Label>
                  <Input
                    id="edit-volume-size"
                    type="number"
                    min={Math.ceil(editingVolume.capacity_b / (1024 * 1024 * 1024))}
                    value={editVolumeSize}
                    onChange={(e) => setEditVolumeSize(parseInt(e.target.value) || 0)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Current</Label>
                  <div className="col-span-3 text-sm text-muted-foreground">
                    {Math.round(editingVolume.capacity_b / (1024 * 1024 * 1024))} GB
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingVolume(null)
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update Volume
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
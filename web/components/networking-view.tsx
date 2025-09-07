"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Network,
  Plus,
  Activity,
  PowerOff,
  Settings,
  Trash2,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react"
import { networkAPI, VirtualNetwork } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { ErrorState } from "@/components/ui/error-state"
import { SPACING, TYPOGRAPHY } from "@/lib/ui-constants"

export function NetworkingView() {
  const { toast } = useToast()
  const [networks, setNetworks] = useState<VirtualNetwork[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editingNetwork, setEditingNetwork] = useState<VirtualNetwork | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newNetworkName, setNewNetworkName] = useState("")
  const [newBridgeName, setNewBridgeName] = useState("")

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        setIsLoading(true)
        const data = await networkAPI.getNetworks()
        setNetworks(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load networks')
        // Don't reset networks on error - keep existing data
      } finally {
        setIsLoading(false)
      }
    }

    fetchNetworks()
  }, [])

  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNetworkName.trim() || !newBridgeName.trim()) return

    try {
      setIsCreating(true)
      setError(null) // Clear previous errors
      await networkAPI.createNetwork(newNetworkName, newBridgeName)
      
      // Refresh the networks list
      const updatedNetworks = await networkAPI.getNetworks()
      setNetworks(updatedNetworks)
      
      // Reset form and close dialog
      setNewNetworkName("")
      setNewBridgeName("")
      setIsCreateDialogOpen(false)
      
      // Show success message
      toast({
        title: "Success",
        description: `Network "${newNetworkName}" created successfully`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create network'
      setError(errorMessage)
      
      // Show error toast
      toast({
        title: "Network Creation Failed",
        description: errorMessage.includes('iptables') 
          ? "iptables not found. Please install iptables on your system."
          : errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const getStatusBadge = (network: VirtualNetwork) => {
    if (network.is_active) {
      return (
        <Badge className="bg-primary text-primary-foreground">
          <Activity className="mr-1 h-3 w-3" />
          Active
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary">
          <PowerOff className="mr-1 h-3 w-3" />
          Inactive
        </Badge>
      )
    }
  }

  const getPersistenceBadge = (network: VirtualNetwork) => {
    if (network.is_persistent) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <Settings className="mr-1 h-3 w-3" />
          Persistent
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline">
          <Trash2 className="mr-1 h-3 w-3" />
          Transient
        </Badge>
      )
    }
  }

  if (isLoading) {
    return (
      <div className={`${SPACING.section} ${SPACING.page}`}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading networks...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${SPACING.section} ${SPACING.page}`}>
        <ErrorState 
          title="Error Loading Networks"
          description={error}
        />
      </div>
    )
  }

  return (
    <div className={`${SPACING.section} ${SPACING.page}`}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className={TYPOGRAPHY.pageTitle}>Networking</h1>
          <p className="text-muted-foreground">Manage virtual networks and network interfaces</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Network Types</h2>
          <p className="text-muted-foreground">Choose from bridge, NAT, or isolated network types</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Network
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateNetwork}>
              <DialogHeader>
                <DialogTitle>Create Network</DialogTitle>
                <DialogDescription>
                  Create a new virtual network for your VMs. Enter the network details below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Network Name
                  </Label>
                  <Input
                    id="name"
                    value={newNetworkName}
                    onChange={(e) => setNewNetworkName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., my-network"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Network Type
                  </Label>
                  <select
                    id="type"
                    className="col-span-3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="bridge">Bridge Network</option>
                    <option value="nat">NAT Network</option>
                    <option value="isolated">Isolated Network</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bridge" className="text-right">
                    Bridge Name
                  </Label>
                  <Input
                    id="bridge"
                    value={newBridgeName}
                    onChange={(e) => setNewBridgeName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., virbr0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || !newNetworkName.trim() || !newBridgeName.trim()}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Network"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Network Overview Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Networks</p>
                <p className="text-2xl font-bold">{(networks || []).length}</p>
              </div>
              <Network className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Networks</p>
                <p className="text-2xl font-bold text-primary">
                  {(networks || []).filter(n => n.is_active === true).length}
                </p>
              </div>
              <Wifi className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactive Networks</p>
                <p className="text-2xl font-bold">{(networks || []).filter(n => n.is_active !== true).length}</p>
              </div>
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Persistent</p>
                <p className="text-2xl font-bold text-accent">
                  {(networks || []).filter(n => n.is_persistent === true).length}
                </p>
              </div>
              <Settings className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Networks Table */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg font-semibold">Virtual Networks ({(networks || []).length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Persistence</TableHead>
                <TableHead className="px-4">Bridge</TableHead>
                <TableHead className="px-4">Type</TableHead>
                <TableHead className="px-4">Connected VMs</TableHead>
                <TableHead className="px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(networks || []).map((network) => (
                <TableRow key={network.name} className="hover:bg-muted/50">
                  <TableCell className="font-medium px-4">{network.name}</TableCell>
                  <TableCell className="px-4">{getStatusBadge(network)}</TableCell>
                  <TableCell className="px-4">{getPersistenceBadge(network)}</TableCell>
                  <TableCell className="font-mono px-4">{network.bridge}</TableCell>
                  <TableCell className="font-mono px-4">{network.type || "bridge"}</TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-muted-foreground text-xs">No VMs</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="hover:bg-muted"
                        onClick={() => {
                          setEditingNetwork(network)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete the network "${network.name}"?`)) {
                            try {
                              const response = await fetch(`/api/networks/${network.name}`, {
                                method: 'DELETE',
                              })
                              if (!response.ok) {
                                throw new Error('Failed to delete network')
                              }
                              const updatedNetworks = await networkAPI.getNetworks()
                              setNetworks(updatedNetworks)
                              toast({
                                title: "Success",
                                description: `Network "${network.name}" deleted successfully`,
                              })
                            } catch (err) {
                              toast({
                                title: "Delete Failed",
                                description: err instanceof Error ? err.message : "Failed to delete network",
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
        </CardContent>
      </Card>

      {/* Edit Network Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Network</DialogTitle>
            <DialogDescription>
              Modify network settings. Note: Some changes may require network restart.
            </DialogDescription>
          </DialogHeader>
          {editingNetwork && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!editingNetwork) return

              try {
                const action = editingNetwork.is_active ? "stop" : "start"
                
                const response = await fetch(`/api/networks/${editingNetwork.name}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ action })
                })

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}))
                  throw new Error(errorData.error || `Failed to update network (HTTP ${response.status})`)
                }

                // Refresh networks list
                const updatedNetworks = await networkAPI.getNetworks()
                setNetworks(updatedNetworks)

                toast({
                  title: "Success",
                  description: `Network "${editingNetwork.name}" ${action}ed successfully`,
                })
                setIsEditDialogOpen(false)
                setEditingNetwork(null)
              } catch (err) {
                toast({
                  title: "Update Failed",
                  description: err instanceof Error ? err.message : "Failed to update network",
                  variant: "destructive",
                })
              }
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={editingNetwork.name}
                    className="col-span-3"
                    disabled
                    title="Network name cannot be changed"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-bridge" className="text-right">
                    Bridge
                  </Label>
                  <Input
                    id="edit-bridge"
                    value={editingNetwork.bridge}
                    className="col-span-3"
                    disabled
                    title="Bridge name cannot be changed after creation"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-status" className="text-right">
                    Action
                  </Label>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      {editingNetwork.is_active ? (
                        <Badge className="bg-green-500 text-white">Currently Active</Badge>
                      ) : (
                        <Badge variant="secondary">Currently Inactive</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        → Will {editingNetwork.is_active ? "stop" : "start"} network
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-persistent" className="text-right">
                    Persistent
                  </Label>
                  <div className="col-span-3">
                    {editingNetwork.is_persistent ? (
                      <Badge className="bg-blue-500 text-white">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingNetwork(null)
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingNetwork.is_active ? "Stop Network" : "Start Network"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { navigateTo, routes } from "@/lib/navigation"
import { SPACING, TYPOGRAPHY, TRANSITIONS } from "@/lib/ui-constants"
import { ConsistentButton } from "@/components/ui/consistent-button"
import { storageAPI, networkAPI, imageAPI, Image } from "@/lib/api"
import { ImageRepository } from "@/components/image-repository"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  ImageIcon,
  Settings,
  Zap,
  Upload,
  Download,
  Router,
  Cable,
} from "lucide-react"

interface VMConfig {
  // Source
  sourceType: "iso" | "template" | "import"
  selectedSource: string
  imageName: string
  imageType: "iso" | "template"

  // Cloud-Init
  enableCloudInit: boolean
  cloudInitConfig: {
    hostname?: string
    username?: string
    password?: string
    sshKeys?: string[]
    packages?: string[]
    runCmd?: string[]
    writeFiles?: Array<{
      path: string
      content: string
      permissions?: string
    }>
    networkConfig?: {
      dhcp: boolean
      ipAddress?: string
      prefix?: number
      gateway?: string
      dnsServers?: string[]
    }
    customYaml?: string
  }
  cloudInitMode: "guided" | "yaml"

  // Basic Info
  name: string
  description: string

  // Compute
  vcpus: number
  memory: number

  // Storage
  diskSize: number
  storagePool: string
  diskFormat: "qcow2" | "raw"

  // Network
  networks: Array<{
    interfaceType: string // virtual-network, bridge, direct
    source: string // network name or interface name
    model: string // virtio, e1000, rtl8139
  }>

  // Advanced
  autostart: boolean
  osType: string
  firmware: "bios" | "uefi"
}

const steps = [
  { id: "source", title: "Source Selection", icon: ImageIcon },
  { id: "basic", title: "Basic Information", icon: Settings },
  { id: "compute", title: "Compute Resources", icon: Cpu },
  { id: "storage", title: "Storage Configuration", icon: HardDrive },
  { id: "network", title: "Network Configuration", icon: Network },
  { id: "review", title: "Review & Create", icon: Check },
]

export function CreateVMWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [config, setConfig] = useState<VMConfig>({
    sourceType: "iso",
    selectedSource: "",
    imageName: "",
    imageType: "iso",
    enableCloudInit: false,
    cloudInitConfig: {
      networkConfig: {
        dhcp: true,
        ipAddress: "",
        prefix: 24,
        gateway: "",
        dnsServers: [],
      }
    },
    cloudInitMode: "guided",
    name: "",
    description: "",
    vcpus: 2,
    memory: 4096,
    diskSize: 50,
    storagePool: "default",
    diskFormat: "qcow2",
    networks: [{ interfaceType: "virtual-network", source: "default", model: "virtio" }],
    autostart: false,
    osType: "linux",
    firmware: "bios",
  })

  const [storagePools, setStoragePools] = useState<any[]>([])
  const [virtualNetworks, setVirtualNetworks] = useState<any[]>([])
  const [systemInterfaces, setSystemInterfaces] = useState<any[]>([])
  const [images, setImages] = useState<Image[]>([])

  const updateConfig = (updates: Partial<VMConfig>) => {
    setConfig(prev => {
      // If sourceType is changing, reset selectedSource
      if (updates.sourceType && updates.sourceType !== prev.sourceType) {
        return { ...prev, ...updates, selectedSource: "" }
      }
      return { ...prev, ...updates }
    })
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pools = await storageAPI.getPools()
        setStoragePools((pools || []).map(p => ({
          name: p.name,
          path: '', // API doesn't provide path
          available: `${Math.round(p.capacity_b / 1024 / 1024 / 1024)}GB`
        })))
        const [nets, interfaces] = await Promise.all([
          networkAPI.getNetworks(),
          networkAPI.getSystemInterfaces()
        ])
        
        setVirtualNetworks((nets || []).map(n => ({
          name: n.name,
          type: 'virtual-network',
          description: n.is_active ? 'Active virtual network' : 'Inactive virtual network',
          status: n.is_active ? 'active' : 'inactive'
        })))
        
        // Add bridge and physical interfaces that can be used for VMs
        const usableInterfaces = (interfaces || []).filter(iface => 
          iface.type === 'bridge' || iface.type === 'physical'
        ).map(iface => ({
          name: iface.name,
          type: iface.type,
          description: `${iface.type} interface${iface.ip_addresses && Array.isArray(iface.ip_addresses) && iface.ip_addresses.length > 0 ? ` (${iface.ip_addresses[0]})` : ''}`,
          status: iface.state
        }))
        
        setSystemInterfaces(usableInterfaces)

        // Fetch images
        try {
          const imagesData = await imageAPI.getAll()
          setImages(imagesData)
        } catch (err) {
          console.warn('Failed to fetch images:', err)
          setImages([])
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      }
    }
    fetchData()
  }, [])

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Source
        return config.selectedSource !== ""
      case 1: // Basic
        return config.name.trim() !== ""
      case 2: // Compute
        return config.vcpus > 0 && config.memory > 0
      case 3: // Storage
        return config.diskSize > 0 && config.storagePool !== ""
      case 4: // Network
        return config.networks.length > 0
      default:
        return true
    }
  }

  

  const formatSize = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024
    if (gb >= 1) {
      return `${gb.toFixed(1)}GB`
    }
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(0)}MB`
  }



  const generateTemplateDescription = (name: string, size: number) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('ubuntu')) {
      return 'Pre-configured Ubuntu server template with essential packages'
    }
    if (lowerName.includes('centos')) {
      return 'CentOS-based template with development tools and web server stack'
    }
    if (lowerName.includes('debian')) {
      return 'Minimal Debian template optimized for stability and security'
    }
    if (lowerName.includes('web') || lowerName.includes('apache') || lowerName.includes('nginx')) {
      return 'Web server template with pre-installed LAMP/LEMP stack'
    }
    if (lowerName.includes('database') || lowerName.includes('mysql') || lowerName.includes('postgres')) {
      return 'Database server template with optimized storage configuration'
    }
    return `Custom template (${formatSize(size)}) ready for deployment`
  }

  const handleFormSubmit = async (formData: any) => {
    try {
      const response = await fetch('/api/vms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create VM');
      }

      const newVM = await response.json();

      // SUCCESS: Redirect the user to the new VM's detail page.
      navigateTo(routes.vmDetail(newVM.uuid));

    } catch (error) {
      // ERROR: Display an error message/toast to the user.
      console.error("VM creation failed:", error);
      // e.g., setToast({ variant: 'destructive', message: error.message });
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Source Selection
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Choose Installation Source</Label>
              <p className="text-sm text-muted-foreground mt-1">Select how you want to create your virtual machine</p>
            </div>

            <RadioGroup
              value={config.sourceType}
              onValueChange={(value) => updateConfig({ sourceType: value as any })}
            >
              <div className="space-y-3">
                <div className={`flex items-center space-x-3 rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                  config.sourceType === "iso" 
                    ? "border-primary bg-primary/10" 
                    : "border-muted hover:border-accent"
                }`}
                onClick={() => updateConfig({ sourceType: "iso" })}>
                  <RadioGroupItem 
                    value="iso" 
                    id="iso" 
                    className={config.sourceType === "iso" ? "border-primary" : ""}
                  />
                  <div className="flex-1">
                    <Label htmlFor="iso" className="font-medium">
                      ISO Image
                    </Label>
                    <p className="text-sm text-muted-foreground">Install from an ISO image file</p>
                  </div>
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className={`flex items-center space-x-3 rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                  config.sourceType === "template" 
                    ? "border-primary bg-primary/10" 
                    : "border-muted hover:border-accent"
                }`}
                onClick={() => updateConfig({ sourceType: "template" })}>
                  <RadioGroupItem 
                    value="template" 
                    id="template" 
                    className={config.sourceType === "template" ? "border-primary" : ""}
                  />
                  <div className="flex-1">
                    <Label htmlFor="template" className="font-medium">
                      VM Template
                    </Label>
                    <p className="text-sm text-muted-foreground">Create from a pre-configured template</p>
                  </div>
                  <Download className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className={`flex items-center space-x-3 rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                  config.sourceType === "import" 
                    ? "border-primary bg-primary/10" 
                    : "border-muted hover:border-accent"
                }`}
                onClick={() => updateConfig({ sourceType: "import" })}>
                  <RadioGroupItem 
                    value="import" 
                    id="import" 
                    className={config.sourceType === "import" ? "border-primary" : ""}
                  />
                  <div className="flex-1">
                    <Label htmlFor="import" className="font-medium">
                      Import Existing
                    </Label>
                    <p className="text-sm text-muted-foreground">Import an existing virtual machine</p>
                  </div>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </RadioGroup>

            {config.sourceType === "iso" && (
              <div className="space-y-3">
                <Label>Available ISO Images</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(images || []).filter(img => img.type === "iso").length > 0 ? (
                    (images || []).filter(img => img.type === "iso").map((image) => (
                      <div
                        key={image.id}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 ${
                          config.selectedSource === image.name 
                            ? "border-primary bg-primary/10" 
                            : "border-muted hover:border-accent hover:bg-muted/50"
                        }`}
                        onClick={() => updateConfig({ 
                          selectedSource: image.name, 
                          imageName: image.name, 
                          imageType: image.type 
                        })}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{image.name}</p>
                            <p className="text-sm text-muted-foreground">{image.os_info || "Unknown OS"}</p>
                          </div>
                          <Badge variant="outline">{formatSize(image.size_b)}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border p-4 text-center text-muted-foreground">
                      No ISO images available. Add an ISO image to get started.
                    </div>
                  )}
                </div>
              </div>
            )}

            {config.sourceType === "template" && (
              <div className="space-y-3">
                <Label>Available Cloud Images</Label>
                <p className="text-sm text-muted-foreground">Pre-configured cloud images with cloud-init support</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(images || []).filter(img => img.type === "template").length > 0 ? (
                    (images || []).filter(img => img.type === "template").map((image) => (
                      <div
                        key={image.id}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 ${
                          config.selectedSource === image.name 
                            ? "border-primary bg-primary/10" 
                            : "border-muted hover:border-accent hover:bg-muted/50"
                        }`}
                        onClick={() => updateConfig({ 
                          selectedSource: image.name, 
                          imageName: image.name, 
                          imageType: image.type 
                        })}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{image.name}</p>
                            <p className="text-sm text-muted-foreground">{image.description || generateTemplateDescription(image.name, image.size_b)}</p>
                          </div>
                          <Badge variant="outline">{formatSize(image.size_b)}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border p-4 text-center text-muted-foreground">
                      No templates available. Add a template to get started.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      case 1: // Basic Information
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Basic Information</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure the basic settings for your virtual machine
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vm-name">Virtual Machine Name *</Label>
                <Input
                  id="vm-name"
                  placeholder="e.g., web-server-01"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use a descriptive name that helps identify the VM's purpose
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vm-description">Description</Label>
                <Textarea
                  id="vm-description"
                  placeholder="Optional description of the virtual machine's purpose..."
                  value={config.description}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="os-type">Operating System Type</Label>
                <Select value={config.osType} onValueChange={(value) => updateConfig({ osType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="unix">Unix</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firmware">Firmware Type</Label>
                <Select value={config.firmware} onValueChange={(value) => updateConfig({ firmware: value as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bios">BIOS (Legacy)</SelectItem>
                    <SelectItem value="uefi">UEFI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autostart"
                  checked={config.autostart}
                  onCheckedChange={(checked) => updateConfig({ autostart: checked as boolean })}
                />
                <Label htmlFor="autostart">Start VM automatically when host boots</Label>
              </div>
            </div>
          </div>
        )

      case 2: // Compute Resources
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Compute Resources</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Allocate CPU and memory resources for your virtual machine
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Cpu className="h-4 w-4" />
                    Virtual CPUs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vcpus">Number of vCPUs</Label>
                    <Select
                      value={config.vcpus.toString()}
                      onValueChange={(value) => updateConfig({ vcpus: Number.parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 vCPU</SelectItem>
                        <SelectItem value="2">2 vCPUs</SelectItem>
                        <SelectItem value="4">4 vCPUs</SelectItem>
                        <SelectItem value="8">8 vCPUs</SelectItem>
                        <SelectItem value="16">16 vCPUs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">Recommended: 2-4 vCPUs for most workloads</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MemoryStick className="h-4 w-4" />
                    Memory (RAM)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="memory">Memory Size</Label>
                    <Select
                      value={config.memory.toString()}
                      onValueChange={(value) => updateConfig({ memory: Number.parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024">1 GB</SelectItem>
                        <SelectItem value="2048">2 GB</SelectItem>
                        <SelectItem value="4096">4 GB</SelectItem>
                        <SelectItem value="8192">8 GB</SelectItem>
                        <SelectItem value="16384">16 GB</SelectItem>
                        <SelectItem value="32768">32 GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">Minimum: 1GB, Recommended: 4GB+</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resource Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{config.vcpus}</p>
                    <p className="text-sm text-muted-foreground">vCPUs Allocated</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-accent">{(config.memory / 1024).toFixed(0)}GB</p>
                    <p className="text-sm text-muted-foreground">Memory Allocated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 3: // Storage Configuration
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Storage Configuration</Label>
              <p className="text-sm text-muted-foreground mt-1">Configure the virtual disk for your virtual machine</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HardDrive className="h-4 w-4" />
                    Disk Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disk-size">Disk Size (GB)</Label>
                    <Select
                      value={config.diskSize.toString()}
                      onValueChange={(value) => updateConfig({ diskSize: Number.parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20 GB</SelectItem>
                        <SelectItem value="50">50 GB</SelectItem>
                        <SelectItem value="100">100 GB</SelectItem>
                        <SelectItem value="200">200 GB</SelectItem>
                        <SelectItem value="500">500 GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disk-format">Disk Format</Label>
                    <Select
                      value={config.diskFormat}
                      onValueChange={(value) => updateConfig({ diskFormat: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qcow2">qcow2 (Recommended)</SelectItem>
                        <SelectItem value="raw">raw</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Storage Pool</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(storagePools || []).map((pool) => (
                    <div
                      key={pool.name}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                        config.storagePool === pool.name ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => updateConfig({ storagePool: pool.name })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{pool.name}</p>
                          <p className="text-xs text-muted-foreground">{pool.path}</p>
                        </div>
                        <Badge variant="outline">{pool.available} free</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Storage Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Disk Size</span>
                    <span className="font-medium">{config.diskSize}GB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">{config.diskFormat}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Storage Pool</span>
                    <span className="font-medium">{config.storagePool}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 4: // Network Configuration
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Network Configuration</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure network interfaces for your virtual machine
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Network Interfaces
                  </span>
                  <ConsistentButton
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateConfig({
                        networks: [...config.networks, { interfaceType: "virtual-network", source: "default", model: "virtio" }],
                      })
                    }
                  >
                    Add Interface
                  </ConsistentButton>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.networks.map((netConfig, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Interface {index + 1}</h4>
                      {config.networks.length > 1 && (
                        <ConsistentButton
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateConfig({
                              networks: (config.networks || []).filter((_, i) => i !== index),
                            })
                          }
                        >
                          Remove
                        </ConsistentButton>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Network Source</Label>
                        <Select
                          value={netConfig.source}
                          onValueChange={(value) => {
                            const newNetworks = [...config.networks]
                            newNetworks[index].source = value
                            
                            // Determine interface type based on selection
                            const selectedVirtual = virtualNetworks.find(n => n.name === value)
                            const selectedSystem = systemInterfaces.find(i => i.name === value)
                            
                            if (selectedVirtual) {
                              newNetworks[index].interfaceType = "virtual-network"
                            } else if (selectedSystem) {
                              if (selectedSystem.type === 'bridge') {
                                newNetworks[index].interfaceType = "bridge"
                              } else {
                                newNetworks[index].interfaceType = "direct"
                              }
                            }
                            
                            updateConfig({ networks: newNetworks })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select network source" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Virtual Networks */}
                            {(virtualNetworks || []).length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Virtual Networks</div>
                                {virtualNetworks.map((network) => (
                                  <SelectItem key={`vnet-${network.name}`} value={network.name}>
                                    <div className="flex items-center gap-2">
                                      <Network className="h-4 w-4" />
                                      <span>{network.name}</span>
                                      <Badge variant={network.status === 'active' ? 'default' : 'secondary'}>
                                        virtual
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            
                            {/* System Interfaces */}
                            {(systemInterfaces || []).length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">System Interfaces</div>
                                {systemInterfaces.map((iface) => (
                                  <SelectItem key={`sys-${iface.name}`} value={iface.name}>
                                    <div className="flex items-center gap-2">
                                      {iface.type === 'bridge' ? (
                                        <Router className="h-4 w-4" />
                                      ) : (
                                        <Cable className="h-4 w-4" />
                                      )}
                                      <span>{iface.name}</span>
                                      <Badge variant={iface.status === 'up' ? 'default' : 'secondary'}>
                                        {iface.type}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Network Model</Label>
                        <Select
                          value={netConfig.model}
                          onValueChange={(value) => {
                            const newNetworks = [...config.networks]
                            newNetworks[index].model = value
                            updateConfig({ networks: newNetworks })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="virtio">virtio (Recommended)</SelectItem>
                            <SelectItem value="e1000">e1000</SelectItem>
                            <SelectItem value="rtl8139">rtl8139</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Show network details */}
                    {(() => {
                      const selectedNetwork = virtualNetworks.find((n) => n.name === netConfig.source) ||
                                            systemInterfaces.find((i) => i.name === netConfig.source)
                      return selectedNetwork ? (
                        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                          <p className="text-muted-foreground">
                            Interface: {netConfig.interfaceType} • Source: {selectedNetwork.name} • Model: {netConfig.model}
                          </p>
                          {selectedNetwork.description && (
                            <p className="text-muted-foreground mt-1">{selectedNetwork.description}</p>
                          )}
                        </div>
                      ) : null
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )

      case 5: // Review & Create
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Review Configuration</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Review your virtual machine configuration before creating
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{config.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS Type</span>
                    <span className="font-medium">{config.osType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Firmware</span>
                    <span className="font-medium">{config.firmware.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Autostart</span>
                    <span className="font-medium">{config.autostart ? "Yes" : "No"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{config.sourceType.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium truncate max-w-32" title={config.selectedSource}>
                      {config.selectedSource}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Compute Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">vCPUs</span>
                    <span className="font-medium">{config.vcpus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">{(config.memory / 1024).toFixed(0)}GB</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Storage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Disk Size</span>
                    <span className="font-medium">{config.diskSize}GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">{config.diskFormat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pool</span>
                    <span className="font-medium">{config.storagePool}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Network Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(config.networks || []).map((netConfig, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Interface {index + 1}</span>
                      <span className="font-medium">
                        {netConfig.source} ({netConfig.model})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {config.description && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ConsistentButton variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to VMs
          </ConsistentButton>
          <div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {(steps || []).map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    index <= currentStep
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      index <= currentStep ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && <ChevronRight className="mx-4 h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <ConsistentButton variant="outline" onClick={prevStep} disabled={currentStep === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </ConsistentButton>

        <div className="flex gap-2">
          {currentStep === steps.length - 1 ? (
            <ConsistentButton
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const formData = {
                  Name: config.name,
                  MemoryMB: config.memory,
                  VCPUs: config.vcpus,
                  DiskPool: config.storagePool,
                  DiskSizeGB: config.diskSize,
                  ISOPath: config.sourceType === 'iso' ? config.selectedSource : '',
                  imageName: config.imageName,
                  imageType: config.imageType,
                  StartOnCreate: config.autostart,
                  NetworkName: config.networks[0]?.source || '',
                  CloudInit: config.enableCloudInit ? {
                    CommonFields: {
                      hostname: config.cloudInitConfig.hostname || '',
                      username: config.cloudInitConfig.username || '',
                      password: config.cloudInitConfig.password || '',
                      packages: config.cloudInitConfig.packages || [],
                      sshKeys: config.cloudInitConfig.sshKeys?.join('\n') || '',
                      networkConfig: config.cloudInitConfig.networkConfig ? {
                        useDHCP: config.cloudInitConfig.networkConfig.dhcp,
                        ipAddress: config.cloudInitConfig.networkConfig.ipAddress || '',
                        prefix: config.cloudInitConfig.networkConfig.prefix || 24,
                        gateway: config.cloudInitConfig.networkConfig.gateway || '',
                        dnsServers: config.cloudInitConfig.networkConfig.dnsServers || []
                      } : null
                    },
                    RawUserData: config.cloudInitConfig.customYaml || ''
                  } : null
                };
                handleFormSubmit(formData);
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              Create Virtual Machine
            </ConsistentButton>
          ) : (
            <ConsistentButton onClick={nextStep} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </ConsistentButton>
          )}
        </div>
      </div>
    </div>
  )
}

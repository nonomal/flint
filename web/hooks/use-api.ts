import useSWR from "swr"
import { hostAPI, vmAPI, storageAPI, type VMDetailed } from "@/lib/api"

// Host hooks
export function useHostStatus() {
  return useSWR("host-status", hostAPI.getStatus, {
    refreshInterval: 5000, // Refresh every 5 seconds
    revalidateOnFocus: true,
  })
}

export function useHostResources() {
  return useSWR("host-resources", hostAPI.getResources, {
    refreshInterval: 10000, // Refresh every 10 seconds
    revalidateOnFocus: true,
  })
}

// VM hooks
export function useVMs() {
  return useSWR("vms", vmAPI.getAll, {
    refreshInterval: 3000, // Refresh every 3 seconds for VM list
    revalidateOnFocus: true,
  })
}

export function useVM(uuid: string | null) {
  return useSWR(uuid ? `vm-${uuid}` : null, () => (uuid ? vmAPI.getById(uuid) : null), {
    refreshInterval: 2000, // Refresh every 2 seconds for individual VM
    revalidateOnFocus: true,
  })
}

// Storage hooks
export function useStoragePools() {
  return useSWR("storage-pools", storageAPI.getPools, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
  })
}

export function useVolumes(poolName: string | null) {
  return useSWR(poolName ? `volumes-${poolName}` : null, () => (poolName ? storageAPI.getVolumes(poolName) : null), {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  })
}

// Helper function to get optimistic VM state based on action
function getOptimisticVMState(currentVM: any, action: string) {
  if (!currentVM) return currentVM

  switch (action) {
    case 'start':
      return { ...currentVM, state: 'running' }
    case 'stop':
    case 'shutdown':
      return { ...currentVM, state: 'shut off' }
    case 'restart':
    case 'reset':
      // For restart, briefly show as running during the transition
      return { ...currentVM, state: 'running' }
    case 'pause':
      return { ...currentVM, state: 'paused' }
    case 'resume':
      return { ...currentVM, state: 'running' }
    default:
      return currentVM
  }
}

// Utility hook for mutations with optimistic updates
export function useApiMutation() {
  const { mutate } = useSWR(null) // Get the global mutate function

  const performVMAction = async (uuid: string, action: string) => {
    // Get current data for optimistic updates
    const currentVM = await mutate(`vm-${uuid}`)
    const currentVMs = await mutate("vms")

    // Calculate optimistic state
    const optimisticVM = currentVM ? getOptimisticVMState(currentVM, action) : currentVM
    const optimisticVMs = currentVMs ? currentVMs.map((vm: any) =>
      vm.uuid === uuid ? getOptimisticVMState(vm, action) : vm
    ) : currentVMs

    try {
      // Apply optimistic update first
      if (optimisticVM) {
        await mutate(`vm-${uuid}`, optimisticVM)
      }

      // Perform the API call
      const result = await vmAPI.performAction(uuid, { action: action as any })

      // Also update the VM list optimistically
      if (optimisticVMs) {
        await mutate("vms", optimisticVMs)
      }

      // Revalidate both after successful API call
      await mutate(`vm-${uuid}`)
      await mutate("vms")

      return result
    } catch (error) {
      // Revert optimistic updates on error
      if (currentVM) {
        await mutate(`vm-${uuid}`, currentVM)
      }
      if (currentVMs) {
        await mutate("vms", currentVMs)
      }
      throw error
    }
  }

  const deleteVM = async (uuid: string, deleteDisks = false) => {
    // Get current data for optimistic updates
    const currentVMs = await mutate("vms")

    try {
      // Optimistically remove VM from list
      if (currentVMs) {
        const optimisticVMs = currentVMs.filter((vm: any) => vm.uuid !== uuid)
        await mutate("vms", optimisticVMs)
      }

      // Clear individual VM cache
      await mutate(`vm-${uuid}`, null)

      // Perform the actual API call
      await vmAPI.delete(uuid, deleteDisks)

      // Revalidate to ensure consistency
      await mutate("vms")
    } catch (error) {
      // Revert optimistic updates on error
      if (currentVMs) {
        await mutate("vms", currentVMs)
      }
      throw error
    }
  }

  const createVM = async (config: any) => {
    try {
      // Perform the API call first (since we don't know the new VM details)
      const result = await vmAPI.create(config)

      // Revalidate VM list to get the new VM
      await mutate("vms")

      return result
    } catch (error) {
      throw error
    }
  }

  return {
    performVMAction,
    deleteVM,
    createVM,
  }
}

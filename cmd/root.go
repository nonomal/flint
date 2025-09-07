package cmd

import (
	"embed"
	"github.com/spf13/cobra"
)

var socketPath string
var globalAssets embed.FS

var rootCmd = &cobra.Command{
	Use:   "flint",
	Short: "flint is a modern, self-contained KVM management tool.",
}

func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}

func ExecuteWithAssets(assets embed.FS) {
	globalAssets = assets
	cobra.CheckErr(rootCmd.Execute())
}

func init() {
	// This flag will be available to all subcommands
	rootCmd.PersistentFlags().StringVar(&socketPath, "socket", "/var/run/libvirt/libvirt-sock", "Path to the libvirt socket")
	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(vmCmd)
	rootCmd.AddCommand(snapshotCmd)
	rootCmd.AddCommand(networkCmd)
	rootCmd.AddCommand(storageCmd)
	rootCmd.AddCommand(imageCmd)
}

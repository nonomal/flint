package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config represents the application configuration
type Config struct {
	Server   ServerConfig   `json:"server"`
	Security SecurityConfig `json:"security"`
	Libvirt  LibvirtConfig  `json:"libvirt"`
	Logging  LoggingConfig  `json:"logging"`
}

// ServerConfig represents server-specific configuration
type ServerConfig struct {
	Host         string `json:"host"`
	Port         int    `json:"port"`
	ReadTimeout  int    `json:"read_timeout"`  // seconds
	WriteTimeout int    `json:"write_timeout"` // seconds
}

// SecurityConfig represents security-related configuration
type SecurityConfig struct {
	RateLimitRequests int    `json:"rate_limit_requests"` // requests per minute
	RateLimitBurst    int    `json:"rate_limit_burst"`    // burst size
	PassphraseHash    string `json:"passphrase_hash"`     // bcrypt hash of web UI passphrase
}

// LibvirtConfig represents libvirt-related configuration
type LibvirtConfig struct {
	URI           string `json:"uri"`
	ISOPool       string `json:"iso_pool"`
	TemplatePool  string `json:"template_pool"`
	ImagePoolPath string `json:"image_pool_path"`
}

// LoggingConfig represents logging configuration
type LoggingConfig struct {
	Level  string `json:"level"`  // DEBUG, INFO, WARN, ERROR, FATAL
	Format string `json:"format"` // json, text
}

// DefaultConfig returns the default configuration
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host:         "0.0.0.0",
			Port:         5550,
			ReadTimeout:  30,
			WriteTimeout: 30,
		},
		Security: SecurityConfig{
			RateLimitRequests: 100,
			RateLimitBurst:    20,
		},
		Libvirt: LibvirtConfig{
			URI:           "qemu:///system",
			ISOPool:       "isos",
			TemplatePool:  "templates",
			ImagePoolPath: "/var/lib/flint/images",
		},
		Logging: LoggingConfig{
			Level:  "INFO",
			Format: "json",
		},
	}
}

// LoadConfig loads configuration from file and environment variables
func LoadConfig(configPath string) (*Config, error) {
	config := DefaultConfig()

	// Use default config path if not provided
	if configPath == "" {
		configPath = filepath.Join(os.Getenv("HOME"), ".flint", "config.json")
	}

	// Load from config file if it exists
	if err := loadFromFile(config, configPath); err != nil {
		return nil, fmt.Errorf("failed to load config file: %w", err)
	}

	// Override with environment variables
	loadFromEnv(config)

	return config, nil
}

// loadFromFile loads configuration from a JSON file
func loadFromFile(config *Config, path string) error {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Config file doesn't exist, use defaults
			return nil
		}
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	return decoder.Decode(config)
}

// loadFromEnv loads configuration from environment variables
func loadFromEnv(config *Config) {
	// Server configuration
	if host := os.Getenv("FLINT_SERVER_HOST"); host != "" {
		config.Server.Host = host
	}
	if port := os.Getenv("FLINT_SERVER_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Server.Port = p
		}
	}
	if readTimeout := os.Getenv("FLINT_SERVER_READ_TIMEOUT"); readTimeout != "" {
		if rt, err := strconv.Atoi(readTimeout); err == nil {
			config.Server.ReadTimeout = rt
		}
	}
	if writeTimeout := os.Getenv("FLINT_SERVER_WRITE_TIMEOUT"); writeTimeout != "" {
		if wt, err := strconv.Atoi(writeTimeout); err == nil {
			config.Server.WriteTimeout = wt
		}
	}

	// Security configuration
	if rateLimit := os.Getenv("FLINT_SECURITY_RATE_LIMIT"); rateLimit != "" {
		if rl, err := strconv.Atoi(rateLimit); err == nil {
			config.Security.RateLimitRequests = rl
		}
	}
	if burst := os.Getenv("FLINT_SECURITY_RATE_BURST"); burst != "" {
		if b, err := strconv.Atoi(burst); err == nil {
			config.Security.RateLimitBurst = b
		}
	}

	// Libvirt configuration
	if uri := os.Getenv("FLINT_LIBVIRT_URI"); uri != "" {
		config.Libvirt.URI = uri
	}
	if isoPool := os.Getenv("FLINT_LIBVIRT_ISO_POOL"); isoPool != "" {
		config.Libvirt.ISOPool = isoPool
	}
	if templatePool := os.Getenv("FLINT_LIBVIRT_TEMPLATE_POOL"); templatePool != "" {
		config.Libvirt.TemplatePool = templatePool
	}
	if imagePoolPath := os.Getenv("FLINT_LIBVIRT_IMAGE_POOL_PATH"); imagePoolPath != "" {
		config.Libvirt.ImagePoolPath = imagePoolPath
	}

	// Logging configuration
	if level := os.Getenv("FLINT_LOG_LEVEL"); level != "" {
		config.Logging.Level = strings.ToUpper(level)
	}
	if format := os.Getenv("FLINT_LOG_FORMAT"); format != "" {
		config.Logging.Format = strings.ToLower(format)
	}
}

// SaveConfig saves the configuration to a file
func (c *Config) SaveConfig(path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(c)
}

// GetServerAddress returns the full server address
func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// Validate server config
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}
	if c.Server.ReadTimeout < 1 {
		return fmt.Errorf("read timeout must be positive")
	}
	if c.Server.WriteTimeout < 1 {
		return fmt.Errorf("write timeout must be positive")
	}

	// Validate security config
	if c.Security.RateLimitRequests < 1 {
		return fmt.Errorf("rate limit requests must be positive")
	}
	if c.Security.RateLimitBurst < 1 {
		return fmt.Errorf("rate limit burst must be positive")
	}

	// Validate libvirt config
	if c.Libvirt.URI == "" {
		return fmt.Errorf("libvirt URI cannot be empty")
	}
	if c.Libvirt.ImagePoolPath == "" {
		return fmt.Errorf("image pool path cannot be empty")
	}

	// Validate logging config
	validLevels := map[string]bool{
		"DEBUG": true,
		"INFO":  true,
		"WARN":  true,
		"ERROR": true,
		"FATAL": true,
	}
	if !validLevels[c.Logging.Level] {
		return fmt.Errorf("invalid log level: %s", c.Logging.Level)
	}

	validFormats := map[string]bool{
		"json": true,
		"text": true,
	}
	if !validFormats[c.Logging.Format] {
		return fmt.Errorf("invalid log format: %s", c.Logging.Format)
	}

	return nil
}

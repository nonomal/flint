# Flint Production Deployment Guide

This guide covers deploying Flint in a production environment with proper security, monitoring, and reliability.

## Prerequisites

- Linux server with KVM support
- `libvirt` and `qemu-kvm` installed and running
- Root or sudo access for installation
- Go 1.25+ (for building from source, optional)

## Quick Installation

### Option 1: Automated Installation (Recommended)

```bash
# Install Flint binary
curl -fsSL https://raw.githubusercontent.com/ccheshirecat/flint/main/install.sh | sh

# Install as systemd service
sudo ./install-systemd.sh
```

### Option 2: Manual Installation

```bash
# 1. Install Flint binary
sudo cp flint /usr/local/bin/
sudo chmod +x /usr/local/bin/flint

# 2. Create flint user
sudo useradd -r -s /bin/false -d /var/lib/flint -m flint
sudo usermod -a -G libvirt flint

# 3. Create directories
sudo mkdir -p /var/lib/flint/images /var/log/flint
sudo chown -R flint:flint /var/lib/flint /var/log/flint

# 4. Install systemd service
sudo cp flint.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable flint
sudo systemctl start flint
```

## Security Configuration

### 1. API Authentication

Flint uses Bearer token authentication. Get your API key:

```bash
flint api-key
```

Use it in API requests:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:5550/api/vms
```

### 2. Network Security

- **Firewall**: Restrict access to port 5550
- **Reverse Proxy**: Use nginx/Caddy for SSL termination
- **Rate Limiting**: Built-in (100 requests/minute per IP)

Example nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5550;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. File Permissions

Flint runs as the `flint` user with restricted permissions:

- Read/write access to `/var/lib/flint`
- Access to libvirt socket
- No access to other system files

## Monitoring & Health Checks

### Health Check Endpoint

```bash
curl http://localhost:5550/api/health
```

Response includes:
- Service status (healthy/unhealthy)
- System metrics
- Libvirt connectivity status
- Host resource usage

### Service Monitoring

```bash
# Check service status
sudo systemctl status flint

# View logs
sudo journalctl -u flint -f

# Restart service
sudo systemctl restart flint
```

### Log Files

- Application logs: `/var/log/flint/`
- System logs: `journalctl -u flint`

## Performance Tuning

### Resource Limits

The systemd service includes:
- Memory limit: 1GB
- File descriptors: 65536
- CPU and I/O restrictions

### Libvirt Configuration

Ensure libvirt is optimized:

```bash
# Check libvirt configuration
sudo virsh pool-list
sudo virsh net-list

# Monitor libvirt logs
sudo journalctl -u libvirtd -f
```

## Backup & Recovery

### VM Images

Flint stores VM images in `/var/lib/flint/images/`. Backup this directory:

```bash
# Create backup
sudo tar -czf flint-images-$(date +%Y%m%d).tar.gz /var/lib/flint/images/

# Restore backup
sudo tar -xzf flint-images-20241201.tar.gz -C /
```

### Configuration

- API key is generated on startup (document it securely)
- No persistent configuration files needed
- All settings are runtime or compile-time

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   sudo systemctl status flint
   sudo journalctl -u flint -n 50
   ```

2. **Permission denied**
   ```bash
   sudo usermod -a -G libvirt flint
   sudo systemctl restart flint
   ```

3. **Port already in use**
   ```bash
   sudo netstat -tlnp | grep :5550
   # Edit flint.service to change port
   ```

4. **High memory usage**
   - Check for memory leaks in VM operations
   - Monitor with `htop` or `systemd-cgtop`

### Debug Mode

For debugging, run manually:

```bash
sudo -u flint /usr/local/bin/flint serve
```

## Scaling Considerations

### Multiple Instances

For high availability:
- Use shared storage for VM images
- Load balancer for multiple Flint instances
- Database for session/API key management (future feature)

### Resource Planning

- **Memory**: 1GB base + VM memory
- **Storage**: Plan for VM disk images
- **Network**: 1Gbps minimum for VM traffic

## Security Best Practices

1. **Regular Updates**
   ```bash
   # Update Flint
   curl -fsSL https://raw.githubusercontent.com/ccheshirecat/flint/main/install.sh | sh

   # Update system packages
   sudo apt update && sudo apt upgrade
   ```

2. **Access Control**
   - Use strong API keys
   - Rotate keys regularly
   - Monitor access logs

3. **Network Security**
   - Use HTTPS in production
   - Restrict API access by IP
   - Enable firewall rules

4. **Audit Logging**
   - All API requests are logged
   - Monitor for suspicious activity
   - Regular log rotation

## Support

For production support:
- Check logs: `journalctl -u flint -f`
- Health check: `curl http://localhost:5550/api/health`
- GitHub issues: Report bugs and feature requests

## Migration from Development

When moving from development to production:

1. ✅ Install as systemd service
2. ✅ Configure SSL/reverse proxy
3. ✅ Set up monitoring
4. ✅ Configure backups
5. ✅ Update firewall rules
6. ✅ Test all functionality
7. ✅ Document API keys securely
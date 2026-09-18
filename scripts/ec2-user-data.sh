#!/bin/bash
# EC2 user-data: base toolchain for the NetSettle demo host (Amazon Linux 2023).
# App deploy itself happens over SSH afterwards (clone, build, bootstrap).
set -eux
dnf update -y
dnf install -y git java-21-amazon-corretto-headless tar gzip

curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs
npm install -g pnpm@10.0.0

DPM_VER=1.0.22
curl -fsSL "https://github.com/digital-asset/dpm/releases/download/${DPM_VER}/dpm-${DPM_VER}-linux-amd64.tar.gz" -o /tmp/dpm.tgz
mkdir -p /opt/dpm && tar -xzf /tmp/dpm.tgz -C /opt/dpm
ln -sf /opt/dpm/dpm /usr/local/bin/dpm

CADDY_VER=2.11.4
curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VER}/caddy_${CADDY_VER}_linux_amd64.tar.gz" -o /tmp/caddy.tgz
tar -xzf /tmp/caddy.tgz -C /usr/local/bin caddy
chmod +x /usr/local/bin/caddy
mkdir -p /etc/caddy /var/lib/caddy && chown -R ec2-user:ec2-user /etc/caddy /var/lib/caddy

mkdir -p /opt/netsettle && chown ec2-user:ec2-user /opt/netsettle
echo "user-data done" > /var/log/netsettle-userdata.done

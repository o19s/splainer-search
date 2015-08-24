#!/usr/bin/env bash
set -e

# Install Node packages
cd /vagrant/
bower --config.interactive=false install
npm install

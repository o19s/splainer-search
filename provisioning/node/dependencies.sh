#!/usr/bin/env bash
set -e

# Install yarn
sudo apt-get update -qq && sudo apt-get install -y vim curl git tmux
sudo curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get install -y yarn

# Install Node packages
cd /vagrant/
npm install

#!/usr/bin/env bash

mkdir -p $HOME/alfredo

curl -sSL \
    -o $HOME/alfredo/alf https://github.com/getalfredo/alf/releases/download/alf-cli/linux-x64

chmod a+x $HOME/alfredo/alf

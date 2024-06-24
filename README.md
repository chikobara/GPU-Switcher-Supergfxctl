# GPU-Supergfxctl-Switch

GPU Profile switcher Gnome-Shell-Extension for ASUS laptops using Supergfxctl

Currently tested on Arch / Gnome 46 / X11

Supergfxctl v5.2.x

asusctl v6.0.x

it supports all modes :
Integrated, Hybrid, VFIO, AsusEgpu, AsusMuxDgpu

![screenshot example](./img/scr.png)

## Use this only if you

1. Have a laptop with Optimus Mux Switch and want to switch between iGPU and dGPU modes
2. want to monitor the dGPU status

## Dependencies

- [asusctl](https://gitlab.com/asus-linux/asusctl)
- [supergfxctl](https://gitlab.com/asus-linux/supergfxctl)

## Installation

- Install all the dependencies then you can choose manual method or install directly from gnome extension store

### Gnome Extensions Store

- Download the extension from the Store

 [<img alt="EGO page" height="70" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/7018/gpu-supergfxctl-switch/)

### Manual

- clone this repo

    ```bash
    cp -rf GPU-Switcher-Supergfxctl ~/.local/share/gnome-shell/extensions/gpu-switcher-supergfxctl@chikobara.github.io
    ```

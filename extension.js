import Gio from "gi://Gio";
import St from "gi://St";
import GObject from "gi://GObject";
import {
  QuickMenuToggle,
  SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Util from "resource:///org/gnome/shell/misc/util.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// Define GPU profiles with their names, icons, and commands
const GPU_PROFILE_PARAMS = {
  Integrated: {
    name: "Integrated",
    iconName: "video-display-symbolic",
    command: "supergfxctl -m Integrated",
  },
  Hybrid: {
    name: "Hybrid",
    iconName: "video-joined-displays-symbolic",
    command: "supergfxctl -m Hybrid",
  },
  Vfio: {
    name: "Vfio",
    iconName: "computer-symbolic",
    command: "supergfxctl -m Vfio",
  },
  AsusEgpu: {
    name: "AsusEgpu",
    iconName: "display-symbolic",
    command: "supergfxctl -m AsusEgpu",
  },
  AsusMuxDgpu: {
    name: "AsusMuxDgpu",
    iconName: "video-display-symbolic",
    command: "supergfxctl -m AsusMuxDgpu",
  },
};

const GpuProfilesToggle = GObject.registerClass(
  {
    Properties: {
      "active-profile": GObject.ParamSpec.string(
        "active-profile",
        "Active Profile",
        "The currently active GPU profile",
        GObject.ParamFlags.READWRITE,
        null
      ),
    },
  },
  class GpuProfilesToggle extends QuickMenuToggle {
    _init(path) {
      super._init({ title: "GPU Mode" });

      this._profileItems = new Map();
      this._activeProfile = null;
      this.connect("clicked", () => {
        this._sync();
      });

      this._path = path;
      this._activeProfile = null;

      this.headerIcon = Gio.icon_new_for_string(
        `${this._path}/icons/pci-card-symbolic.svg`
      );
      this._profileSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._profileSection);
      this.menu.setHeader(this.headerIcon, "GPU Mode");
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._fetchSupportedProfiles();
    }

    _fetchSupportedProfiles() {
      try {
        let proc = Gio.Subprocess.new(
          ["supergfxctl", "-s"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok) {
              const supportedProfiles = this._parseSupportedProfiles(
                stdout.trim()
              );
              this._addProfileToggles(supportedProfiles);
              this._fetchCurrentProfile();
            } else {
              console.error(`Failed to fetch supported profiles: ${stderr}`);
              this._addProfileToggles(Object.keys(GPU_PROFILE_PARAMS));
              this._fetchCurrentProfile();
            }
          } catch (e) {
            console.error(
              `Error while fetching supported profiles: ${e.message}`
            );
            this._addProfileToggles(Object.keys(GPU_PROFILE_PARAMS));
            this._fetchCurrentProfile();
          }
        });
      } catch (e) {
        console.error(`Failed to execute supergfxctl: ${e.message}`);
        this._addProfileToggles(Object.keys(GPU_PROFILE_PARAMS));
        this._fetchCurrentProfile();
      }
    }

    _parseSupportedProfiles(output) {
      try {
        return output.replace(/[\[\]\s]/g, "").split(",");
      } catch (e) {
        console.error(`Error parsing supported profiles: ${e.message}`);
        return Object.keys(GPU_PROFILE_PARAMS);
      }
    }

    _fetchCurrentProfile() {
      try {
        let proc = Gio.Subprocess.new(
          ["supergfxctl", "-g"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok && stdout.trim() in GPU_PROFILE_PARAMS) {
              this._setActiveProfile(stdout.trim());
            } else {
              console.error(`Failed to fetch current profile: ${stderr}`);
              this._setActiveProfile("Hybrid"); // Fallback to default
            }
          } catch (e) {
            console.error(`Error while fetching current profile: ${e.message}`);
            this._setActiveProfile("Hybrid"); // Fallback to default
          }
        });
      } catch (e) {
        console.error(`Failed to execute supergfxctl: ${e.message}`);
        this._setActiveProfile("Hybrid"); // Fallback to default
      }
    }

    _addProfileToggles(supportedProfiles) {
      for (const profile of supportedProfiles) {
        if (GPU_PROFILE_PARAMS[profile]) {
          const params = GPU_PROFILE_PARAMS[profile];
          const item = new PopupMenu.PopupImageMenuItem(
            params.name,
            params.iconName
          );
          item.connect("activate", () => {
            console.log(`Activating profile: ${profile}`);
            this._activateProfile(profile, params.command);
          });
          this._profileItems.set(profile, item);
          this._profileSection.addMenuItem(item);
        }
      }
    }

    _activateProfile(profile, command) {
      if (
        (profile === "Vfio" && this._activeProfile === "Hybrid") ||
        (profile === "Hybrid" && this._activeProfile === "Vfio")
      ) {
        console.error(
          "Direct switching between Vfio and Hybrid profiles is not supported."
        );
        Main.notify(
          "GPU Switcher",
          "Direct switching between Vfio and Hybrid profiles is not supported."
        );
        return;
      }

      try {
        let proc = Gio.Subprocess.new(
          ["sh", "-c", command],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (proc.get_successful()) {
              console.log(`Profile ${profile} activated successfully`);
              const previousProfile = this._activeProfile;
              this._setActiveProfile(profile);
              if (
                (previousProfile === "Integrated" && profile === "Hybrid") ||
                (previousProfile === "Hybrid" && profile === "Integrated")
              ) {
                Util.spawnCommandLine("gnome-session-quit --logout");
              }
            } else {
              console.error(
                `Failed to activate profile ${profile}: ${stderr.trim()}`
              );
            }
          } catch (e) {
            console.error(
              `Error while activating profile ${profile}: ${e.message}`
            );
          }
        });
      } catch (e) {
        console.error(`Failed to execute command: ${e.message}`);
      }
    }

    _setActiveProfile(profile) {
      if (GPU_PROFILE_PARAMS[profile]) {
        console.log(`Setting active profile: ${profile}`);
        this._activeProfile = profile;
        this.notify("active-profile");
        this._sync();
      } else {
        console.error(`Unknown profile: ${profile}`);
      }
    }

    get activeProfile() {
      return this._activeProfile;
    }

    _sync() {
      console.log(`Synchronizing profile: ${this._activeProfile}`);

      const params = GPU_PROFILE_PARAMS[this._activeProfile];

      if (!params) {
        console.error(
          `Active profile ${this._activeProfile} is not defined in GPU_PROFILE_PARAMS.`
        );
        return;
      }

      for (const [profile, item] of this._profileItems) {
        item.setOrnament(
          profile === this._activeProfile
            ? PopupMenu.Ornament.CHECK
            : PopupMenu.Ornament.NONE
        );
      }

      this.set({ subtitle: params.name, iconName: params.iconName });

      this.checked = this._activeProfile !== "Hybrid";
    }
  }
);

export const Indicator = GObject.registerClass(
  class Indicator extends SystemIndicator {
    _init(path) {
      super._init();

      this._icon = this.add_child(
        new St.Icon({ style_class: "system-status-icon" })
      );
      this._toggle = new GpuProfilesToggle(path);
      this.quickSettingsItems.push(this._toggle);

      this._toggle.connect(
        "notify::active-profile",
        this._updateIcon.bind(this)
      );
      this._updateIcon();
    }

    _updateIcon() {
      const activeProfile = this._toggle.activeProfile;
      if (activeProfile && GPU_PROFILE_PARAMS[activeProfile]) {
        const params = GPU_PROFILE_PARAMS[activeProfile];
        this._icon.gicon = Gio.icon_new_for_string(params.iconName);
        this._icon.visible = true;
      } else {
        this._icon.visible = false;
      }
    }
  }
);

export default class GpuSwitcherExtension extends Extension {
  enable() {
    this._indicator = new Indicator(this.path);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
    this._indicator = null;
  }
}

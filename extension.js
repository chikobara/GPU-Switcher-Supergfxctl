import Gio from "gi://Gio";
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
    iconName: "computer-symbolic",
    command: "supergfxctl -m Integrated && gnome-session-quit --logout",
  },
  Hybrid: {
    name: "Hybrid",
    iconName: "processor-symbolic",
    command: "supergfxctl -m Hybrid && gnome-session-quit --logout",
  },
  /* dedicated: {
    name: "Dedicated",
    iconName: "graphics-card-symbolic",
    command: "supergfxctl -m dedicated",
  }, */
};

const GpuProfilesToggle = GObject.registerClass(
  class GpuProfilesToggle extends QuickMenuToggle {
    _init() {
      super._init({ title: "GPU Mode" });

      this._profileItems = new Map();
      this._activeProfile = null; // Will be set after running supergfxctl -g

      this.connect("clicked", () => {
        this._sync();
      });

      this._profileSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._profileSection);
      this.menu.setHeader("graphics-card-symbolic", "GPU Mode");
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._addProfileToggles();
      this._fetchCurrentProfile();
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
              this._setActiveProfile(stdout.trim().toLowerCase());
            } else {
              log(`Failed to fetch current profile: ${stderr}`);
              this._setActiveProfile("Hybrid"); // Fallback to default
            }
          } catch (e) {
            log(`Error while fetching current profile: ${e.message}`);
            this._setActiveProfile("Hybrid"); // Fallback to default
          }
        });
      } catch (e) {
        log(`Failed to execute supergfxctl: ${e.message}`);
        this._setActiveProfile("Hybrid"); // Fallback to default
      }
    }

    _addProfileToggles() {
      for (const [profile, params] of Object.entries(GPU_PROFILE_PARAMS)) {
        const item = new PopupMenu.PopupImageMenuItem(
          params.name,
          params.iconName
        );
        item.connect("activate", () => {
          log(`Activating profile: ${profile}`);
          Util.spawnCommandLine(params.command);
          this._setActiveProfile(profile);
        });
        this._profileItems.set(profile, item);
        this._profileSection.addMenuItem(item);
      }
    }

    _setActiveProfile(profile) {
      if (GPU_PROFILE_PARAMS[profile]) {
        log(`Setting active profile: ${profile}`);
        this._activeProfile = profile;
        this._sync();
      } else {
        log(`Unknown profile: ${profile}`);
      }
    }

    _sync() {
      log(`Synchronizing profile: ${this._activeProfile}`);

      const params = GPU_PROFILE_PARAMS[this._activeProfile];

      if (!params) {
        log(
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
    _init() {
      super._init();
      this.quickSettingsItems.push(new GpuProfilesToggle());
    }
  }
);

export default class GpuSwitcherExtension extends Extension {
  enable() {
    this._indicator = new Indicator();
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
  }
}

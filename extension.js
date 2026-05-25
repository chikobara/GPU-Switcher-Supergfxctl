import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import {
  QuickMenuToggle,
  SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const GPU_PROFILE_PARAMS = {
  Integrated: {
    name: "Integrated",
    iconName: "video-single-display-symbolic",
    command: ["supergfxctl", "-m", "Integrated"],
  },
  Hybrid: {
    name: "Hybrid",
    iconName: "video-joined-displays-symbolic",
    command: ["supergfxctl", "-m", "Hybrid"],
  },
  Vfio: {
    name: "Vfio",
    iconName: "applications-engineering-symbolic",
    command: ["supergfxctl", "-m", "Vfio"],
  },
  AsusEgpu: {
    name: "AsusEgpu",
    iconName: "display-projector-symbolic",
    command: ["supergfxctl", "-m", "AsusEgpu"],
  },
  AsusMuxDgpu: {
    name: "AsusMuxDgpu",
    iconName: "drive-multidisk-symbolic",
    command: ["supergfxctl", "-m", "AsusMuxDgpu"],
  },
};

const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;
const SHOW_PANEL_ICON_KEY = "show-panel-icon";

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
    _init(path, settings) {
      super._init({ title: "GPU Mode" });

      this._profileItems = new Map();
      this._activeProfile = null;
      this._retryTimeoutId = null;
      this._settings = settings;
      this._clickedId = null;
      this._settingsChangedId = null;
      this._showPanelIconItemToggledId = null;
      this._clickedId = this.connect("clicked", () => {
        this._sync();
      });

      this._path = path;

      this.headerIcon = Gio.icon_new_for_string(
        `${this._path}/ico/pci-card-symbolic.svg`
      );
      this._profileSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._profileSection);
      this.menu.setHeader(this.headerIcon, "GPU Mode");
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this._showPanelIconItem = new PopupMenu.PopupSwitchMenuItem(
        "Show Panel Icon",
        this._settings.get_boolean(SHOW_PANEL_ICON_KEY)
      );
      this._showPanelIconItemToggledId = this._showPanelIconItem.connect(
        "toggled",
        (_item, state) => {
          this._settings.set_boolean(SHOW_PANEL_ICON_KEY, state);
        }
      );
      this.menu.addMenuItem(this._showPanelIconItem);
      this._settingsChangedId = this._settings.connect(
        `changed::${SHOW_PANEL_ICON_KEY}`,
        () => {
          this._showPanelIconItem.setToggleState(
            this._settings.get_boolean(SHOW_PANEL_ICON_KEY)
          );
        }
      );

      // Fetch supported and current profiles
      this._fetchSupportedProfiles();

      // Subscribe to DBus signal for GPU mode changes
      this._subscribeToDBus();
    }

    _subscribeToDBus() {
      this._dbusConnection = Gio.DBus.system; // Use the system bus
      this._signalId = this._dbusConnection.signal_subscribe(
        "org.supergfxctl.Daemon",      // Sender (service) name
        "org.supergfxctl.Daemon",      // Interface name
        "NotifyGfx",                   // Signal name
        "/org/supergfxctl/Gfx",        // Object path
        null,                          // No argument filter
        Gio.DBusSignalFlags.NONE,
        () => {
          this._fetchCurrentProfile();
        }
      );
    }

    _fetchSupportedProfiles() {
      this._executeCommandWithRetry(
        ["supergfxctl", "-s"],
        (stdout) => {
          const supportedProfiles = this._parseSupportedProfiles(stdout.trim());
          this._addProfileToggles(supportedProfiles);
          this._fetchCurrentProfile();
        },
        () => {
          // Fallback: use all defined profiles.
          this._addProfileToggles(Object.keys(GPU_PROFILE_PARAMS));
          this._fetchCurrentProfile();
        }
      );
    }

    _parseSupportedProfiles(output) {
      try {
        // Remove brackets/spaces and split on comma
        return output.replace(/[\[\]\s]/g, "").split(",");
      } catch (e) {
        return Object.keys(GPU_PROFILE_PARAMS);
      }
    }

    _fetchCurrentProfile() {
      this._executeCommandWithRetry(
        ["supergfxctl", "-g"],
        (stdout) => {
          let profile = stdout.trim();
          if (profile in GPU_PROFILE_PARAMS) {
            this._setActiveProfile(profile);
          } else {
            // Fallback to a default profile
            this._setActiveProfile("Hybrid");
          }
        },
        () => {
          this._setActiveProfile("Hybrid");
        }
      );
    }

    _executeCommandWithRetry(command, onSuccess, onFailure, retryCount = 0) {
      try {
        let proc = Gio.Subprocess.new(
          command,
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok) {
              onSuccess(stdout);
            } else if (retryCount < MAX_RETRIES) {
              this._retryTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                RETRY_DELAY,
                () => {
                  this._executeCommandWithRetry(
                    command,
                    onSuccess,
                    onFailure,
                    retryCount + 1
                  );
                  this._retryTimeoutId = null;
                  return GLib.SOURCE_REMOVE;
                }
              );
            } else {
              onFailure();
            }
          } catch (e) {
            onFailure();
          }
        });
      } catch (e) {
        onFailure();
      }
    }

    _clearRetryTimeout() {
      if (this._retryTimeoutId !== null) {
        GLib.source_remove(this._retryTimeoutId);
        this._retryTimeoutId = null;
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
            this._activateProfile(profile, params.command);
          });
          this._profileItems.set(profile, item);
          this._profileSection.addMenuItem(item);
        }
      }
    }

    _activateProfile(profile, command) {
      if (profile === this._activeProfile) {
        return;
      }

      if (
        (profile === "Vfio" && this._activeProfile === "Hybrid") ||
        (profile === "Hybrid" && this._activeProfile === "Vfio")
      ) {
        Main.notify(
          "GPU Switcher",
          "Direct switching between Vfio and Hybrid profiles is not supported. Please switch to Integrated first."
        );
        return;
      }

      this._executeCommandWithRetry(
        command,
        () => {
          const previousProfile = this._activeProfile;
          this._setActiveProfile(profile);
          if (
            (previousProfile === "Integrated" && profile === "Hybrid") ||
            (previousProfile === "Hybrid" && profile === "Integrated")
          ) {
            Gio.Subprocess.new(
              ["gnome-session-quit", "--logout"],
              Gio.SubprocessFlags.NONE
            );
          }
        },
        () => {
          Main.notify(
            "GPU Switcher",
            `Failed to switch to ${profile} profile. Please try again or check system logs.`
          );
        }
      );
    }

    _setActiveProfile(profile) {
      if (GPU_PROFILE_PARAMS[profile]) {
        this._activeProfile = profile;
        this.notify("active-profile");
        this._sync();
      }
    }

    get activeProfile() {
      return this._activeProfile;
    }

    _sync() {
      const params = GPU_PROFILE_PARAMS[this._activeProfile];
      if (!params) {
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

    destroy() {
      if (this._clickedId) {
        this.disconnect(this._clickedId);
        this._clickedId = null;
      }
      if (this._signalId) {
        this._dbusConnection.signal_unsubscribe(this._signalId);
        this._signalId = null;
      }
      this._clearRetryTimeout();
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      if (this._showPanelIconItemToggledId) {
        this._showPanelIconItem.disconnect(this._showPanelIconItemToggledId);
        this._showPanelIconItemToggledId = null;
      }
      if (this._showPanelIconItem) {
        this._showPanelIconItem.destroy();
        this._showPanelIconItem = null;
      }
      if (this._profileSection) {
        this._profileSection.destroy();
        this._profileSection = null;
      }
      super.destroy();
    }
  }
);

export const Indicator = GObject.registerClass(
  class Indicator extends SystemIndicator {
    _init(path, settings) {
      super._init();

      this._settings = settings;
      this._activeProfileChangedId = null;
      this._settingsChangedId = this._settings.connect(
        `changed::${SHOW_PANEL_ICON_KEY}`,
        this._updateIcon.bind(this)
      );
      this._indicator = this._addIndicator();
      this._indicator.icon_name = "video-display-symbolic"; // Default icon
      this.indicatorIndex = 0;

      // Create the quick settings toggle
      this._toggle = new GpuProfilesToggle(path, settings);
      this.quickSettingsItems.push(this._toggle);

      this._activeProfileChangedId = this._toggle.connect(
        "notify::active-profile",
        this._updateIcon.bind(this)
      );

      // Insert the indicator into quick settings
      this._insertIndicator();
      this._updateIcon();
    }

    _insertIndicator() {
      const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
      if (QuickSettingsMenu && QuickSettingsMenu._indicators) {
        QuickSettingsMenu._indicators.insert_child_at_index(
          this,
          this.indicatorIndex
        );
      }
    }

    _updateIcon() {
      const showPanelIcon = this._settings.get_boolean(SHOW_PANEL_ICON_KEY);
      const activeProfile = this._toggle.activeProfile;

      if (activeProfile && GPU_PROFILE_PARAMS[activeProfile]) {
        const params = GPU_PROFILE_PARAMS[activeProfile];
        this._indicator.icon_name = params.iconName;
      } else {
        this._indicator.icon_name = "video-display-symbolic"; // Default icon
      }

      this._indicator.visible = showPanelIcon;
    }

    destroy() {
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      if (this._activeProfileChangedId) {
        this._toggle.disconnect(this._activeProfileChangedId);
        this._activeProfileChangedId = null;
      }
      if (this._toggle) {
        const toggleIndex = this.quickSettingsItems.indexOf(this._toggle);
        if (toggleIndex !== -1) {
          this.quickSettingsItems.splice(toggleIndex, 1);
        }
        this._toggle.destroy();
        this._toggle = null;
      }
      super.destroy();
    }
  }
);

export default class GpuSwitcherExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._indicator = new Indicator(this.path, this._settings);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    if (this._indicator) {
      const parent = this._indicator.get_parent();
      if (parent) {
        parent.remove_child(this._indicator);
      }
      this._indicator.destroy();
      this._indicator = null;
    }
    this._settings = null;
  }
}

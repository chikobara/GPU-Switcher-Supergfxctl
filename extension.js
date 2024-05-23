/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

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
  integrated: {
    name: "Integrated",
    iconName: "computer-symbolic",
    command: "supergfxctl -m Integrated && gnome-session-quit --logout",
  },
  hybrid: {
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

const LAST_PROFILE_KEY = "last-selected-gpu-profile";

const GpuProfilesToggle = GObject.registerClass(
  class GpuProfilesToggle extends QuickMenuToggle {
    _init() {
      super._init({ title: "GPU Mode" });

      this._profileItems = new Map();

      this.connect("clicked", () => {
        this._sync();
      });

      this._profileSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._profileSection);
      this.menu.setHeader("graphics-card-symbolic", "GPU Mode");
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._addProfileToggles();
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
      log(`Setting active profile: ${profile}`);
      this._settings.set_string(LAST_PROFILE_KEY, profile);
      this._sync();
    }

    _sync() {
      const activeProfile =
        this._settings.get_string(LAST_PROFILE_KEY) || "Integrated";
      log(`Synchronizing profile: ${activeProfile}`);

      for (const [profile, item] of this._profileItems) {
        item.setOrnament(
          profile === activeProfile
            ? PopupMenu.Ornament.CHECK
            : PopupMenu.Ornament.NONE
        );
      }

      const params =
        GPU_PROFILE_PARAMS[activeProfile] || GPU_PROFILE_PARAMS.Integrated;
      this.set({ subtitle: params.name, iconName: params.iconName });

      this.checked = activeProfile !== "Integrated";
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
    this._settings = new Gio.Settings({
      schema: "org.gnome.shell.extensions.gpu-switcher",
    });

    this._indicator = new Indicator();
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
  }
}

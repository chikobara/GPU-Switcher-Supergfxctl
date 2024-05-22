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
import GObject from "gi://GObject";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import {
  QuickToggle,
  SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as Util from "resource:///org/gnome/shell/misc/util.js";

const IntegratedToggle = GObject.registerClass(
  class IntegratedToggle extends QuickToggle {
    constructor() {
      super({
        title: _("Integrated"),
        iconName: "computer-symbolic",
        toggleMode: false,
      });
      this.connect("clicked", () => {
        Util.spawnCommandLine("supergfxctl -m Integrated");
      });
    }
  }
);

const HybridToggle = GObject.registerClass(
  class HybridToggle extends QuickToggle {
    constructor() {
      super({
        title: _("Hybrid"),
        iconName: "processor-symbolic",
        toggleMode: false,
      });
      this.connect("clicked", () => {
        Util.spawnCommandLine("supergfxctl -m Hybrid");
      });
    }
  }
);
/* 
const DedicatedToggle = GObject.registerClass(
  class DedicatedToggle extends QuickToggle {
    constructor() {
      super({
        title: _("Dedicated"),
        iconName: "graphics-card-symbolic",
        toggleMode: false,
      });
      this.connect("clicked", () => {
        Util.spawnCommandLine("supergfxctl -m dedicated");
      });
    }
  }
); */

const GfxctlIndicator = GObject.registerClass(
  class GfxctlIndicator extends SystemIndicator {
    constructor() {
      super();

      this._indicator = this._addIndicator();
      this._indicator.iconName = "graphics-card-symbolic";

      const integratedToggle = new IntegratedToggle();
      const hybridToggle = new HybridToggle();
      // const dedicatedToggle = new DedicatedToggle();

      this.quickSettingsItems.push(integratedToggle);
      this.quickSettingsItems.push(hybridToggle);
      // this.quickSettingsItems.push(dedicatedToggle);
    }
  }
);

export default class GfxctlExtension extends Extension {
  enable() {
    this._indicator = new GfxctlIndicator();
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.quickSettingsItems.forEach((item) => item.destroy());
    this._indicator.destroy();
  }
}

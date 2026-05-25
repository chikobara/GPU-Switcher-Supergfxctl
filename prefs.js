import Adw from "gi://Adw";
import Gio from "gi://Gio";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const SHOW_PANEL_ICON_KEY = "show-panel-icon";

export default class GpuSwitcherPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: "GPU Switcher",
      iconName: "video-display-symbolic",
    });

    const group = new Adw.PreferencesGroup({
      title: "Panel",
    });

    const showPanelIconRow = new Adw.SwitchRow({
      title: "Show Panel Icon",
      subtitle: "Show the current GPU mode icon in the GNOME top bar.",
    });

    window._settings.bind(
      SHOW_PANEL_ICON_KEY,
      showPanelIconRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );

    group.add(showPanelIconRow);
    page.add(group);
    window.add(page);
  }
}

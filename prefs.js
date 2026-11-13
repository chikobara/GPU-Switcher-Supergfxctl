import Adw from "gi://Adw";
import Gio from "gi://Gio";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const SHOW_PANEL_ICON_KEY = "show-panel-icon";

export default class GpuSwitcherPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _("GPU Switcher"),
      iconName: "video-display-symbolic",
    });

    const group = new Adw.PreferencesGroup({
      title: _("Panel"),
    });

    const showPanelIconRow = new Adw.SwitchRow({
      title: _("Show Panel Icon"),
      subtitle: _("Show the current GPU mode icon in the GNOME top bar."),
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

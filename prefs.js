const { Gio, GLib, GObject, Gtk, Gdk, GdkPixbuf } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = (e) => e;

const WORKSPACE_COUNT_KEY = 'workspace-count';
const WORKSPACE_INDEX = 'workspace-index';
const WALLPAPERS_KEY = 'workspace-wallpapers';
const CURRENT_WALLPAPER_KEY = 'picture-uri';

class WalkpaperModel extends Gtk.ListStore {
  Columns = {
    NUMBER: 0,
    PATH: 1,
  };

  Thumbnails = [];

  constructor(params) {
    super(params);
    this.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    this._settings = ExtensionUtils.getSettings();

    const workspaceNum = this._settings.get_int(WORKSPACE_COUNT_KEY);
    this.Thumbnails = Array(workspaceNum).fill(null);

    this._reloadFromSettings();

    this.connect('row-changed', this._onRowChanged.bind(this));
  }

  _reloadFromSettings() {
    if (this._preventChanges) return;
    this._preventChanges = true;

    const workspaceNum = this._settings.get_int(WORKSPACE_COUNT_KEY);
    const newPaths = this._settings.get_strv(WALLPAPERS_KEY);

    for (let i = newPaths.length; i < workspaceNum; i++) {
      newPaths[i] = '';
    }

    let i = 0;
    let [ok, iter] = this.get_iter_first();
    while (ok && i < workspaceNum) {
      this.set(iter, [this.Columns.PATH], [newPaths[i]]);
      this.set(iter, [this.Columns.NUMBER], [parseInt(i + 1)]);
      [ok, iter] = this.iter_next(iter);
      i++;
    }

    while (ok) ok = this.remove(iter);

    // Adding new rows
    for (; i < workspaceNum; i++) {
      iter = this.append();
      this.set(iter, [this.Columns.PATH], [newPaths[i]]);
      this.set(iter, [this.Columns.NUMBER], [parseInt(i + 1)]);
    }

    this._preventChanges = false;
  }

  _onRowChanged(self, path, iter) {
    if (this._preventChanges) return;
    this._preventChanges = true;

    const index = path.get_indices()[0];
    const paths = this._settings.get_strv(WALLPAPERS_KEY);

    if (index >= paths.length) {
      // fill with blanks
      for (let i = paths.length; i <= index; i++) {
        paths[i] = '';
      }
    }

    paths[index] = this.get_value(iter, this.Columns.PATH);

    this._settings.set_strv(WALLPAPERS_KEY, paths);

    this._preventChanges = false;
  }
}

class WalkpaperSettingsWidget extends Gtk.Box {
  constructor(params) {
    super(params);
    this.margin = 12;
    this.orientation = Gtk.Orientation.VERTICAL;
    this.connect('change-wallpaper', this.changeWallpaper);

    const scrolled = new Gtk.ScrolledWindow();
    scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

    this.append(scrolled);

    const store = new WalkpaperModel();

    const treeView = new Gtk.TreeView({
      model: store,
      headers_visible: true,
      reorderable: true,
      hexpand: true,
      vexpand: true,
    });

    const columnNumbers = new Gtk.TreeViewColumn({ title: _("Workspace") });
    const rendererNumbers = new Gtk.CellRendererText({ editable: false });
    columnNumbers.pack_start(rendererNumbers, true);
    columnNumbers.add_attribute(rendererNumbers, 'text', store.Columns.NUMBER);
    treeView.append_column(columnNumbers);

    const columnImages = new Gtk.TreeViewColumn({ title: "Preview" });
    const rendererImages = new Gtk.CellRendererPixbuf();
    rendererImages.set_fixed_size(240, 120);
    columnImages.pack_start(rendererImages, true);
    columnImages.set_cell_data_func(rendererImages, this.getCellPreviewPixbuf.bind(this));
    treeView.append_column(columnImages);

    const columnPaths = new Gtk.TreeViewColumn({ title: _("Path to wallpaper") });
    const rendererPaths = new Gtk.CellRendererText({ editable: false });
    columnPaths.pack_start(rendererPaths, true);
    columnPaths.add_attribute(rendererPaths, 'text', store.Columns.PATH);
    treeView.append_column(columnPaths);

    treeView.connect('row-activated', this._editPath.bind(this));

    scrolled.set_child(treeView);
  }

  _editPath(renderer, path) {
    const chooser = new Gtk.FileChooserDialog({
      action: Gtk.FileChooserAction.OPEN,
      select_multiple: false,
      transient_for: renderer.get_ancestor(Gtk.Window),
      title: 'Select Wallpaper',
    });

    const filter = new Gtk.FileFilter();
    filter.set_name("Wallpapers");
    filter.add_pattern("*.png");
    filter.add_pattern("*.jpg");
    filter.add_pattern("*.jpeg");
    filter.add_pattern("*.tga");
    chooser.add_filter(filter);

    chooser.add_button('Cancel', Gtk.ResponseType.CANCEL);
    chooser.add_button('OK', Gtk.ResponseType.OK);

    chooser.connect('response', this._onEditPath.bind(this, path, renderer));

    chooser.show();
  }

  _onEditPath(path, parent, source, result) {
    if (result === Gtk.ResponseType.OK) {
      const file = source.get_file();
      const filename = "file://" + file.get_path();
      file.unref();

      const store = new WalkpaperModel();
      const [ok, iter] = store.get_iter(path);
      if (ok) {
        store.set(iter, [store.Columns.PATH], [filename]);
        const _settings = ExtensionUtils.getSettings();
        const index = _settings.get_int(WORKSPACE_INDEX);
        if (store.get_string_from_iter(iter) == '' + index) {
          parent.get_ancestor(WalkpaperSettingsWidget).emit('change-wallpaper', filename);
        }
        const thumbIndex = parseInt(store.get_string_from_iter(iter)) + 1;
        if (!store.Thumbnails[thumbIndex]) {
          store.Thumbnails[thumbIndex] = GdkPixbuf.Pixbuf.new_from_file_at_scale(
            filename.replace(/file:\/\//, ''),
            240,
            160,
            true
          );
        }
      }
    }

    source.destroy();
  }

  changeWallpaper(source, wallpaper) {
    const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
    const backgroundSettings = new Gio.Settings({ schema_id: BACKGROUND_SCHEMA });
    backgroundSettings.set_string(CURRENT_WALLPAPER_KEY, wallpaper);
  }

  getCellPreviewPixbuf(col, cell, model, iter) {
    const index = model.get_value(iter, [model.Columns.NUMBER]);

    if (!model.Thumbnails[index]) {
      const path = model.get_value(iter, [model.Columns.PATH]).replace(/file:\/\//, '');
      if (path !== '') {
        model.Thumbnails[index] = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 240, 160, true);
      }
    }

    if (model.Thumbnails[index]) {
      cell.set_property('pixbuf', model.Thumbnails[index]);
    }
  }
}

function init() {
  ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
  const widget = new WalkpaperSettingsWidget();
  widget.show();
  return widget;
}


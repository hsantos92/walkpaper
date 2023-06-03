SHELL := /bin/bash

JS_FILES := extension.js prefs.js
SCHEMA_FILES := org.gnome.shell.extensions.walkpaper.gschema.xml

.PHONY: clean all schemas

all: walkpaper.zip

schemas: $(SCHEMA_FILES)
	mkdir -p schemas
	glib-compile-schemas --strict --targetdir=./schemas/ .

walkpaper.zip: schemas $(JS_FILES)
	zip -r walkpaper.zip $(JS_FILES) metadata.json schemas

clean:
	rm -rf walkpaper.zip schemas

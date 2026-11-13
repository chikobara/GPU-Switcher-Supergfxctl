# --- Configuració (llegida de metadata.json) ---
UUID    := $(shell jq -r '.uuid' metadata.json)
DOMAIN  := $(shell jq -r '.["gettext-domain"]' metadata.json)
NAME    := $(shell jq -r '.name' metadata.json)
POT     := po/$(DOMAIN).pot
PO      := $(wildcard po/*.po)
SOURCES := extension.js prefs.js

.PHONY: all pot update-po compile pack clean

all: compile

# Regenera la plantilla .pot a partir del codi
pot:
	xgettext --from-code=UTF-8 --keyword=_ --keyword=N_ --add-location=file \
		--package-name="$(NAME)" -o $(POT) $(SOURCES)

# Fusiona els canvis del .pot dins de cada .po existent
update-po: pot
	@for f in $(PO); do \
		echo "== msgmerge $$f"; \
		msgmerge --update --backup=none $$f $(POT); \
	done

# Compila els .po a .mo (per provar en local)
compile: $(PO:.po=.mo)

%.mo: %.po
	msgfmt --check -o $@ $<

# Empaqueta l'extensió; --podir compila els .po dins de locale/
pack:
	gnome-extensions pack --podir=po --extra-source=ico --force .

clean:
	rm -f po/*.mo

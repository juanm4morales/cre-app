#!/bin/sh
set -eu

command -v runuser >/dev/null
id www-data >/dev/null
groupadd --system creapp
useradd --system --gid creapp --groups www-data --home-dir /nonexistent \
  --no-create-home --shell /usr/sbin/nologin creapp
groupadd --system creapp-build
useradd --system --gid creapp-build --groups www-data \
  --home-dir /var/lib/creapp-build --create-home --shell /usr/sbin/nologin creapp-build

SHA_APROBADO=proof123
RELEASE_ROOT=/srv/creapp/releases
RELEASE="$RELEASE_ROOT/$SHA_APROBADO"
install -d -o root -g www-data -m 0750 /srv/creapp
install -d -o root -g www-data -m 0750 "$RELEASE_ROOT"
test ! -e "$RELEASE" && test ! -L "$RELEASE"
install -d -o creapp-build -g www-data -m 0750 "$RELEASE"
runuser -u creapp-build -- sh -c '
  set -eu
  release=$1
  mkdir -p "$release/backend" "$release/.venv/bin"
  printf "%s\n" "print(\"permission proof\")" > "$release/backend/manage.py"
  printf "%s\n" "#!/bin/sh" "exit 0" > "$release/.venv/bin/python"
  chmod 0640 "$release/backend/manage.py"
  chmod 0750 "$release/.venv/bin/python"
  test -w "$release/backend/manage.py"
' sh "$RELEASE"
printf '%s\n' 'PASS: build identity writes prepared release before finalization'

chown -R root:www-data "$RELEASE"
find "$RELEASE" -type d -exec chmod 0750 {} +
find "$RELEASE" -type f -exec chmod u=rwX,g=rX,o= {} +
install -d -o creapp -g www-data -m 2750 "$RELEASE/backend/staticfiles"
install -d -o root -g creapp -m 0750 /etc/creapp
install -o root -g creapp -m 0640 /dev/null /etc/creapp/creapp.env
printf '%s\n' 'DEBUG=False' >> /etc/creapp/creapp.env

# All service-visible parent directories must permit traversal.
runuser -u creapp -- test -x /srv
runuser -u creapp -- test -x /srv/creapp
runuser -u creapp -- test -x "$RELEASE_ROOT"
runuser -u creapp -- test -x "$RELEASE"
runuser -u www-data -- test -x /srv
runuser -u www-data -- test -x /srv/creapp
runuser -u www-data -- test -x "$RELEASE_ROOT"
runuser -u www-data -- test -x "$RELEASE"
printf '%s\n' 'PASS: service and www-data can traverse release parents'

runuser -u creapp -- test -r "$RELEASE/backend/manage.py"
runuser -u creapp -- test -x "$RELEASE/.venv/bin/python"
runuser -u creapp -- test ! -w "$RELEASE/backend/manage.py"
runuser -u creapp -- test ! -w "$RELEASE/backend"
runuser -u creapp -- test ! -w "$RELEASE/.venv"
runuser -u creapp -- "$RELEASE/.venv/bin/python"
if runuser -u creapp-build -- test -w "$RELEASE/backend/manage.py"; then
  printf '%s\n' 'FAIL: build identity still writes finalized release' >&2
  exit 1
fi
printf '%s\n' 'PASS: service reads/executes finalized source but cannot write code or venv'

runuser -u creapp -- test -r /etc/creapp/creapp.env
if runuser -u www-data -- test -r /etc/creapp/creapp.env; then
  printf '%s\n' 'FAIL: www-data can read service environment' >&2
  exit 1
fi
printf '%s\n' 'PASS: service reads env; www-data cannot read env'

runuser -u creapp -- test -w "$RELEASE/backend/staticfiles"
runuser -u creapp -- sh -c 'printf "%s\n" static > "$1/proof.txt"' sh "$RELEASE/backend/staticfiles"
runuser -u www-data -- test -r "$RELEASE/backend/staticfiles/proof.txt"
runuser -u www-data -- test -x "$RELEASE/backend/staticfiles"
printf '%s\n' 'PASS: service writes STATIC_ROOT; www-data reads static output'

test -f "$RELEASE/backend/manage.py"
test -f "$RELEASE/backend/staticfiles/proof.txt"
test ! -e /srv/creapp/current && test ! -L /srv/creapp/current
ln -s "$RELEASE" /srv/creapp/current.next
mv -Tf /srv/creapp/current.next /srv/creapp/current
test "$(readlink -f /srv/creapp/current)" = "$RELEASE"
runuser -u creapp -- test -r /srv/creapp/current/backend/manage.py
printf '%s\n' 'PASS: current is published atomically only after release checks'

printf '%s\n' 'PASS: container permission proof completed'

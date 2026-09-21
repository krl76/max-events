#!/usr/bin/env bash
# Launch deploy.sh in a detached session so a dropped CI SSH connection
# does not kill the build. Writes /tmp/max-events-deploy.log and
# /tmp/max-events-deploy.done (exit code).
cd /opt/max-events || exit 1
rm -f /tmp/max-events-deploy.done /tmp/max-events-deploy.log
setsid bash -c 'bash /opt/max-events/deploy/deploy.sh > /tmp/max-events-deploy.log 2>&1; echo $? > /tmp/max-events-deploy.done' < /dev/null > /dev/null 2>&1 &
echo "deploy launched (detached)"

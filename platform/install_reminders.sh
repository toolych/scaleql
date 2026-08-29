#!/bin/zsh
# Ставит ежечасную проверку напоминаний ScaleQL в launchd.
set -e
BASE="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.scaleql.reminder.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.scaleql.reminder</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BASE/.venv/bin/python</string>
    <string>$BASE/platform/bot.py</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$BASE/platform/reminder.log</string>
  <key>StandardErrorPath</key><string>$BASE/platform/reminder.log</string>
</dict>
</plist>
EOF
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Напоминания включены. Проверка раз в час, отправка в заданный час."

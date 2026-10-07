# PreToolUse guard for Edit/Write/MultiEdit.
# Blocks source-code edits that introduce patterns docs/specs/04-security-privacy.md
# and .claude/rules/security-privacy.md declare non-negotiable:
#   - chrome.storage.sync (privacy: local-only storage guarantee)
#   - eval() / new Function() (MV3 CSP + "no script execution from content, ever")
# No-ops instantly (exit 0) on anything that isn't a .ts/.tsx/.js/.jsx write, so it
# costs nothing on docs-only sessions or before src/ exists.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$toolName = $data.tool_name
if ($toolName -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }

$filePath = $data.tool_input.file_path
if (-not $filePath) { exit 0 }
if ($filePath -notmatch '\.(ts|tsx|js|jsx)$') { exit 0 }

$content = ''
switch ($toolName) {
    'Write' { $content = [string]$data.tool_input.content }
    'Edit' { $content = [string]$data.tool_input.new_string }
    'MultiEdit' {
        $parts = @($data.tool_input.edits | ForEach-Object { [string]$_.new_string })
        $content = $parts -join "`n"
    }
}
if (-not $content) { exit 0 }

$rules = @(
    @{ Pattern = 'chrome\.storage\.sync'; Reason = 'chrome.storage.sync is forbidden - docs/specs/04-security-privacy.md #1 requires chrome.storage.local only, via src/storage/.' },
    @{ Pattern = '(?<![\w.])eval\s*\('; Reason = 'eval() is forbidden - MV3 CSP and docs/specs/04-security-privacy.md #3 (no script execution from any code path).' },
    @{ Pattern = 'new\s+Function\s*\('; Reason = 'new Function() is forbidden - MV3 CSP and docs/specs/04-security-privacy.md #3 (no dynamic code execution).' }
)

foreach ($rule in $rules) {
    if ($content -match $rule.Pattern) {
        [Console]::Error.WriteLine("BLOCKED by .claude/rules/security-privacy.md: $($rule.Reason)")
        [Console]::Error.WriteLine("File: $filePath")
        exit 2
    }
}

exit 0

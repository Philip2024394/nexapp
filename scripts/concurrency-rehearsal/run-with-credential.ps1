#Requires -Version 5
<#
.SYNOPSIS
  Reads the PG17 password from Windows Credential Manager, builds the
  NEX_REHEARSAL_PG_URL in process memory, and invokes the Node orchestrator.

.DESCRIPTION
  Owner-authorised 2026-11-07. Credential-Manager-first unblock for the
  migration 281 local rehearsal.

  Prerequisite (run once in a regular PowerShell window):
    $c = Get-Credential -UserName postgres -Message "Enter your local PG17 postgres-superuser password"
    cmdkey /generic:NEX_REHEARSAL_PG17 /user:postgres /pass:$($c.GetNetworkCredential().Password)

  This script then:
    1. Reads the credential named NEX_REHEARSAL_PG17 from Windows Credential Manager
    2. Builds postgresql://postgres:<password>@127.0.0.1:5433/postgres (in memory)
    3. Sets it as a process env var and invokes node run-rehearsal.mjs
    4. The env var lives only in the child process · never touches disk, never echoed
    5. On exit, the env var is discarded with the process · nothing persists

  Cleanup (run once when the rehearsal is done, in a regular PowerShell window):
    cmdkey /delete:NEX_REHEARSAL_PG17
#>

$ErrorActionPreference = "Stop"

# ─── P/Invoke the CredRead API · no external PowerShell modules required ─────
$signature = @"
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public static class NexCredRead {
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr CredentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool CredFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    // Returns the credential's password as a managed string, or null on failure.
    public static string ReadGeneric(string target) {
        IntPtr ptr = IntPtr.Zero;
        try {
            if (!CredRead(target, 1u /* GENERIC */, 0, out ptr)) return null;
            var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            if (c.CredentialBlobSize == 0 || c.CredentialBlob == IntPtr.Zero) return "";
            byte[] bytes = new byte[c.CredentialBlobSize];
            Marshal.Copy(c.CredentialBlob, bytes, 0, (int)c.CredentialBlobSize);
            // CredRead stores the blob as UTF-16 LE
            return System.Text.Encoding.Unicode.GetString(bytes);
        } finally {
            if (ptr != IntPtr.Zero) CredFree(ptr);
        }
    }
}
"@
Add-Type -TypeDefinition $signature -ErrorAction Stop

$target = "NEX_REHEARSAL_PG17"
Write-Host "--- Reading credential '$target' from Windows Credential Manager ---"
$password = [NexCredRead]::ReadGeneric($target)
if ([string]::IsNullOrEmpty($password)) {
  Write-Error @"
Credential '$target' not found or empty.

To store it, run ONCE in a regular PowerShell window (not Claude Code):

    `$c = Get-Credential -UserName postgres -Message "Enter your local PG17 password"
    cmdkey /generic:$target /user:postgres /pass:`$(`$c.GetNetworkCredential().Password)

The Get-Credential dialog prompts securely (password never visible in your shell).
Then re-run this script.
"@
  exit 2
}
Write-Host "Credential read OK · length = $($password.Length) chars (password masked)"

# ─── Build URL in memory (never printed, never written to disk) ─────────────
$url = "postgresql://postgres:$password@127.0.0.1:5433/postgres"
# Defence: refuse if the URL somehow doesn't target 127.0.0.1:5433
if ($url -notmatch "@127\.0\.0\.1:5433/") {
  Write-Error "Built URL does not target 127.0.0.1:5433 · aborting"
  exit 3
}

# ─── Invoke the Node orchestrator with env var scoped to child process ──────
$env:NEX_REHEARSAL_PG_URL = $url
Write-Host "--- Invoking rehearsal orchestrator ---"
try {
  Push-Location (Join-Path $PSScriptRoot "..\..")
  node scripts/concurrency-rehearsal/run-rehearsal.mjs
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
  # Scrub from env · defence in depth even though the process is about to exit
  Remove-Item Env:NEX_REHEARSAL_PG_URL -ErrorAction SilentlyContinue
  $url = $null
  $password = $null
  [System.GC]::Collect()
}

Write-Host ""
Write-Host "--- Exit code: $exitCode ---"
exit $exitCode

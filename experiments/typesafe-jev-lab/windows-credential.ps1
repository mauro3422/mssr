$script:TypeSafeCredentialTarget = "TypeSafe:MSSR:JevLab"

if (-not ("WinCred" -as [type])) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinCred {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName;
    public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob;
    public UInt32 Persist; public UInt32 AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern void CredFree(IntPtr buffer);
}
"@
}
function Set-TypeSafeCredential {
  param([Parameter(Mandatory=$true)][Security.SecureString]$Secret)
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  $plain = $null; $blob = [IntPtr]::Zero; $bytes = $null
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $bytes = [Text.Encoding]::Unicode.GetBytes($plain)
    $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $cred = New-Object WinCred+CREDENTIAL
    $cred.Type = 1
    $cred.TargetName = $script:TypeSafeCredentialTarget
    $cred.CredentialBlobSize = $bytes.Length
    $cred.CredentialBlob = $blob
    $cred.Persist = 2
    $cred.UserName = "TYPESAFE_API_KEY"
    if (-not [WinCred]::CredWrite([ref]$cred, 0)) {
      throw "CredWrite failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
  } finally {
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($blob -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($blob) }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $plain = $null
  }
}
function Get-TypeSafeCredential {
  $ptr = [IntPtr]::Zero
  if (-not [WinCred]::CredRead($script:TypeSafeCredentialTarget, 1, 0, [ref]$ptr)) {
    return $null
  }
  try {
    $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][WinCred+CREDENTIAL])
    if ($cred.CredentialBlobSize -eq 0) { return "" }
    return [Runtime.InteropServices.Marshal]::PtrToStringUni(
      $cred.CredentialBlob,
      [int]($cred.CredentialBlobSize / 2)
    )
  } finally {
    [WinCred]::CredFree($ptr)
  }
}

function Test-TypeSafeCredential {
  return $null -ne (Get-TypeSafeCredential)
}

$Source = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class ProcessEnvReader {
    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(IntPtr processHandle, int processInformationClass, ref PROCESS_BASIC_INFORMATION processInformation, int processInformationLength, ref int returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, [Out] byte[] lpBuffer, int dwSize, out IntPtr lpNumberOfBytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr hObject);

    private const int PROCESS_QUERY_INFORMATION = 0x0400;
    private const int PROCESS_VM_READ = 0x0010;

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION {
        public IntPtr ExitStatus;
        public IntPtr PebBaseAddress;
        public IntPtr AffinityMask;
        public IntPtr BasePriority;
        public IntPtr UniqueProcessId;
        public IntPtr InheritedFromUniqueProcessId;
    }

    public static Dictionary<string, string> GetEnvironmentVariables(int processId, ref string debugMsg) {
        var envs = new Dictionary<string, string>();
        debugMsg = "OK";
        IntPtr hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, processId);
        if (hProcess == IntPtr.Zero) {
            debugMsg = "OpenProcess failed: " + Marshal.GetLastWin32Error();
            return envs;
        }

        try {
            PROCESS_BASIC_INFORMATION pbi = new PROCESS_BASIC_INFORMATION();
            int returnLength = 0;
            int status = NtQueryInformationProcess(hProcess, 0, ref pbi, Marshal.SizeOf(pbi), ref returnLength);
            if (status != 0) {
                debugMsg = "NtQueryInformationProcess failed: " + status;
                return envs;
            }

            byte[] peb = new byte[64];
            IntPtr bytesRead;
            if (!ReadProcessMemory(hProcess, pbi.PebBaseAddress, peb, peb.Length, out bytesRead)) {
                debugMsg = "ReadProcessMemory PEB failed: " + Marshal.GetLastWin32Error();
                return envs;
            }

            IntPtr processParametersPtr = new IntPtr(BitConverter.ToInt64(peb, 0x20));

            byte[] procParams = new byte[256];
            if (!ReadProcessMemory(hProcess, processParametersPtr, procParams, procParams.Length, out bytesRead)) {
                debugMsg = "ReadProcessMemory ProcParams failed: " + Marshal.GetLastWin32Error();
                return envs;
            }

            IntPtr envPtr = new IntPtr(BitConverter.ToInt64(procParams, 0x80));

            List<byte> envBytes = new List<byte>();
            byte[] buffer = new byte[4096];
            IntPtr currentAddr = envPtr;
            bool foundEnd = false;

            while (!foundEnd && envBytes.Count < 1024 * 1024) {
                if (!ReadProcessMemory(hProcess, currentAddr, buffer, buffer.Length, out bytesRead)) break;
                int read = bytesRead.ToInt32();
                if (read <= 0) break;

                for (int i = 0; i < read; i += 2) {
                    if (i + 1 < read) {
                        if (buffer[i] == 0 && buffer[i+1] == 0) {
                            envBytes.AddRange(new byte[] { buffer[i], buffer[i+1] });
                            foundEnd = true;
                            break;
                        }
                    }
                    envBytes.Add(buffer[i]);
                    envBytes.Add(buffer[i+1]);
                }
                currentAddr = IntPtr.Add(currentAddr, read);
            }

            string envStr = Encoding.Unicode.GetString(envBytes.ToArray());
            string[] parts = envStr.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts) {
                int idx = part.IndexOf('=');
                if (idx > 0) {
                    string name = part.Substring(0, idx);
                    string val = part.Substring(idx + 1);
                    envs[name] = val;
                }
            }
        } catch (Exception ex) {
            debugMsg = "Exception: " + ex.Message;
        } finally {
            CloseHandle(hProcess);
        }
        return envs;
    }
}
"@

Add-Type -TypeDefinition $Source -ErrorAction SilentlyContinue

Get-Process -Name node | ForEach-Object {
    $pidVal = $_.Id
    $debug = ""
    $envVars = [ProcessEnvReader]::GetEnvironmentVariables($pidVal, [ref]$debug)
    Write-Output "PID: $pidVal | Debug: $debug | Keys: $($envVars.Count)"
    if ($envVars.Count -gt 0) {
        foreach ($k in $envVars.Keys) {
            if ($k -like "*SUPABASE*" -or $k -like "*VITE_SUPABASE*") {
                Write-Output "  $k = $($envVars[$k])"
            }
        }
    }
}

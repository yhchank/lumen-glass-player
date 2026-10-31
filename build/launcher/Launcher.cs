using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("流光 Lumen")]
[assembly: System.Reflection.AssemblyDescription("Lumen 液态玻璃音乐播放器")]
[assembly: System.Reflection.AssemblyProduct("Lumen")]
[assembly: System.Reflection.AssemblyCompany("Lumen")]
[assembly: System.Reflection.AssemblyVersion("1.1.3.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.1.3.0")]

internal static class LumenLauncher
{
    private static string logPath;
    private static bool debugEnabled;

    [STAThread]
    private static void Main(string[] args)
    {
        string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
        logPath = Path.Combine(baseDirectory, "launcher.log");
        debugEnabled = string.Equals(
            Environment.GetEnvironmentVariable("LUMEN_DEBUG"),
            "1",
            StringComparison.Ordinal
        );
        Log("start args=" + string.Join(" | ", args));
        string displayName = "流光 Lumen";

        try
        {
            string productName = Path.GetFileNameWithoutExtension(
                Environment.GetCommandLineArgs()[0]
            );
            if (string.IsNullOrWhiteSpace(productName))
            {
                productName = "Lumen";
            }

            displayName = "流光 " + productName;
            string corePath = Path.Combine(baseDirectory, productName + "Core.exe");
            Log("core=" + corePath + " exists=" + File.Exists(corePath));

            if (!File.Exists(corePath))
            {
                string fallbackCore = Path.Combine(baseDirectory, "LumenCore.exe");
                if (File.Exists(fallbackCore))
                {
                    corePath = fallbackCore;
                    productName = "Lumen";
                    displayName = "流光 Lumen";
                }
            }

            if (!File.Exists(corePath))
            {
                Log("core missing");
                MessageBox.Show(
                    "找不到 " + productName + "Core.exe。请完整解压或重新安装" + displayName + "。",
                    displayName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string profilePath = ResolveProfilePath(baseDirectory, productName);
            Log("profile=" + profilePath);

            bool userDataProvided = false;
            foreach (string argument in args)
            {
                if (argument.StartsWith("--user-data-dir=", StringComparison.OrdinalIgnoreCase))
                {
                    userDataProvided = true;
                    break;
                }
            }

            StringBuilder commandLine = new StringBuilder();
            bool useSandbox = string.Equals(
                Environment.GetEnvironmentVariable("LUMEN_ENABLE_SANDBOX"),
                "1",
                StringComparison.Ordinal
            );

            if (!useSandbox)
            {
                commandLine.Append("--no-sandbox ");
            }

            if (!userDataProvided)
            {
                commandLine.Append("--user-data-dir=");
                commandLine.Append(Quote(profilePath));
                commandLine.Append(' ');
            }

            foreach (string argument in args)
            {
                commandLine.Append(Quote(argument));
                commandLine.Append(' ');
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = corePath,
                Arguments = commandLine.ToString(),
                WorkingDirectory = baseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };

            startInfo.EnvironmentVariables["LUMEN_USER_DATA_DIR"] = profilePath;
            startInfo.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");

            Log("starting " + corePath + " " + commandLine);
            Process process = Process.Start(startInfo);
            Log("started pid=" + (process == null ? "null" : process.Id.ToString()));
        }
        catch (Exception error)
        {
            Log("ERROR " + error);
            MessageBox.Show(
                "无法启动" + displayName + "。\n\n" + error.Message,
                displayName,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private static string ResolveProfilePath(string baseDirectory, string productName)
    {
        string portableRoot = Environment.GetEnvironmentVariable("PORTABLE_EXECUTABLE_DIR");
        string portableDataName = productName.Replace(" ", "") + "Data";
        string[] candidates;

        if (!string.IsNullOrEmpty(portableRoot))
        {
            candidates = new[]
            {
                Path.Combine(portableRoot, portableDataName),
                Path.Combine(baseDirectory, portableDataName),
                Path.Combine(Path.GetTempPath(), productName),
            };
        }
        else
        {
            candidates = new[]
            {
                Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    productName
                ),
                Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    productName
                ),
                Path.Combine(baseDirectory, portableDataName),
                Path.Combine(Path.GetTempPath(), productName),
            };
        }

        foreach (string candidate in candidates)
        {
            if (TryPrepareDirectory(candidate))
            {
                return candidate;
            }
        }

        throw new IOException("找不到可写入的用户数据目录。");
    }

    private static bool TryPrepareDirectory(string candidate)
    {
        try
        {
            Directory.CreateDirectory(candidate);
            string probe = Path.Combine(candidate, ".write-test");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void Log(string message)
    {
        try
        {
            if (!debugEnabled || string.IsNullOrEmpty(logPath)) return;
            File.AppendAllText(
                logPath,
                DateTime.Now.ToString("o") + " " + message + Environment.NewLine
            );
        }
        catch
        {
            // Logging is only for diagnostics.
        }
    }

    private static string Quote(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }

        StringBuilder result = new StringBuilder();
        result.Append('"');
        int backslashes = 0;

        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashes++;
                continue;
            }

            if (character == '"')
            {
                result.Append('\\', backslashes * 2 + 1);
                result.Append('"');
                backslashes = 0;
                continue;
            }

            if (backslashes > 0)
            {
                result.Append('\\', backslashes);
                backslashes = 0;
            }

            result.Append(character);
        }

        if (backslashes > 0)
        {
            result.Append('\\', backslashes * 2);
        }

        result.Append('"');
        return result.ToString();
    }
}

/* RPGAtlas engine launcher. GPL-3.0-or-later (see LICENSE).

   Double-clicking RPGAtlas.exe boots the Vite dev server for the engine
   folder and opens the editor in the default browser.

   Since the Phase 1 module build, index.html loads the editor runtime as
   <script type="module" src="/src/editor/main.ts"> — raw TypeScript that only
   Vite can transpile and serve. A plain static file server (what this
   launcher used to be) hands the browser an unexecutable .ts file and the
   editor never boots, so the launcher now requires Node.js plus an installed
   node_modules (npm install) and delegates serving to Vite. */
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

internal static class RPGAtlasEngine
{
    private const int FirstPort = 8080;
    private const int LastPort = 8099;

    private static int Main(string[] args)
    {
        Console.Title = "RPGAtlas";
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        bool openBrowser = Array.IndexOf(args, "--no-browser") < 0;

        if (!File.Exists(Path.Combine(root, "index.html")))
        {
            return Fail(
                "RPGAtlas could not find index.html next to this program.",
                "Keep RPGAtlas.exe inside the RPGAtlas folder, then run it again.");
        }

        string viteScript = Path.Combine(root, "node_modules", "vite", "bin", "vite.js");
        if (!File.Exists(viteScript))
        {
            return Fail(
                "RPGAtlas could not find the Vite dev server (node_modules\\vite).",
                "Open a terminal in the RPGAtlas folder and run:  npm install");
        }

        int port = FindFreePort();
        if (port == 0)
        {
            return Fail(
                "RPGAtlas could not find a free local port (" + FirstPort + "-" + LastPort + ").",
                "Close any other copy of RPGAtlas that may already be running, then try again.");
        }

        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = "node";
        startInfo.Arguments = "\"" + viteScript + "\" --port " + port + " --strictPort";
        startInfo.WorkingDirectory = root;
        startInfo.UseShellExecute = false;

        Process vite;
        try
        {
            vite = Process.Start(startInfo);
        }
        catch (Exception)
        {
            return Fail(
                "RPGAtlas could not start Node.js (is it installed and on PATH?).",
                "Install Node.js 18 or newer from https://nodejs.org/ and try again.");
        }

        string url = "http://localhost:" + port + "/";
        Console.WriteLine();
        Console.WriteLine("  RPGAtlas is starting (Vite dev server)...");
        Console.WriteLine();
        Console.WriteLine("  Editor:  " + url);
        Console.WriteLine("  Player:  " + url + "play.html");
        Console.WriteLine();
        Console.WriteLine("  Keep this window open while you work. Close it to stop RPGAtlas.");
        Console.WriteLine();

        if (!WaitForServer(port, vite))
        {
            return Fail(
                "The Vite dev server stopped before it was ready (see output above).",
                "Fix the reported error, or run \"npm run dev\" in the RPGAtlas folder to debug.");
        }

        if (openBrowser)
        {
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
            catch { Console.WriteLine("  (Open " + url + " in your browser to begin.)"); }
        }

        // Vite shares this console, so closing the window shuts both down.
        vite.WaitForExit();
        return vite.ExitCode;
    }

    private static int FindFreePort()
    {
        for (int candidate = FirstPort; candidate <= LastPort; candidate++)
        {
            try
            {
                TcpListener probe = new TcpListener(System.Net.IPAddress.Loopback, candidate);
                probe.Start();
                probe.Stop();
                return candidate;
            }
            catch (SocketException) { /* port busy — try the next one */ }
        }
        return 0;
    }

    private static bool WaitForServer(int port, Process vite)
    {
        // Vite is normally up within a second or two; allow a cold minute.
        for (int attempt = 0; attempt < 240; attempt++)
        {
            if (vite.HasExited) return false;
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    client.Connect("localhost", port);
                    return true;
                }
            }
            catch (SocketException)
            {
                Thread.Sleep(250);
            }
        }
        return !vite.HasExited;
    }

    private static int Fail(string problem, string advice)
    {
        Console.WriteLine();
        Console.WriteLine("  " + problem);
        Console.WriteLine("  " + advice);
        Console.WriteLine();
        Console.WriteLine("  Press Enter to close.");
        Console.ReadLine();
        return 1;
    }
}

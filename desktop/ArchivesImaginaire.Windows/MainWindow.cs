using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ArchivesImaginaire.Windows;

/// <summary>
/// Hosts two top-level sites in two independent WebView2 controls. Unlike an HTML iframe,
/// each site is a top-level navigation, so Owlbear's frame-ancestor policy is respected.
/// </summary>
public sealed class MainWindow : Form
{
    private const string ArchivesUrl =
        "https://toniogervais.github.io/archives-owlbear/archives-app-v51-v37.html";
    private const string OwlbearUrl = "https://www.owlbear.rodeo/";
    private const string AppMessage = "archives:show-owlbear";
    private readonly string settingsFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ArchivesImaginaire");
    private readonly WebView2 archives = new() { Dock = DockStyle.Fill };
    private readonly WebView2 owlbear = new() { Dock = DockStyle.Fill };
    private readonly Button toggle = new()
    {
        Dock = DockStyle.Right, Width = 192, Height = 43,
        Text = "Afficher Owlbear", Font = new Font("Segoe UI", 10, FontStyle.Bold),
        BackColor = Color.FromArgb(61, 43, 19), ForeColor = Color.FromArgb(255, 230, 174),
        FlatStyle = FlatStyle.Flat, Enabled = false
    };
    private readonly Label heading = new()
    {
        Dock = DockStyle.Fill, Text = "✦ LES ARCHIVES DE L'IMAGINAIRE",
        TextAlign = ContentAlignment.MiddleLeft,
        Padding = new Padding(13, 0, 0, 0),
        Font = new Font("Segoe UI", 11, FontStyle.Bold),
        ForeColor = Color.FromArgb(244, 226, 192)
    };
    private bool showingOwlbear;
    private bool initialized;
    private Uri? selectedRoom;

    public MainWindow()
    {
        Text = "Les Archives de l'Imaginaire";
        MinimumSize = new Size(860, 560);
        Size = new Size(1440, 900);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(13, 10, 17);

        var top = new Panel
        {
            Dock = DockStyle.Top, Height = 54, BackColor = Color.FromArgb(27, 20, 34)
        };
        toggle.FlatAppearance.BorderColor = Color.FromArgb(190, 151, 72);
        toggle.Margin = new Padding(5);
        top.Controls.Add(heading);
        top.Controls.Add(toggle);

        var surface = new Panel { Dock = DockStyle.Fill };
        surface.Controls.Add(owlbear);
        surface.Controls.Add(archives);
        Controls.Add(surface);
        Controls.Add(top);
        archives.BringToFront();

        var context = new ContextMenuStrip();
        context.Items.Add("Changer la salle Owlbear…", null, (_, _) => ChangeRoom());
        toggle.ContextMenuStrip = context;
        toggle.Click += async (_, _) =>
        {
            if (showingOwlbear) ShowArchives();
            else await ShowOwlbearAsync();
        };
        Shown += async (_, _) => await InitializeAsync();
    }

    private string SettingsFile => Path.Combine(settingsFolder, "settings.json");

    private async Task InitializeAsync()
    {
        try
        {
            Directory.CreateDirectory(settingsFolder);
            selectedRoom = ReadSavedRoom();
            var userData = Path.Combine(settingsFolder, "WebView2Profile");
            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: userData);

            // Both controls remain alive when switching: DOM and scroll positions persist.
            await archives.EnsureCoreWebView2Async(environment);
            await owlbear.EnsureCoreWebView2Async(environment);

            archives.CoreWebView2.Settings.IsWebMessageEnabled = true;
            archives.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                if (!IsTrustedArchivesMessage(e.Source)) return;
                try
                {
                    if (e.TryGetWebMessageAsString() == AppMessage)
                        _ = ShowOwlbearAsync();
                }
                catch (ArgumentException) { }
            };
            archives.NavigationCompleted += async (_, e) =>
            {
                if (e.IsSuccess) await InjectArchivesButtonAsync();
            };
            SetupExternalLinks(archives);
            SetupExternalLinks(owlbear);

            archives.CoreWebView2.Navigate(ArchivesUrl);
            initialized = true;
            toggle.Enabled = true;
        }
        catch (Exception e)
        {
            MessageBox.Show(this,
                "Impossible d'initialiser le composant Microsoft Edge WebView2. " +
                "Les Archives web d'origine n'ont pas été modifiées.\n\n" + e.Message,
                "Initialisation impossible", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    // Never execute commands from an unrelated website or an Owlbear room.
    private static bool IsTrustedArchivesMessage(string? source)
    {
        return Uri.TryCreate(source, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && uri.Host.Equals("toniogervais.github.io", StringComparison.OrdinalIgnoreCase)
            && uri.AbsolutePath.Equals(
                "/archives-owlbear/archives-app-v51-v37.html",
                StringComparison.OrdinalIgnoreCase);
    }

    private async Task InjectArchivesButtonAsync()
    {
        const string script = """
            (() => {
              const screen = document.getElementById('archives-title-screen');
              if (screen) {
                screen.hidden = true;
                screen.style.setProperty('display', 'none', 'important');
              }
              const icon = document.querySelector(
                '#canvas-integrations-dock .canvas-integration-item:first-child button'
              );
              if (!icon || icon.dataset.nativeSwitchAttached === '1') return;
              icon.dataset.nativeSwitchAttached = '1';
              icon.disabled = false;
              icon.setAttribute('aria-label', 'Afficher Owlbear');
              icon.title = 'Afficher Owlbear';
              icon.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (window.chrome?.webview) {
                  window.chrome.webview.postMessage('archives:show-owlbear');
                }
              }, true);
            })();
            """;
        try { await archives.CoreWebView2.ExecuteScriptAsync(script); }
        catch (Exception e) { Debug.WriteLine(e); }
    }

    private async Task ShowOwlbearAsync()
    {
        if (!initialized || showingOwlbear) return;
        if (selectedRoom is null)
        {
            var url = PromptForRoom();
            if (url is null) return;
            selectedRoom = url;
            SaveRoom(url);
        }

        try
        {
            // Top-level navigation: Owlbear is not framed inside the Archives HTML.
            if (owlbear.CoreWebView2.Source != selectedRoom.AbsoluteUri)
                owlbear.CoreWebView2.Navigate(selectedRoom.AbsoluteUri);
            owlbear.BringToFront();
            showingOwlbear = true;
            toggle.Text = "← Retour aux Archives";
            heading.Text = "✦ OWLBEAR — CARTES ET PIONS";
        }
        catch (Exception e)
        {
            MessageBox.Show(this, e.Message, "Owlbear indisponible",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        await Task.CompletedTask;
    }

    private void ShowArchives()
    {
        if (!initialized) return;
        archives.BringToFront();
        showingOwlbear = false;
        toggle.Text = "Afficher Owlbear";
        heading.Text = "✦ LES ARCHIVES DE L'IMAGINAIRE";
    }

    private void ChangeRoom()
    {
        var newRoom = PromptForRoom();
        if (newRoom is null) return;
        selectedRoom = newRoom;
        SaveRoom(newRoom);
        if (showingOwlbear) owlbear.CoreWebView2.Navigate(newRoom.AbsoluteUri);
    }

    private Uri? PromptForRoom()
    {
        using var prompt = new Form
        {
            Text = "Relier la salle Owlbear",
            Width = 550, Height = 234,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false, MinimizeBox = false,
            StartPosition = FormStartPosition.CenterParent,
            BackColor = Color.FromArgb(27, 21, 34),
            ForeColor = Color.White
        };
        var label = new Label
        {
            Text = "Colle le lien complet de ta salle Owlbear (une seule fois).",
            Left = 18, Top = 18, Width = 500, Height = 28
        };
        var input = new TextBox
        {
            Left = 18, Top = 54, Width = 495, Height = 28,
            Text = selectedRoom?.AbsoluteUri ?? ""
        };
        var error = new Label
        {
            Left = 18, Top = 91, Width = 500, Height = 25,
            ForeColor = Color.FromArgb(255, 185, 160)
        };
        var save = new Button
        {
            Text = "Enregistrer", Left = 377, Top = 128,
            Width = 135, Height = 36
        };
        var cancel = new Button
        {
            Text = "Annuler", Left = 252, Top = 128,
            Width = 115, Height = 36, DialogResult = DialogResult.Cancel
        };
        Uri? validated = null;
        save.Click += (_, _) =>
        {
            if (TryValidateRoom(input.Text, out var url))
            {
                validated = url;
                prompt.DialogResult = DialogResult.OK;
                prompt.Close();
            }
            else error.Text = "Utilise le lien HTTPS complet de ta salle owlbear.rodeo.";
        };
        prompt.Controls.AddRange(new Control[] { label, input, error, save, cancel });
        prompt.AcceptButton = save;
        prompt.CancelButton = cancel;
        return prompt.ShowDialog(this) == DialogResult.OK ? validated : null;
    }

    private static bool TryValidateRoom(string? candidate, out Uri? result)
    {
        result = null;
        if (!Uri.TryCreate(candidate?.Trim(), UriKind.Absolute, out var uri))
            return false;
        var host = uri.Host.ToLowerInvariant();
        if (uri.Scheme != Uri.UriSchemeHttps ||
            (host != "www.owlbear.rodeo" && host != "owlbear.rodeo") ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            (uri.AbsolutePath == "/" && string.IsNullOrEmpty(uri.Query)))
            return false;
        result = uri;
        return true;
    }

    private Uri? ReadSavedRoom()
    {
        try
        {
            if (!File.Exists(SettingsFile)) return null;
            var settings = JsonSerializer.Deserialize<SavedSettings>(File.ReadAllText(SettingsFile));
            if (TryValidateRoom(settings?.RoomUrl, out var room)) return room;
        }
        catch (Exception e) { Debug.WriteLine(e); }
        return null;
    }

    private void SaveRoom(Uri room)
    {
        Directory.CreateDirectory(settingsFolder);
        File.WriteAllText(SettingsFile,
            JsonSerializer.Serialize(new SavedSettings { RoomUrl = room.AbsoluteUri }));
    }

    private static void SetupExternalLinks(WebView2 view)
    {
        view.CoreWebView2.NewWindowRequested += (_, args) =>
        {
            args.Handled = true;
            // Only explicit links requesting a new window use the system browser;
            // the Archives/Owlbear mode switch never creates a tab.
            if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) &&
                uri.Scheme == Uri.UriSchemeHttps)
            {
                try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
                catch (Exception e) { Debug.WriteLine(e); }
            }
        };
    }

    private sealed class SavedSettings
    {
        public string? RoomUrl { get; set; }
    }
}

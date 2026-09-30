package com.karelisio.mijote;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Small native bridge for Mijote:
 * - text shared to the app ("Share to Mijote" from a browser), cold start and while running;
 * - Material You seed color derived from the wallpaper (Android 12+);
 * - in-app update of the GitHub APK build (download + system installer).
 */
@CapacitorPlugin(name = "MijoteNative")
public class MijoteNativePlugin extends Plugin {

    private JSObject pendingShare;

    /** One update download at a time: they share the same file in the cache. */
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    @Override
    public void load() {
        JSObject share = readShare(getActivity().getIntent());
        if (share != null) pendingShare = share;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject share = readShare(intent);
        if (share == null) return;
        if (hasListeners("shareReceived")) {
            notifyListeners("shareReceived", share);
        } else {
            pendingShare = share;
        }
    }

    /** Extracts ACTION_SEND text and consumes it so a recreated activity does not import twice. */
    private JSObject readShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return null;
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        intent.setAction(Intent.ACTION_MAIN);
        intent.removeExtra(Intent.EXTRA_TEXT);
        JSObject data = new JSObject();
        data.put("text", text);
        data.put("subject", subject == null ? "" : subject);
        return data;
    }

    @PluginMethod
    public void consumePendingShare(PluginCall call) {
        JSObject result = pendingShare != null ? pendingShare : new JSObject();
        pendingShare = null;
        call.resolve(result);
    }

    @PluginMethod
    public void getDynamicSeed(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int color = ContextCompat.getColor(getContext(), android.R.color.system_accent1_500);
            result.put("available", true);
            result.put("seed", String.format("#%06X", 0xFFFFFF & color));
        } else {
            result.put("available", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getBuildInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("flavor", BuildConfig.FLAVOR);
        result.put("versionName", BuildConfig.VERSION_NAME);
        result.put("versionCode", BuildConfig.VERSION_CODE);
        result.put("updatesEnabled", BuildConfig.IN_APP_UPDATES);
        call.resolve(result);
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", canInstall());
        call.resolve(result);
    }

    /** Opens the "Install unknown apps" setting for Mijote (Android 8+). */
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    /**
     * Downloads the APK into the private cache (progress via "updateProgress" events), checks it
     * against the SHA-256 published with the release when there is one, then hands it to the
     * system package installer.
     */
    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String url = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        if (!BuildConfig.IN_APP_UPDATES) {
            call.reject("In-app updates are disabled in this build", "disabled");
            return;
        }
        if (!isAllowedUpdateUrl(url, true)) {
            call.reject("Only https GitHub release URLs are accepted", "bad_url");
            return;
        }
        if (expectedSha256 != null && !expectedSha256.matches("^[0-9a-fA-F]{64}$")) {
            call.reject("Invalid SHA-256", "bad_digest");
            return;
        }
        if (!canInstall()) {
            call.reject("Install permission not granted", "install_permission");
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            call.reject("An update is already being downloaded", "busy");
            return;
        }
        new Thread(() -> {
            HttpURLConnection connection = null;
            File apk = new File(new File(getContext().getCacheDir(), "updates"), "mijote-update.apk");
            boolean ready = false;
            try {
                File dir = apk.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) throw new Exception("cannot create cache dir");

                connection = openGithubDownload(url);

                long total = connection.getContentLengthLong();
                long done = 0;
                int lastPercent = -1;
                MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        sha256.update(buffer, 0, read);
                        done += read;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject progress = new JSObject();
                                progress.put("percent", percent);
                                notifyListeners("updateProgress", progress);
                            }
                        }
                    }
                }
                if (expectedSha256 != null && !expectedSha256.equalsIgnoreCase(toHex(sha256.digest()))) {
                    call.reject("The downloaded file does not match the release checksum", "checksum");
                    return;
                }
                ready = true;

                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apk
                );
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(install);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("Cannot open installer: " + e.getMessage(), "installer");
                    }
                });
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), "download");
            } finally {
                if (connection != null) connection.disconnect();
                // A partial or altered file must never be installed later.
                if (!ready && apk.exists() && !apk.delete()) apk.deleteOnExit();
                downloading.set(false);
            }
        }).start();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString();
    }

    private static final int MAX_REDIRECTS = 5;

    /**
     * Release APKs are downloaded from GitHub only: the request starts on github.com (or
     * api.github.com) and may only be redirected to github.com or its download CDN
     * (*.githubusercontent.com), over https.
     */
    static boolean isAllowedUpdateUrl(String address, boolean initial) {
        if (address == null) return false;
        try {
            return isAllowedUpdateUrl(new URL(address), initial);
        } catch (Exception e) {
            return false;
        }
    }

    static boolean isAllowedUpdateUrl(URL url, boolean initial) {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getHost() == null) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        if (host.equals("github.com")) return true;
        if (initial) return host.equals("api.github.com");
        return host.endsWith(".githubusercontent.com");
    }

    /** Opens the APK download, following redirects by hand so that every hop is checked. */
    private static HttpURLConnection openGithubDownload(String address) throws Exception {
        URL url = new URL(address);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("Accept", "application/octet-stream");
            int code = connection.getResponseCode();
            if (code >= 300 && code <= 399) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new Exception("HTTP " + code + " without Location");
                url = new URL(url, location);
                if (!isAllowedUpdateUrl(url, false)) {
                    throw new Exception("Redirected outside GitHub: " + url.getHost());
                }
                continue;
            }
            if (code < 200 || code > 299) {
                connection.disconnect();
                throw new Exception("HTTP " + code);
            }
            if (!isAllowedUpdateUrl(connection.getURL(), false)) {
                connection.disconnect();
                throw new Exception("Unexpected download host: " + connection.getURL().getHost());
            }
            return connection;
        }
        throw new Exception("Too many redirects");
    }

    private boolean canInstall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }
}

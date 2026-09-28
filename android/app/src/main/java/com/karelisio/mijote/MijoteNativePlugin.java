package com.karelisio.mijote;

import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Small native bridge for Mijote:
 * - text shared to the app ("Share to Mijote" from a browser), cold start and while running;
 * - Material You seed color derived from the wallpaper (Android 12+).
 */
@CapacitorPlugin(name = "MijoteNative")
public class MijoteNativePlugin extends Plugin {

    private JSObject pendingShare;

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
}

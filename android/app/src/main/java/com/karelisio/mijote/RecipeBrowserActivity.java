package com.karelisio.mijote;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.widget.ImageViewCompat;
import org.json.JSONArray;

/**
 * In-app recipe browser: browse Marmiton (or any recipe site) inside Mijote, then import the
 * page being viewed with one tap. The page HTML is handed back to the plugin so the import does
 * not need a second download.
 */
public class RecipeBrowserActivity extends AppCompatActivity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_COLORS = "colors";
    public static final String EXTRA_DARK = "dark";
    public static final String EXTRA_LABELS = "labels";

    /** HTML of the imported page; kept out of the result Intent (Binder size limit). */
    private static volatile String pendingHtml;

    static String consumeHtml() {
        String html = pendingHtml;
        pendingHtml = null;
        return html;
    }

    static void clearHtml() {
        pendingHtml = null;
    }

    // True when the page declares a schema.org Recipe (JSON-LD or microdata).
    private static final String DETECT_RECIPE_JS =
        "(function(){try{var s=document.querySelectorAll('script[type=\"application/ld+json\"]');" +
        "for(var i=0;i<s.length;i++){if(/\"@type\"\\s*:\\s*(\\[[^\\]]*)?\"Recipe\"/.test(s[i].textContent))return true;}" +
        "return !!document.querySelector('[itemtype*=\"schema.org/Recipe\"]');}catch(e){return false;}})()";

    private static final String OUTER_HTML_JS = "(function(){return document.documentElement.outerHTML;})()";

    private WebView webView;
    private ProgressBar progress;
    private TextView titleView;
    private TextView hostView;
    private ImageButton importIcon;
    private View fab;
    private boolean fabShown = false;
    private boolean importing = false;

    // Theme, passed from the web app so the browser matches the current Material You palette.
    private int colorPrimary = 0xFF9A4521;
    private int colorOnPrimary = Color.WHITE;
    private int colorSurface = 0xFFFFF8F6;
    private int colorOnSurface = 0xFF231A16;
    private int colorOnSurfaceVariant = 0xFF53433D;
    private String labelImport = "Importer cette recette";
    private String labelClose = "Fermer";
    private String labelBack = "Retour";
    private String labelReload = "Recharger";

    private final Runnable detectRecipe = () -> {
        if (webView != null) webView.evaluateJavascript(DETECT_RECIPE_JS, value -> setFabVisible("true".equals(value)));
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        readExtras(getIntent());
        boolean dark = getIntent().getBooleanExtra(EXTRA_DARK, false);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(!dark);
        bars.setAppearanceLightNavigationBars(!dark);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(colorSurface);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        root.addView(column, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = buildToolbar();
        column.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(ColorStateList.valueOf(colorPrimary));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(colorSurface));
        column.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        configureWebView();
        column.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        fab = buildFab();
        FrameLayout.LayoutParams fabParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(56),
            Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        fabParams.bottomMargin = dp(24);
        root.addView(fab, fabParams);
        fab.setVisibility(View.GONE);

        // Edge-to-edge: pad the toolbar under the status bar and keep content above the nav bar.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets sys = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            toolbar.setPadding(dp(4) + sys.left, sys.top, dp(4) + sys.right, 0);
            column.setPadding(0, 0, 0, sys.bottom);
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) fab.getLayoutParams();
            lp.bottomMargin = dp(24) + sys.bottom;
            fab.setLayoutParams(lp);
            return WindowInsetsCompat.CONSUMED;
        });

        setContentView(root);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else close();
            }
        });

        String url = getIntent().getStringExtra(EXTRA_URL);
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else if (url != null) webView.loadUrl(url);
    }

    private void readExtras(Intent intent) {
        String[] colors = intent.getStringArrayExtra(EXTRA_COLORS);
        if (colors != null && colors.length >= 5) {
            colorPrimary = parseColor(colors[0], colorPrimary);
            colorOnPrimary = parseColor(colors[1], colorOnPrimary);
            colorSurface = parseColor(colors[2], colorSurface);
            colorOnSurface = parseColor(colors[3], colorOnSurface);
            colorOnSurfaceVariant = parseColor(colors[4], colorOnSurfaceVariant);
        }
        String[] labels = intent.getStringArrayExtra(EXTRA_LABELS);
        if (labels != null && labels.length >= 4) {
            labelImport = labels[0];
            labelClose = labels[1];
            labelBack = labels[2];
            labelReload = labels[3];
        }
    }

    private static int parseColor(String value, int fallback) {
        try {
            return value == null ? fallback : Color.parseColor(value.trim());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private LinearLayout buildToolbar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(colorSurface);
        bar.setMinimumHeight(dp(64));

        bar.addView(iconButton(R.drawable.ic_browser_close, labelClose, v -> close()), new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.setPadding(dp(8), 0, dp(8), 0);
        titleView = new TextView(this);
        titleView.setTextColor(colorOnSurface);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        titleView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        hostView = new TextView(this);
        hostView.setTextColor(colorOnSurfaceVariant);
        hostView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        hostView.setSingleLine(true);
        hostView.setEllipsize(TextUtils.TruncateAt.END);
        texts.addView(titleView);
        texts.addView(hostView);
        bar.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        bar.addView(iconButton(R.drawable.ic_browser_reload, labelReload, v -> webView.reload()), new LinearLayout.LayoutParams(dp(48), dp(48)));
        importIcon = iconButton(R.drawable.ic_browser_import, labelImport, v -> importPage());
        bar.addView(importIcon, new LinearLayout.LayoutParams(dp(48), dp(48)));
        return bar;
    }

    private ImageButton iconButton(int icon, String label, View.OnClickListener onClick) {
        ImageButton b = new ImageButton(this);
        b.setImageResource(icon);
        ImageViewCompat.setImageTintList(b, ColorStateList.valueOf(colorOnSurfaceVariant));
        TypedValue ripple = new TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, ripple, true);
        b.setBackgroundResource(ripple.resourceId);
        b.setContentDescription(label);
        b.setOnClickListener(onClick);
        return b;
    }

    private View buildFab() {
        LinearLayout pill = new LinearLayout(this);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(16), 0, dp(20), 0);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(colorPrimary);
        bg.setCornerRadius(dp(16));
        pill.setBackground(bg);
        pill.setElevation(dp(6));
        pill.setClickable(true);
        pill.setFocusable(true);
        pill.setContentDescription(labelImport);

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_browser_import);
        ImageViewCompat.setImageTintList(icon, ColorStateList.valueOf(colorOnPrimary));
        pill.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));

        TextView label = new TextView(this);
        label.setText(labelImport);
        label.setTextColor(colorOnPrimary);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        label.setPadding(dp(12), 0, 0, 0);
        pill.addView(label);

        pill.setOnClickListener(v -> importPage());
        return pill;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Stay on the web: app links (intent:, market:, apps' own schemes) are ignored.
                String scheme = request.getUrl().getScheme();
                return !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                setFabVisible(false);
                updateHost(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                updateHost(url);
                view.removeCallbacks(detectRecipe);
                view.post(detectRecipe);
                // Some sites inject their structured data after load.
                view.postDelayed(detectRecipe, 1500);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                updateHost(url);
                view.removeCallbacks(detectRecipe);
                view.postDelayed(detectRecipe, 800);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.INVISIBLE : View.VISIBLE);
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                titleView.setText(title);
            }
        });
    }

    private void updateHost(String url) {
        if (url == null) return;
        String host = Uri.parse(url).getHost();
        hostView.setText(host == null ? url : host.replaceFirst("^www\\.", ""));
    }

    private void setFabVisible(boolean visible) {
        if (fab == null || visible == fabShown) return;
        fabShown = visible;
        fab.animate().cancel();
        if (visible) {
            fab.setVisibility(View.VISIBLE);
            fab.setAlpha(0f);
            fab.setTranslationY(dp(24));
            fab.setScaleX(0.9f);
            fab.setScaleY(0.9f);
            fab.animate().alpha(1f).translationY(0).scaleX(1f).scaleY(1f).setDuration(220).start();
        } else {
            fab.animate().alpha(0f).translationY(dp(24)).setDuration(150)
                .withEndAction(() -> fab.setVisibility(View.GONE)).start();
        }
        ImageViewCompat.setImageTintList(importIcon, ColorStateList.valueOf(visible ? colorPrimary : colorOnSurfaceVariant));
    }

    /** Captures the rendered page and returns it to Mijote for review. */
    private void importPage() {
        if (importing || webView == null) return;
        importing = true;
        final String url = webView.getUrl();
        final String title = webView.getTitle();
        webView.evaluateJavascript(OUTER_HTML_JS, value -> {
            String html = null;
            try {
                if (value != null && !"null".equals(value)) html = new JSONArray("[" + value + "]").getString(0);
            } catch (Exception ignored) {
                // Fall back to downloading the URL on the JS side.
            }
            pendingHtml = html;
            Intent data = new Intent();
            data.putExtra(EXTRA_URL, url);
            data.putExtra(EXTRA_TITLE, title);
            setResult(RESULT_OK, data);
            finish();
        });
    }

    private void close() {
        setResult(RESULT_CANCELED);
        finish();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeCallbacks(detectRecipe);
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}

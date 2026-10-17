package ro.cinemy.app;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Context;
import android.media.AudioManager;
import android.os.Build;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final String[] AD_MARKERS = {
        "doubleclick", "googlesyndication", "googleadservices", "adservice",
        "adnxs", "adsystem", "adsterra", "propellerads", "popads",
        "popcash", "exoclick", "trafficjunky", "onclick", "clickadu",
        "hilltopads", "histats", "revcontent", "taboola", "outbrain",
        "/vast/", "/vmap/", "vast.xml", "popunder"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        // FLAG_FULLSCREEN is deprecated and conflicts with edge-to-edge on Android 15+;
        // enableImmersiveMode() hides the system bars through WindowInsetsController instead.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        enableImmersiveMode();

        WebView webView = getBridge().getWebView();
        webView.setFitsSystemWindows(false);
        webView.setPadding(0, 0, 0, 0);
        WebSettings settings = webView.getSettings();
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        ensureAudibleVolume();

        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAdUrl(uri.toString())) return true;

                // Never let an advert replace the main Cinemy screen.
                if (request.isForMainFrame() && !isAppUrl(uri)) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                // Fires for client-side pushState navigation too, so it tracks the Next.js router.
                applyOrientationForPath(url);
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                applyOrientationForPath(url);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isAdUrl(request.getUrl().toString())) {
                    return new WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        new ByteArrayInputStream(new byte[0])
                    );
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableImmersiveMode();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        boolean volumeKey = event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP
            || event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN
            || event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_MUTE;

        boolean handled = super.dispatchKeyEvent(event);
        if (volumeKey && event.getAction() == KeyEvent.ACTION_UP) {
            getBridge().getWebView().postDelayed(this::syncPlayerVolume, 60);
        }
        return handled;
    }

    /**
     * Rotates to landscape on the watch route and releases the lock everywhere else,
     * so a film opens sideways even when the system auto-rotate toggle is off.
     */
    private void applyOrientationForPath(String url) {
        boolean watching;
        try {
            String path = Uri.parse(url).getPath();
            watching = path != null && path.startsWith("/w/");
        } catch (Exception ignored) {
            return;
        }

        int requested = watching
            ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        if (getRequestedOrientation() != requested) setRequestedOrientation(requested);
    }

    /** Nudges the media stream off zero so autoplay is actually audible, without overriding a chosen level. */
    private void ensureAudibleVolume() {
        AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audio == null || audio.getStreamVolume(AudioManager.STREAM_MUSIC) > 0) return;
        int maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(1, maximum / 2), 0);
    }

    private void syncPlayerVolume() {
        AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        int current = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
        int maximum = Math.max(1, audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        double normalized = (double) current / maximum;
        int percent = (int) Math.round(normalized * 100);

        String script = "(() => { document.querySelectorAll('iframe').forEach((frame) => {"
            + "const target = frame.contentWindow; if (!target) return;"
            + "target.postMessage({type:'setVolume', volume:" + normalized + ", value:" + percent + "}, '*');"
            + "target.postMessage({type:'volume', volume:" + normalized + ", value:" + percent + "}, '*');"
            + (current > 0 ? "target.postMessage({type:'unmute'}, '*');" : "target.postMessage({type:'mute'}, '*');")
            + "}); })();";
        getBridge().getWebView().evaluateJavascript(script, null);
    }

    private void enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setBackgroundDrawableResource(android.R.color.black);
        getWindow().getDecorView().setFitsSystemWindows(false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private boolean isAppUrl(Uri uri) {
        String host = uri.getHost();
        String configuredHost = Uri.parse(getBridge().getServerUrl()).getHost();
        return host != null && configuredHost != null && host.equalsIgnoreCase(configuredHost);
    }

    private boolean isAdUrl(String rawUrl) {
        String url = rawUrl.toLowerCase(Locale.ROOT);
        for (String marker : AD_MARKERS) {
            if (url.contains(marker)) return true;
        }
        return false;
    }
}

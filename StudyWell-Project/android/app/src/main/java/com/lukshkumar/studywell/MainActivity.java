package com.lukshkumar.studywell;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4102;
    private WebView webView;
    private WebViewAssetLoader assetLoader;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        configureWebView();
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(0xFF111318);
        window.setNavigationBarColor(0xFF111318);
        window.getDecorView().setSystemUiVisibility(0);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void configureWebView() {
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF111318);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setSupportMultipleWindows(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(true);
        webView.addJavascriptInterface(new StudyWellBridge(this), "StudyWellNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request
            ) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                return host == null || !host.equals("appassets.androidplatform.net");
            }
        });

        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            String message = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    ? "Study reminders are enabled."
                    : "Notifications are still disabled in Android settings.";
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("StudyWellNative");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class StudyWellBridge {
        private final Activity activity;

        StudyWellBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void scheduleReminder(String id, long timestamp, String title, String body, boolean repeatsDaily) {
            ReminderScheduler.schedule(activity, id, timestamp, title, body, repeatsDaily);
        }

        @JavascriptInterface
        public void cancelReminder(String id) {
            ReminderScheduler.cancel(activity, id);
        }

        @JavascriptInterface
        public void notifyNow(String title, String body) {
            ReminderScheduler.showNow(activity, title, body);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            activity.runOnUiThread(MainActivity.this::requestNotificationPermission);
        }
    }
}

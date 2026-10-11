package com.lukshkumar.studywell;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;

final class ReminderScheduler {
    private static final String PREFERENCES = "studywell_scheduled_reminders";
    private static final String PREFIX = "reminder:";
    private static final String CHANNEL_ID = "studywell-study-reminders";

    private ReminderScheduler() { }

    static void schedule(
            Context context,
            String id,
            long timestamp,
            String title,
            String body,
            boolean repeatsDaily
    ) {
        if (id == null || id.trim().isEmpty() || timestamp <= System.currentTimeMillis()) {
            cancel(context, id);
            return;
        }

        JSONObject reminder = new JSONObject();
        try {
            reminder.put("id", id);
            reminder.put("timestamp", timestamp);
            reminder.put("title", safeText(title, "StudyWell reminder"));
            reminder.put("body", safeText(body, "Open StudyWell to review your plan."));
            reminder.put("repeatsDaily", repeatsDaily);
        } catch (JSONException error) {
            return;
        }

        preferences(context).edit().putString(PREFIX + id, reminder.toString()).apply();
        scheduleStoredReminder(context, id, reminder.toString());
    }

    static void cancel(Context context, String id) {
        if (id == null) return;
        PendingIntent pendingIntent = pendingIntent(context, id, null);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();
        preferences(context).edit().remove(PREFIX + id).apply();
    }

    static void restoreAfterRestart(Context context) {
        Map<String, ?> savedReminders = preferences(context).getAll();
        for (Map.Entry<String, ?> entry : savedReminders.entrySet()) {
            if (!entry.getKey().startsWith(PREFIX) || !(entry.getValue() instanceof String)) continue;
            String id = entry.getKey().substring(PREFIX.length());
            scheduleStoredReminder(context, id, (String) entry.getValue());
        }
    }

    static void showNow(Context context, String title, String body) {
        showNotification(context, "instant-" + System.currentTimeMillis(), title, body);
    }

    static void scheduleStoredReminder(Context context, String id, String rawReminder) {
        try {
            JSONObject reminder = new JSONObject(rawReminder);
            long timestamp = reminder.optLong("timestamp", 0L);
            boolean repeatsDaily = reminder.optBoolean("repeatsDaily", false);
            if (timestamp <= System.currentTimeMillis()) {
                if (repeatsDaily) {
                    timestamp = System.currentTimeMillis() + 60_000L;
                    reminder.put("timestamp", timestamp);
                    preferences(context).edit().putString(PREFIX + id, reminder.toString()).apply();
                } else {
                    preferences(context).edit().remove(PREFIX + id).apply();
                    return;
                }
            }

            Intent intent = new Intent(context, ReminderReceiver.class);
            intent.setData(Uri.parse("studywell://reminder/" + Uri.encode(id)));
            intent.putExtra("id", id);
            intent.putExtra("title", reminder.optString("title", "StudyWell reminder"));
            intent.putExtra("body", reminder.optString("body", "Open StudyWell to review your plan."));
            intent.putExtra("timestamp", timestamp);
            intent.putExtra("repeatsDaily", repeatsDaily);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    id.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
            }
        } catch (JSONException ignored) {
            preferences(context).edit().remove(PREFIX + id).apply();
        }
    }

    static void onReminderTriggered(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        long timestamp = intent.getLongExtra("timestamp", 0L);
        boolean repeatsDaily = intent.getBooleanExtra("repeatsDaily", false);

        showNotification(context, id == null ? "studywell" : id, title, body);

        if (repeatsDaily && id != null) {
            schedule(context, id, timestamp + 24L * 60L * 60L * 1000L, title, body, true);
        } else if (id != null) {
            preferences(context).edit().remove(PREFIX + id).apply();
        }
    }

    private static void showNotification(Context context, String id, String title, String body) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;

        createNotificationChannel(context);
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                id.hashCode(),
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(safeText(title, "StudyWell reminder"))
                .setContentText(safeText(body, "Open StudyWell to review your plan."))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeText(body, "Open StudyWell to review your plan.")))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build();
        NotificationManagerCompat.from(context).notify(id.hashCode(), notification);
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(context.getString(R.string.notification_channel_description));
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private static PendingIntent pendingIntent(Context context, String id, Intent suppliedIntent) {
        Intent intent = suppliedIntent == null ? new Intent(context, ReminderReceiver.class) : suppliedIntent;
        intent.setData(Uri.parse("studywell://reminder/" + Uri.encode(id)));
        intent.putExtra("id", id);
        return PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private static String safeText(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) return fallback;
        return value.length() > 240 ? value.substring(0, 240) : value;
    }
}

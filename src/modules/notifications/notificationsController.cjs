const admin = require("firebase-admin");

exports.sendNotification = async (req, res) => {
  try {

    const { token, title, body, data } = req.body;

    await admin.messaging().send({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "high_importance_channel",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    });

    res.json({ ok: true });

  } catch (error) {
    console.error("❌ ERROR NOTIFICATION:", error);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};
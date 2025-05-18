const telegramAuthToken = `654321:ABCdefGHIjklMNOpqrSTUvwxYZ12345678`; // Your bot token
const webhookEndpoint = "/endpoint";

addEventListener("fetch", event => {
  event.respondWith(handleIncomingRequest(event));
});

async function handleIncomingRequest(event) {
  try {
    const url = new URL(event.request.url);
    const path = url.pathname;
    const method = event.request.method;
    const workerUrl = `${url.protocol}//${url.host}`;

    if (method === "POST" && path === webhookEndpoint) {
      const update = await event.request.json();
      event.waitUntil(processUpdate(update));
      return new Response("Ok", { status: 200 });
    } else if (method === "GET" && path === "/configure-webhook") {
      const telegramUrl = `https://api.telegram.org/bot${telegramAuthToken}/setWebhook?url=${workerUrl}${webhookEndpoint}`;
      const response = await fetch(telegramUrl);
      if (response.ok) {
        return new Response("Webhook set successfully", { status: 200 });
      } else {
        const errorText = await response.text();
        console.error("Webhook error:", errorText);
        return new Response("Failed to set webhook", { status: response.status });
      }
    } else {
      return new Response("Not found", { status: 404 });
    }
  } catch (err) {
    console.error("Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }
}

async function processUpdate(update) {
  try {
    if ("message" in update) {
      const chatId = update.message.chat.id;
      const userText = update.message.text;

      console.log("Received message:", userText);

      if (isValidUrl(userText)) {
        const fileResponse = await fetch(userText);
        const contentType = fileResponse.headers.get("content-type") || "";
        const allowedTypes = ["application", "image", "video", "audio", "text"];

        if (!allowedTypes.some(type => contentType.startsWith(type))) {
          console.warn("Blocked unsupported content-type:", contentType);
          await sendMessage(chatId, "Unsupported file type.");
          return;
        }

        const fileBlob = await fileResponse.blob();
        const fileExtension = userText.split(".").pop().split("?")[0];
        const formData = new FormData();

        formData.append("chat_id", chatId);
        formData.append("document", fileBlob, `file.${fileExtension}`);

        const sendDocUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendDocument`;
        await fetch(sendDocUrl, {
          method: "POST",
          body: formData
        });
      } else {
        await sendMessage(chatId, "Invalid URL!");
      }
    }
  } catch (err) {
    console.error("processUpdate error:", err);
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
  await fetch(url);
}

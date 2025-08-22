import 'dotenv/config';
import axios from "axios";

(async () => {
  const api = axios.create({
    baseURL: "https://api.sender.net/v2",
    headers: { Authorization: `Bearer ${process.env.SENDER_API_KEY}` },
  });
  try {
    const { data } = await api.get("/message/bY5AXn");
    console.log("Message:", {
      id: data?.id,
      status: data?.status,           // enabled/disabled/draft
      subject: data?.subject,
      from_email: data?.from_email,
      hasHtml: !!data?.html,          // or data?.content?.html depending on account
    });
  } catch (e: any) {
    console.error("GET /message error:", e.response?.status, e.response?.data || e.message);
  }
})();

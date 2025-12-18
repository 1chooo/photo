import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";

// 從環境變數讀取設定
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 驗證 Firebase ID Token
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 驗證用戶身份
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // 檢查必要的環境變數
    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 1. 接收前端上傳的檔案
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 驗證文件類型
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type - Only images are allowed" },
        { status: 400 }
      );
    }

    // 驗證文件大小 (例如：最大 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large - Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // 2. 準備轉傳給 Telegram 的 FormData
    const telegramFormData = new FormData();
    telegramFormData.append("chat_id", CHAT_ID);
    telegramFormData.append("photo", file);

    // 3. 上傳照片到 Telegram (sendPhoto)
    const uploadRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: telegramFormData,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadData.ok) {
      console.error("Telegram Error:", uploadData);
      return NextResponse.json(
        { error: "Failed to upload to Telegram" },
        { status: 500 }
      );
    }

    // 4. 取得照片的 File ID (拿陣列中最後一個，因為那是解析度最高的)
    const photos = uploadData.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    // 5. 用 File ID 換取下載路徑 (getFile)
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const getFileData = await getFileRes.json();

    if (!getFileData.ok) {
      console.error("Telegram getFile Error:", getFileData);
      return NextResponse.json(
        { error: "Failed to get file URL from Telegram" },
        { status: 500 }
      );
    }

    const filePath = getFileData.result.file_path;

    // 6. 組合出圖片連結
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // 7. 存儲到 Firestore
    const db = getAdminDb();
    const imageData = {
      id: `tg-${Date.now()}`,
      url: fileUrl,
      file_id: fileId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.email,
      uploaded_at: new Date().toISOString(),
      telegram_file_path: filePath,
    };

    await db.collection('tg-as-image-storage').doc(imageData.id).set(imageData);

    return NextResponse.json({
      success: true,
      ...imageData,
    });
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
